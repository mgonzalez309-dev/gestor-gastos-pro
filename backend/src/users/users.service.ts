import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        currency: true,
        age: true,
        monthlyIncome: true,
        createdAt: true,
        _count: {
          select: { expenses: true, tickets: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        currency: true,
        age: true,
        monthlyIncome: true,
        createdAt: true,
        _count: {
          select: { expenses: true, tickets: true, receivedRecommendations: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con id "${id}" no encontrado.`);
    }

    return user;
  }

  async update(id: string, requesterId: string, requesterRole: Role, dto: UpdateUserDto) {
    // A user can only update their own profile; advisors can update any
    if (requesterRole !== Role.ADVISOR && requesterId !== id) {
      throw new ForbiddenException('Solo podés editar tu propio perfil.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con id "${id}" no encontrado.`);
    }

    const data: any = {};
    if (dto.name)         data.name         = dto.name;
    if (dto.email)        data.email        = dto.email;
    if (dto.password)     data.password     = await bcrypt.hash(dto.password, 12);
    if (dto.currency)     data.currency     = dto.currency;
    if (dto.age !== undefined)           data.age           = dto.age;
    if (dto.monthlyIncome !== undefined) data.monthlyIncome = dto.monthlyIncome;

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        currency: true,
        age: true,
        monthlyIncome: true,
        updatedAt: true,
      },
    });
  }

  async getUserSummary(userId: string) {
    const user = await this.findOne(userId);

    const [totalExpenses, latestExpenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { userId },
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true },
      }),
      this.prisma.expense.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          merchant: true,
          amount: true,
          category: true,
          date: true,
        },
      }),
    ]);

    return {
      user,
      stats: {
        totalAmount: totalExpenses._sum.amount || 0,
        totalCount: totalExpenses._count,
        averageAmount: totalExpenses._avg.amount || 0,
      },
      latestExpenses,
    };
  }
}
