import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Category, Role } from '@prisma/client';

interface FindAllOptions {
  userId?: string;
  requesterId: string;
  requesterRole: Role;
  category?: Category;
  startDate?: string;
  endDate?: string;
  merchant?: string;
  tag?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        userId,
        merchant: dto.merchant,
        amount: dto.amount,
        category: dto.category,
        date: new Date(dto.date),
        description: dto.description,
        tags: dto.tags ? this.sanitizeTags(dto.tags) : [],
        ticketId: dto.ticketId,
      },
    });
  }

  private sanitizeTags(tags: string[]): string[] {
    return [...new Set(
      tags
        .map((t) => t.trim().toLowerCase().slice(0, 30))
        .filter((t) => t.length > 0),
    )].slice(0, 10);
  }

  /** Devuelve todas las etiquetas únicas que el usuario ha usado. */
  async getUserTags(userId: string): Promise<string[]> {
    const expenses = await this.prisma.expense.findMany({
      where: { userId },
      select: { tags: true },
    });
    const all = expenses.flatMap((e) => e.tags);
    return [...new Set(all)].sort();
  }

  async findAll(options: FindAllOptions) {
    const { requesterId, requesterRole, category, startDate, endDate, merchant, tag, minAmount, maxAmount } = options;
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // cap at 100 to prevent DoS
    const skip = (page - 1) * limit;

    // Users can only see their own expenses; advisors can filter by userId
    const targetUserId =
      requesterRole === Role.ADVISOR ? options.userId : requesterId;

    const where: any = {};
    if (targetUserId) where.userId = targetUserId;
    if (category) where.category = category;
    if (merchant) where.merchant = { contains: merchant, mode: 'insensitive' };
    if (tag) where.tags = { has: tag.toLowerCase() }; // filtra por etiqueta exacta
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: expenses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, requesterId: string, requesterRole: Role) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        ticket: true,
      },
    });

    if (!expense) {
      throw new NotFoundException(`Gasto con id "${id}" no encontrado.`);
    }

    if (requesterRole !== Role.ADVISOR && expense.userId !== requesterId) {
      throw new ForbiddenException('No tenés acceso a este gasto.');
    }

    return expense;
  }

  async update(
    id: string,
    requesterId: string,
    requesterRole: Role,
    dto: UpdateExpenseDto,
  ) {
    const expense = await this.findOne(id, requesterId, requesterRole);

    if (requesterRole !== Role.ADVISOR && expense.userId !== requesterId) {
      throw new ForbiddenException('Solo podés editar tus propios gastos.');
    }

    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.tags !== undefined) data.tags = this.sanitizeTags(dto.tags);

    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(id: string, requesterId: string, requesterRole: Role) {
    const expense = await this.findOne(id, requesterId, requesterRole);

    if (requesterRole !== Role.ADVISOR && expense.userId !== requesterId) {
      throw new ForbiddenException('Solo podés eliminar tus propios gastos.');
    }

    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Gasto eliminado correctamente.' };
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getAnalytics(userId: string, period: 'month' | 'year' | 'all' = 'all') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Date filter used for the byCategory donut chart
    let categoryDateFilter: { gte?: Date } = {};
    if (period === 'month') {
      categoryDateFilter = { gte: startOfMonth };
    } else if (period === 'year') {
      categoryDateFilter = { gte: new Date(now.getFullYear(), 0, 1) };
    }

    const [
      byCategory,
      topMerchants,
      allExpenses6m,
      currentMonthTotal,
      previousMonthTotal,
    ] = await Promise.all([
      // Expenses grouped by category (filtered by period)
      this.prisma.expense.groupBy({
        by: ['category'],
        where: {
          userId,
          ...(categoryDateFilter.gte ? { date: categoryDateFilter } : {}),
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),

      // Top 10 merchants
      this.prisma.expense.groupBy({
        by: ['merchant'],
        where: { userId },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),

      // All expenses in last 6 months (for monthly chart)
      this.prisma.expense.findMany({
        where: {
          userId,
          date: { gte: startOf6MonthsAgo },
        },
        select: { amount: true, date: true, category: true },
        orderBy: { date: 'asc' },
      }),

      // Current month total
      this.prisma.expense.aggregate({
        where: { userId, date: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),

      // Previous month total
      this.prisma.expense.aggregate({
        where: {
          userId,
          date: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: startOfMonth,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    // Process monthly data
    const monthlyMap: Record<string, number> = {};
    for (const exp of allExpenses6m) {
      const key = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + exp.amount;
    }
    const monthlyData = Object.entries(monthlyMap)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Unusual expenses detection (amount > 5x average of last 30 days)
    const avgAmount =
      allExpenses6m.length > 0
        ? allExpenses6m.reduce((sum, e) => sum + e.amount, 0) / allExpenses6m.length
        : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // CHANGED: threshold 5x (requisito) en vez de 2x
    const unusualExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
        amount: { gt: avgAmount * 5 },
      },
      orderBy: { amount: 'desc' },
      take: 5,
    });

    const currentTotal = currentMonthTotal._sum.amount || 0;
    const prevTotal = previousMonthTotal._sum.amount || 0;
    const monthGrowth =
      prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    // Fetch user's savings goal and income for profile classification
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { savingsGoal: true, monthlyIncome: true },
    });

    // Perfil financiero: clasifica al usuario según tasa de gasto/ingreso
    const income = userRecord?.monthlyIncome || 0;
    const spendingRate = income > 0 ? currentTotal / income : null;
    let financialProfile: string | null = null;
    if (spendingRate !== null) {
      if (spendingRate > 0.9)      financialProfile = 'IMPULSIVO';
      else if (spendingRate > 0.7) financialProfile = 'ACTIVO';
      else if (spendingRate > 0.5) financialProfile = 'EQUILIBRADO';
      else                         financialProfile = 'AHORRADOR';
    }

    return {
      byCategory: byCategory.map((c) => ({
        category: c.category,
        total: c._sum.amount || 0,
        count: c._count,
      })),
      topMerchants: topMerchants.map((m) => ({
        merchant: m.merchant,
        total: m._sum.amount || 0,
        count: m._count,
      })),
      monthlyData,
      currentMonth: {
        total: currentTotal,
        count: currentMonthTotal._count,
      },
      previousMonth: {
        total: prevTotal,
      },
      monthGrowth: Math.round(monthGrowth * 100) / 100,
      unusualExpenses,
      averageExpense: Math.round(avgAmount * 100) / 100,
      savingsGoal: userRecord?.savingsGoal ?? null,
      financialProfile,
    };
  }

  private readonly DAY_NAMES = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
  ];

  async getPatterns(userId: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenses = await this.prisma.expense.findMany({
      where: { userId, date: { gte: threeMonthsAgo } },
      select: { amount: true, category: true, date: true, merchant: true },
    });

    // Group by month and category
    const monthCategoryMap: Record<string, Record<string, number>> = {};
    for (const e of expenses) {
      const month = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthCategoryMap[month]) monthCategoryMap[month] = {};
      monthCategoryMap[month][e.category] =
        (monthCategoryMap[month][e.category] || 0) + e.amount;
    }

    // Día de la semana con mayor gasto acumulado (de los últimos 3 meses)
    const dayOfWeekTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const e of expenses) {
      dayOfWeekTotals[e.date.getDay()] += e.amount;
    }
    const topDayIndex = dayOfWeekTotals.reduce(
      (maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0,
    );
    const topDayOfWeek = dayOfWeekTotals.some((t) => t > 0)
      ? { day: this.DAY_NAMES[topDayIndex], total: Math.round(dayOfWeekTotals[topDayIndex] * 100) / 100 }
      : null;

    // Categoría dominante en el período (mayor monto acumulado)
    const categoryTotals: Record<string, number> = {};
    for (const e of expenses) {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    }
    const dominantCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const dominantCategory = dominantCategoryEntry
      ? { category: dominantCategoryEntry[0], total: Math.round(dominantCategoryEntry[1] * 100) / 100 }
      : null;

    // Detect category trends (categories with increasing spend)
    const months = Object.keys(monthCategoryMap).sort();
    const trends: Array<{ category: string; trend: 'increasing' | 'decreasing' | 'stable'; change: number }> = [];

    if (months.length >= 2) {
      const lastMonth = monthCategoryMap[months[months.length - 1]] || {};
      const prevMonth = monthCategoryMap[months[months.length - 2]] || {};
      const allCategories = new Set([
        ...Object.keys(lastMonth),
        ...Object.keys(prevMonth),
      ]);

      for (const cat of allCategories) {
        const last = lastMonth[cat] || 0;
        const prev = prevMonth[cat] || 0;
        const change = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        trends.push({
          category: cat,
          trend: change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable',
          change: Math.round(change * 100) / 100,
        });
      }
    }

    return {
      monthlyBreakdown: months.map((m) => ({
        month: m,
        categories: monthCategoryMap[m],
        total: Object.values(monthCategoryMap[m]).reduce((a, b) => a + b, 0),
      })),
      trends: trends.sort((a, b) => b.change - a.change),
      topDayOfWeek,
      dominantCategory,
    };
  }

  // ─── Comparación entre meses ────────────────────────────────────────────

  /**
   * Compara el gasto total y por categoría entre dos meses (formato YYYY-MM).
   * Por defecto compara el mes anterior contra el mes actual.
   */
  async compareMonths(userId: string, monthA?: string, monthB?: string) {
    const now = new Date();
    const defaultB = this.formatYearMonth(now);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultA = this.formatYearMonth(prevMonthDate);

    const targetA = monthA || defaultA;
    const targetB = monthB || defaultB;

    const [dataA, dataB] = await Promise.all([
      this.getMonthSummary(userId, targetA),
      this.getMonthSummary(userId, targetB),
    ]);

    const totalDiff = dataB.total - dataA.total;
    const totalDiffPct =
      dataA.total > 0 ? (totalDiff / dataA.total) * 100 : (dataB.total > 0 ? 100 : 0);

    const totalsByCategoryA = new Map(dataA.byCategory.map((c) => [c.category, c.total]));
    const totalsByCategoryB = new Map(dataB.byCategory.map((c) => [c.category, c.total]));
    const allCategories = new Set([...totalsByCategoryA.keys(), ...totalsByCategoryB.keys()]);

    const byCategory = [...allCategories]
      .map((category) => {
        const totalA = totalsByCategoryA.get(category) || 0;
        const totalB = totalsByCategoryB.get(category) || 0;
        const diff = totalB - totalA;
        const diffPct = totalA > 0 ? (diff / totalA) * 100 : (totalB > 0 ? 100 : 0);
        return {
          category,
          totalA,
          totalB,
          diff: Math.round(diff * 100) / 100,
          diffPct: Math.round(diffPct * 100) / 100,
        };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return {
      monthA: dataA,
      monthB: dataB,
      diff: {
        total: Math.round(totalDiff * 100) / 100,
        totalPct: Math.round(totalDiffPct * 100) / 100,
        byCategory,
      },
    };
  }

  private formatYearMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private async getMonthSummary(userId: string, yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1); // exclusivo: primer día del mes siguiente

    const [byCategory, aggregate] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { userId, date: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { userId, date: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      month: yearMonth,
      total: aggregate._sum.amount || 0,
      count: aggregate._count,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        total: c._sum.amount || 0,
        count: c._count,
      })),
    };
  }
}
