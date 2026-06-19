import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SavingsGoalsService } from './savings-goals.service';
import { PrismaService } from '../prisma/prisma.service';

function createPrismaMock() {
  return {
    savingsGoal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('SavingsGoalsService', () => {
  let service: SavingsGoalsService;
  let prisma: PrismaMock;

  const baseGoal = {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Vacaciones',
    targetAmount: 1000000,
    currentAmount: 0,
    targetDate: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SavingsGoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SavingsGoalsService>(SavingsGoalsService);
  });

  describe('create', () => {
    it('crea la meta con currentAmount 0 si no se especifica', async () => {
      prisma.savingsGoal.create.mockResolvedValue({ ...baseGoal });

      const result = await service.create('user-1', { name: 'Vacaciones', targetAmount: 1000000 });

      expect(prisma.savingsGoal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', currentAmount: 0 }),
      });
      expect(result.progressPct).toBe(0);
      expect(result.isCompleted).toBe(false);
    });
  });

  describe('findAllByUser', () => {
    it('agrega progressPct, remaining e isCompleted a cada meta', async () => {
      prisma.savingsGoal.findMany.mockResolvedValue([
        { ...baseGoal, currentAmount: 250000 },
      ]);

      const [result] = await service.findAllByUser('user-1');

      expect(result.progressPct).toBe(25);
      expect(result.remaining).toBe(750000);
      expect(result.isCompleted).toBe(false);
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si la meta no existe', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('goal-x', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si la meta es de otro usuario', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal, userId: 'otro-usuario' });

      await expect(service.findOne('goal-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('devuelve la meta con progreso si el usuario es el dueño', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal });

      const result = await service.findOne('goal-1', 'user-1');

      expect(result.id).toBe('goal-1');
    });
  });

  describe('addContribution', () => {
    it('suma el aporte al currentAmount existente', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal, currentAmount: 300000 });
      prisma.savingsGoal.update.mockResolvedValue({ ...baseGoal, currentAmount: 650000 });

      const result = await service.addContribution('goal-1', 'user-1', 350000);

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-1' },
        data: { currentAmount: 650000 }, // 300000 + 350000, calculado por el servicio
      });
      expect(result.currentAmount).toBe(650000);
    });

    it('cappea progressPct en 100% aunque el aporte supere el objetivo', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal, currentAmount: 900000 });
      prisma.savingsGoal.update.mockResolvedValue({ ...baseGoal, currentAmount: 1200000 });

      const result = await service.addContribution('goal-1', 'user-1', 300000);

      expect(result.currentAmount).toBe(1200000); // el valor crudo no se trunca
      expect(result.progressPct).toBe(100);        // pero el % visual sí
      expect(result.isCompleted).toBe(true);
    });

    it('no permite aportar a la meta de otro usuario', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal, userId: 'otro-usuario' });

      await expect(service.addContribution('goal-1', 'user-1', 1000)).rejects.toThrow(ForbiddenException);
      expect(prisma.savingsGoal.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina la meta si el usuario es el dueño', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal });
      prisma.savingsGoal.delete.mockResolvedValue(baseGoal);

      const result = await service.remove('goal-1', 'user-1');

      expect(prisma.savingsGoal.delete).toHaveBeenCalledWith({ where: { id: 'goal-1' } });
      expect(result.message).toBeDefined();
    });

    it('no permite eliminar la meta de otro usuario', async () => {
      prisma.savingsGoal.findUnique.mockResolvedValue({ ...baseGoal, userId: 'otro-usuario' });

      await expect(service.remove('goal-1', 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.savingsGoal.delete).not.toHaveBeenCalled();
    });
  });
});
