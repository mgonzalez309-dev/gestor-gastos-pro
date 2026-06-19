import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { ExpensesService } from '../expenses/expenses.service';
import { FinancialRulesService } from '../shared/financial-rules.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private prisma: PrismaService,
    private expensesService: ExpensesService,
    private financialRules: FinancialRulesService,
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
   *
   * El cálculo de cada condición (¿creció mucho el gasto?, ¿hay un gasto
   * inusual?, etc.) vive en FinancialRulesService, compartido con
   * NotificationsService. Acá solo se decide CÓMO redactar y categorizar
   * cada señal como Recommendation (tipo + copy con emoji).
   */
  async autoGenerate(userId: string, advisorId: string) {
    const [analytics, patterns] = await Promise.all([
      this.expensesService.getAnalytics(userId),
      this.expensesService.getPatterns(userId),
    ]);

    const recommendations: Array<{ message: string; type: string }> = [];

    // 1. Alert for high month-over-month growth
    const growth = this.financialRules.evaluateMonthGrowth(analytics);
    if (growth) {
      recommendations.push({
        type: 'ALERT',
        message: `⚠️ Tu gasto mensual aumentó un ${growth.data.growthPct.toFixed(1)}% respecto al mes anterior. Revisá tus gastos para identificar áreas de ahorro.`,
      });
    }

    // 2. Unusual expenses
    const unusual = this.financialRules.evaluateUnusualExpense(analytics);
    if (unusual) {
      recommendations.push({
        type: 'ALERT',
        message: `🔍 Se detectó un gasto inusualmente alto en "${unusual.data.merchant}" por $${unusual.data.amount.toFixed(2)}. Verificá si fue un gasto puntual o recurrente.`,
      });
    }

    // 3. Top spending categories
    const topCategory = this.financialRules.evaluateTopCategory(analytics);
    if (topCategory) {
      recommendations.push({
        type: 'PATTERN',
        message: `📊 Tu mayor gasto se concentra en la categoría "${topCategory.data.category}" ($${topCategory.data.total.toFixed(2)}). Considerá establecer un presupuesto mensual para esta categoría.`,
      });
    }

    // 4. Increasing category trends
    const increasingTrends = this.financialRules.evaluateIncreasingTrends(patterns, 2);
    for (const trend of increasingTrends) {
      recommendations.push({
        type: 'SAVING',
        message: `📈 Los gastos en "${trend.data.category}" aumentaron un ${trend.data.changePct.toFixed(1)}% respecto al mes anterior. Te recomendamos revisarlos para optimizar tu presupuesto.`,
      });
    }

    // 5. General savings tip if spending is above average
    const aboveAverage = this.financialRules.evaluateAboveAverageSpending(analytics, 1.2);
    if (aboveAverage) {
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
