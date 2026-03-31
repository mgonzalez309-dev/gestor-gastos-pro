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
        ticketId: dto.ticketId,
      },
    });
  }

  async findAll(options: FindAllOptions) {
    const { requesterId, requesterRole, category, startDate, endDate } = options;
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // cap at 100 to prevent DoS
    const skip = (page - 1) * limit;

    // Users can only see their own expenses; advisors can filter by userId
    const targetUserId =
      requesterRole === Role.ADVISOR ? options.userId : requesterId;

    const where: any = {};
    if (targetUserId) where.userId = targetUserId;
    if (category) where.category = category;
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

  async getAnalytics(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      byCategory,
      topMerchants,
      allExpenses6m,
      currentMonthTotal,
      previousMonthTotal,
    ] = await Promise.all([
      // Expenses grouped by category (all time)
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { userId },
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

    // Unusual expenses detection (amount > 2x average of last 30 days)
    const avgAmount =
      allExpenses6m.length > 0
        ? allExpenses6m.reduce((sum, e) => sum + e.amount, 0) / allExpenses6m.length
        : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const unusualExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
        amount: { gt: avgAmount * 2 },
      },
      orderBy: { amount: 'desc' },
      take: 5,
    });

    const currentTotal = currentMonthTotal._sum.amount || 0;
    const prevTotal = previousMonthTotal._sum.amount || 0;
    const monthGrowth =
      prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

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
    };
  }

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
    };
  }
}
