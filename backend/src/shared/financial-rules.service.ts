import { Injectable } from '@nestjs/common';

/**
 * Estructuras mínimas que necesita el motor de reglas. Coinciden con el
 * shape devuelto por ExpensesService.getAnalytics() / getPatterns(),
 * pero se definen acá para no acoplar este módulo al de expenses.
 */
export interface AnalyticsForRules {
  monthGrowth: number;
  unusualExpenses: Array<{ id: string; merchant: string; amount: number }>;
  byCategory: Array<{ category: string; total: number; count: number }>;
  currentMonth: { total: number; count: number };
  averageExpense: number;
}

export interface PatternsForRules {
  trends?: Array<{ category: string; trend: string; change: number }>;
}

export interface UserBudgetForRules {
  monthlyIncome?: number | null;
  savingsGoal?: number | null;
  // Prisma lo tipa como Json; se castea internamente en evaluateBudgetExceeded.
  categoryBudgets?: unknown;
}

/**
 * Resultado neutral de una regla evaluada: solo datos, sin texto.
 * Cada consumidor (RecommendationsService, NotificationsService) decide
 * su propio mensaje/copy a partir de estos datos — así cada uno mantiene
 * su tono (con emoji, sin emoji, con título, etc.) sin duplicar el cálculo
 * de la condición en sí.
 */
export interface FinancialSignal<TData = Record<string, unknown>> {
  key: string;
  data: TData;
}

/**
 * Motor de reglas financieras compartido entre RecommendationsService
 * (recomendaciones curadas por asesor/IA) y NotificationsService
 * (alertas automáticas del sistema). Antes del refactor, las condiciones
 * "crecimiento mensual > 20%" y "gasto inusual detectado" estaban
 * copiadas literalmente en ambos servicios. Acá viven una sola vez.
 */
@Injectable()
export class FinancialRulesService {

  /** Crecimiento de gasto mensual por encima del umbral (default 20%). */
  evaluateMonthGrowth(
    analytics: AnalyticsForRules,
    threshold = 20,
  ): FinancialSignal<{ growthPct: number }> | null {
    if (analytics.monthGrowth <= threshold) return null;
    return { key: 'MONTH_GROWTH', data: { growthPct: analytics.monthGrowth } };
  }

  /** Gasto individual anómalo (ExpensesService ya filtra >5x el promedio). */
  evaluateUnusualExpense(
    analytics: AnalyticsForRules,
  ): FinancialSignal<{ expenseId: string; merchant: string; amount: number }> | null {
    if (!analytics.unusualExpenses?.length) return null;
    const top = analytics.unusualExpenses[0];
    return {
      key: 'UNUSUAL_EXPENSE',
      data: { expenseId: top.id, merchant: top.merchant, amount: top.amount },
    };
  }

  /** Categoría con mayor concentración de gasto. */
  evaluateTopCategory(
    analytics: AnalyticsForRules,
  ): FinancialSignal<{ category: string; total: number }> | null {
    if (!analytics.byCategory?.length) return null;
    const topCat = analytics.byCategory[0];
    return { key: 'TOP_CATEGORY', data: { category: topCat.category, total: topCat.total } };
  }

  /** Categorías con tendencia de gasto creciente (hasta `limit`). */
  evaluateIncreasingTrends(
    patterns: PatternsForRules,
    limit = 2,
  ): Array<FinancialSignal<{ category: string; changePct: number }>> {
    const increasing = patterns.trends?.filter((t) => t.trend === 'increasing') || [];
    return increasing.slice(0, limit).map((trend) => ({
      key: 'INCREASING_TREND',
      data: { category: trend.category, changePct: trend.change },
    }));
  }

  /** Gasto del mes por encima del promedio histórico (factor configurable). */
  evaluateAboveAverageSpending(
    analytics: AnalyticsForRules,
    factor = 1.2,
  ): FinancialSignal<Record<string, never>> | null {
    const threshold = analytics.averageExpense * analytics.currentMonth.count * factor;
    if (analytics.currentMonth.total <= threshold) return null;
    return { key: 'ABOVE_AVERAGE', data: {} };
  }

  /** Riesgo de consumir (o estar cerca de consumir) la meta de ahorro mensual. */
  evaluateSavingsRisk(
    analytics: AnalyticsForRules,
    user: UserBudgetForRules,
  ): FinancialSignal<{ overBudget: boolean; freeLeft: number; freeBudget: number; savingsGoal: number }> | null {
    if (!user.monthlyIncome || !user.savingsGoal) return null;

    const freeBudget = user.monthlyIncome - user.savingsGoal;
    const spent = analytics.currentMonth?.total || 0;
    const freeLeft = freeBudget - spent;

    if (freeLeft < 0) {
      return {
        key: 'SAVINGS_RISK',
        data: { overBudget: true, freeLeft, freeBudget, savingsGoal: user.savingsGoal },
      };
    }
    if (freeLeft < freeBudget * 0.15) {
      return {
        key: 'SAVINGS_RISK',
        data: { overBudget: false, freeLeft, freeBudget, savingsGoal: user.savingsGoal },
      };
    }
    return null;
  }

  /** Presupuestos por categoría excedidos (uno por cada categoría que se pasó del límite). */
  evaluateBudgetExceeded(
    analytics: AnalyticsForRules,
    user: UserBudgetForRules,
  ): Array<FinancialSignal<{ category: string; budget: number; spent: number; excess: number }>> {
    const budgets = (user.categoryBudgets as Record<string, number>) || {};
    const signals: Array<FinancialSignal<{ category: string; budget: number; spent: number; excess: number }>> = [];

    for (const cat of analytics.byCategory || []) {
      const limit = budgets[cat.category];
      if (limit && limit > 0 && cat.total > limit) {
        signals.push({
          key: 'BUDGET_EXCEEDED',
          data: { category: cat.category, budget: limit, spent: cat.total, excess: cat.total - limit },
        });
      }
    }
    return signals;
  }
}
