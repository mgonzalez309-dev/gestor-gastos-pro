import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { ExpensesService } from '../expenses/expenses.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private prisma: PrismaService,
    private expensesService: ExpensesService,
  ) {}

  async create(advisorId: string, dto: CreateRecommendationDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con id "${dto.userId}" no encontrado.`);
    }

    return this.prisma.recommendation.create({
      data: {
        userId: dto.userId,
        advisorId,
        message: dto.message,
        type: dto.type || 'GENERAL',
      },
      include: {
        advisor: { select: { id: true, name: true } },
      },
    });
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con id "${userId}" no encontrado.`);
    }

    return this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        advisor: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Auto-generate recommendations based on spending patterns.
   * Called by advisor or on demand.
   */
  async autoGenerate(userId: string, advisorId: string) {
    const [analytics, patterns] = await Promise.all([
      this.expensesService.getAnalytics(userId),
      this.expensesService.getPatterns(userId),
    ]);

    const recommendations: Array<{ message: string; type: string }> = [];

    // 1. Alert for high month-over-month growth
    if (analytics.monthGrowth > 20) {
      recommendations.push({
        type: 'ALERT',
        message: `⚠️ Tu gasto mensual aumentó un ${analytics.monthGrowth.toFixed(1)}% respecto al mes anterior. Revisá tus gastos para identificar áreas de ahorro.`,
      });
    }

    // 2. Unusual expenses
    if (analytics.unusualExpenses.length > 0) {
      const top = analytics.unusualExpenses[0];
      recommendations.push({
        type: 'ALERT',
        message: `🔍 Se detectó un gasto inusualmente alto en "${top.merchant}" por $${top.amount.toFixed(2)}. Verificá si fue un gasto puntual o recurrente.`,
      });
    }

    // 3. Top spending categories
    if (analytics.byCategory.length > 0) {
      const topCat = analytics.byCategory[0];
      recommendations.push({
        type: 'PATTERN',
        message: `📊 Tu mayor gasto se concentra en la categoría "${topCat.category}" ($${topCat.total.toFixed(2)}). Considerá establecer un presupuesto mensual para esta categoría.`,
      });
    }

    // 4. Increasing category trends
    const increasingTrends = patterns.trends?.filter((t) => t.trend === 'increasing') || [];
    for (const trend of increasingTrends.slice(0, 2)) {
      recommendations.push({
        type: 'SAVING',
        message: `📈 Los gastos en "${trend.category}" aumentaron un ${trend.change.toFixed(1)}% respecto al mes anterior. Te recomendamos revisarlos para optimizar tu presupuesto.`,
      });
    }

    // 5. General savings tip if spending is above average
    if (analytics.currentMonth.total > analytics.averageExpense * analytics.currentMonth.count * 1.2) {
      recommendations.push({
        type: 'SAVING',
        message: `💡 Tu gasto promedio este mes está por encima de tu historial. Intentá planificar los gastos grandes con anticipación.`,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'GENERAL',
        message: `✅ ¡Tus patrones de gasto se ven estables! Seguí así y considerá destinar parte de tus ingresos al ahorro mensual (recomendación: al menos el 20%).`,
      });
    }

    // Save all generated recommendations
    const created = await Promise.all(
      recommendations.map((r) =>
        this.prisma.recommendation.create({
          data: {
            userId,
            advisorId,
            message: r.message,
            type: r.type,
          },
        }),
      ),
    );

    return created;
  }
}
