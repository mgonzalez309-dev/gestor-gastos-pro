import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';
import { SavingsGoal } from '@prisma/client';

@Injectable()
export class SavingsGoalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSavingsGoalDto) {
    const goal = await this.prisma.savingsGoal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
    });

    return this.withProgress(goal);
  }

  async findAllByUser(userId: string) {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map((g) => this.withProgress(g));
  }

  async findOne(id: string, userId: string) {
    const goal = await this.findOwned(id, userId);
    return this.withProgress(goal);
  }

  async update(id: string, userId: string, dto: UpdateSavingsGoalDto) {
    await this.findOwned(id, userId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined)          data.name          = dto.name;
    if (dto.targetAmount !== undefined)  data.targetAmount  = dto.targetAmount;
    if (dto.currentAmount !== undefined) data.currentAmount = dto.currentAmount;
    if (dto.targetDate !== undefined)    data.targetDate    = dto.targetDate ? new Date(dto.targetDate) : null;

    const updated = await this.prisma.savingsGoal.update({ where: { id }, data });
    return this.withProgress(updated);
  }

  /** Suma un aporte al monto ahorrado de la meta (evita que el frontend tenga que leer y recalcular el total). */
  async addContribution(id: string, userId: string, amount: number) {
    const goal = await this.findOwned(id, userId);

    const updated = await this.prisma.savingsGoal.update({
      where: { id },
      data: { currentAmount: goal.currentAmount + amount },
    });

    return this.withProgress(updated);
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.savingsGoal.delete({ where: { id } });
    return { message: 'Meta de ahorro eliminada correctamente.' };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async findOwned(id: string, userId: string): Promise<SavingsGoal> {
    const goal = await this.prisma.savingsGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException(`Meta de ahorro con id "${id}" no encontrada.`);
    }
    if (goal.userId !== userId) {
      throw new ForbiddenException('No tenés acceso a esta meta de ahorro.');
    }
    return goal;
  }

  /** Agrega campos derivados (% de progreso, si se completó, cuánto falta) sin persistirlos. */
  private withProgress(goal: SavingsGoal) {
    const progressPct = goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 10000) / 100)
      : 0;
    const remaining = Math.max(0, Math.round((goal.targetAmount - goal.currentAmount) * 100) / 100);
    const isCompleted = goal.currentAmount >= goal.targetAmount;

    let daysLeft: number | null = null;
    if (goal.targetDate) {
      const diffMs = new Date(goal.targetDate).getTime() - Date.now();
      daysLeft = Math.ceil(diffMs / 86400000);
    }

    return { ...goal, progressPct, remaining, isCompleted, daysLeft };
  }
}
