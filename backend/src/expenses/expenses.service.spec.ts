import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mock mínimo de PrismaService — solo los métodos que getAnalytics() usa.
 * Se inyecta vía DI real de Nest (Test.createTestingModule) para que el
 * test ejercite el mismo flujo que en producción, sin pegarle a una DB real.
 */
function createPrismaMock() {
  return {
    expense: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpensesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('getAnalytics', () => {
    /**
     * getAnalytics() resuelve, dentro de un Promise.all, en este orden:
     * groupBy(categoría) -> groupBy(comercio) -> findMany(6 meses) ->
     * aggregate(mes actual) -> aggregate(mes anterior). Luego, por fuera
     * del Promise.all: findMany(gastos inusuales) y user.findUnique.
     */
    function mockAnalyticsQueries(opts: {
      byCategory?: unknown[];
      topMerchants?: unknown[];
      allExpenses6m?: Array<{ amount: number; date: Date; category: string }>;
      currentMonthAgg?: { _sum: { amount: number | null }; _count: number };
      previousMonthAgg?: { _sum: { amount: number | null } };
      unusualExpenses?: unknown[];
      userRecord?: { savingsGoal: number | null; monthlyIncome: number | null } | null;
    }) {
      prisma.expense.groupBy
        .mockResolvedValueOnce(opts.byCategory ?? [])
        .mockResolvedValueOnce(opts.topMerchants ?? []);

      prisma.expense.findMany
        .mockResolvedValueOnce(opts.allExpenses6m ?? [])
        .mockResolvedValueOnce(opts.unusualExpenses ?? []);

      prisma.expense.aggregate
        .mockResolvedValueOnce(opts.currentMonthAgg ?? { _sum: { amount: 0 }, _count: 0 })
        .mockResolvedValueOnce(opts.previousMonthAgg ?? { _sum: { amount: 0 } });

      prisma.user.findUnique.mockResolvedValueOnce(opts.userRecord ?? null);
    }

    it('usa un umbral de 5x el promedio para detectar gastos inusuales (no 2x)', async () => {
      // Regresión directa del bug encontrado en auditoría: el umbral original
      // era 2x el promedio; el requisito pide 5x. Este test falla si alguien
      // lo revierte a 2x sin querer.
      const allExpenses6m = [
        { amount: 900, date: new Date(), category: 'FOOD' },
        { amount: 1000, date: new Date(), category: 'FOOD' },
        { amount: 1100, date: new Date(), category: 'FOOD' },
      ];
      // promedio = (900+1000+1100)/3 = 1000 -> umbral esperado = 1000 * 5 = 5000

      mockAnalyticsQueries({ allExpenses6m });

      await service.getAnalytics('user-1', 'all');

      const unusualCallArgs = prisma.expense.findMany.mock.calls[1][0];
      expect(unusualCallArgs.where.amount.gt).toBeCloseTo(5000);
    });

    it('calcula monthGrowth como el % de variación entre mes actual y anterior', async () => {
      mockAnalyticsQueries({
        currentMonthAgg: { _sum: { amount: 1200 }, _count: 3 },
        previousMonthAgg: { _sum: { amount: 1000 } },
      });

      const result = await service.getAnalytics('user-1', 'all');

      expect(result.monthGrowth).toBeCloseTo(20);
      expect(result.currentMonth.total).toBe(1200);
      expect(result.previousMonth.total).toBe(1000);
    });

    it('monthGrowth es 0 si no hubo gasto el mes anterior (evita división por cero)', async () => {
      mockAnalyticsQueries({
        currentMonthAgg: { _sum: { amount: 500 }, _count: 1 },
        previousMonthAgg: { _sum: { amount: 0 } },
      });

      const result = await service.getAnalytics('user-1', 'all');

      expect(result.monthGrowth).toBe(0);
    });

    it.each([
      [950, 1000, 'IMPULSIVO'],
      [750, 1000, 'ACTIVO'],
      [600, 1000, 'EQUILIBRADO'],
      [300, 1000, 'AHORRADOR'],
    ])(
      'gastar %i de un ingreso de %i clasifica financialProfile como %s',
      async (spent, income, expected) => {
        mockAnalyticsQueries({
          currentMonthAgg: { _sum: { amount: spent }, _count: 1 },
          previousMonthAgg: { _sum: { amount: 0 } },
          userRecord: { savingsGoal: null, monthlyIncome: income },
        });

        const result = await service.getAnalytics('user-1', 'all');

        expect(result.financialProfile).toBe(expected);
      },
    );

    it('financialProfile es null si el usuario no configuró ingreso mensual', async () => {
      mockAnalyticsQueries({
        userRecord: { savingsGoal: null, monthlyIncome: null },
      });

      const result = await service.getAnalytics('user-1', 'all');

      expect(result.financialProfile).toBeNull();
    });

    it('expone la meta de ahorro del usuario en la respuesta', async () => {
      mockAnalyticsQueries({
        userRecord: { savingsGoal: 5000, monthlyIncome: 20000 },
      });

      const result = await service.getAnalytics('user-1', 'all');

      expect(result.savingsGoal).toBe(5000);
    });
  });
});
