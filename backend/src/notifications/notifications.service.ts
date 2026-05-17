import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from '../expenses/expenses.service';

const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private expensesService: ExpensesService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────

  async findAll(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async remove(id: string, userId: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { message: 'Notificación eliminada.' };
  }

  async clearAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { message: 'Notificaciones eliminadas.' };
  }

  // ── Generación automática basada en analytics ─────────────────────

  /**
   * Analiza la situación financiera del usuario y genera notificaciones
   * relevantes. Evita duplicados usando un cooldown de 24 h por tipo.
   * Se llama desde el frontend al cargar el dashboard (sin scheduler externo).
   */
  async generate(userId: string): Promise<number> {
    const [analytics, user] = await Promise.all([
      this.expensesService.getAnalytics(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { monthlyIncome: true, savingsGoal: true, categoryBudgets: true },
      }),
    ]);

    const toCreate: Array<{
      type: string;
      title: string;
      message: string;
      metadata?: object;
    }> = [];

    // 1. Gasto mensual subió más del 20%
    if (analytics.monthGrowth > 20) {
      toCreate.push({
        type: 'MONTHLY_GROWTH',
        title: 'Gasto mensual en aumento',
        message: `Tu gasto subió un ${analytics.monthGrowth.toFixed(1)}% respecto al mes anterior. Revisá tus gastos para identificar áreas de ahorro.`,
        metadata: { monthGrowth: analytics.monthGrowth },
      });
    }

    // 2. Gastos anómalos detectados (> 5x promedio)
    if (analytics.unusualExpenses?.length > 0) {
      const top = analytics.unusualExpenses[0];
      toCreate.push({
        type: 'UNUSUAL_EXPENSE',
        title: 'Gasto inusualmente alto detectado',
        message: `Se detectó un gasto de ${top.merchant} por $${top.amount.toFixed(2)} que es significativamente mayor a tu promedio.`,
        metadata: { expenseId: top.id, merchant: top.merchant, amount: top.amount },
      });
    }

    // 3. Riesgo de no llegar a la meta de ahorro
    if (user?.monthlyIncome && user?.savingsGoal) {
      const freeBudget = user.monthlyIncome - user.savingsGoal;
      const spent = analytics.currentMonth?.total || 0;
      const freeLeft = freeBudget - spent;

      if (freeLeft < 0) {
        toCreate.push({
          type: 'SAVINGS_RISK',
          title: '⚠️ Meta de ahorro en riesgo',
          message: `Ya consumiste $${Math.abs(freeLeft).toFixed(2)} de tu meta de ahorro (${user.savingsGoal.toFixed(2)}) este mes.`,
          metadata: { savingsGoal: user.savingsGoal, overspent: Math.abs(freeLeft) },
        });
      } else if (freeLeft < freeBudget * 0.15) {
        toCreate.push({
          type: 'SAVINGS_RISK',
          title: 'Presupuesto libre casi agotado',
          message: `Solo te quedan $${freeLeft.toFixed(2)} de presupuesto libre antes de afectar tu meta de ahorro.`,
          metadata: { remaining: freeLeft, savingsGoal: user.savingsGoal },
        });
      }
    }

    // 4. Presupuesto de categoría excedido
    const budgets = (user?.categoryBudgets as Record<string, number>) || {};
    for (const cat of analytics.byCategory || []) {
      const limit = budgets[cat.category];
      if (limit && limit > 0 && cat.total > limit) {
        const excess = cat.total - limit;
        toCreate.push({
          type: 'BUDGET_ALERT',
          title: `Presupuesto de ${cat.category} excedido`,
          message: `Superaste el límite de $${limit.toFixed(2)} en ${cat.category} por $${excess.toFixed(2)} este mes.`,
          metadata: { category: cat.category, budget: limit, spent: cat.total, excess },
        });
      }
    }

    // 5. Positivo si todo está bien
    if (toCreate.length === 0) {
      toCreate.push({
        type: 'GENERAL',
        title: '¡Tus finanzas están en orden!',
        message: 'No se detectaron alertas este mes. Seguí así y considerá revisar tus metas de ahorro.',
      });
    }

    // Desduplicar: no crear notificaciones del mismo tipo si ya existe una de las últimas 24 h
    const cutoff = new Date(Date.now() - NOTIFICATION_COOLDOWN_MS);
    const recentTypes = await this.prisma.notification.findMany({
      where: { userId, createdAt: { gte: cutoff } },
      select: { type: true },
    });
    const recentTypeSet = new Set(recentTypes.map((n) => n.type));

    const filtered = toCreate.filter((n) => !recentTypeSet.has(n.type));
    if (!filtered.length) return 0;

    await this.prisma.notification.createMany({
      data: filtered.map((n) => ({
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata ?? null,
      })),
    });

    return filtered.length;
  }
}
