import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Category, Role } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo gasto' })
  create(@Request() req, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar gastos (filtrable)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'category', required: false, enum: Category })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('category') category?: Category,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.expensesService.findAll({
      requesterId: req.user.id,
      requesterRole: req.user.role as Role,
      userId,
      category,
      startDate,
      endDate,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Resumen analítico de gastos del usuario autenticado' })
  @ApiQuery({ name: 'period', required: false, enum: ['month', 'year', 'all'] })
  getMyAnalytics(@Request() req, @Query('period') period?: 'month' | 'year' | 'all') {
    return this.expensesService.getAnalytics(req.user.id, period ?? 'all');
  }

  @Get('analytics/:userId')
  @Roles(Role.ADVISOR)
  @ApiOperation({ summary: 'Resumen analítico de gastos de un usuario (ADVISOR)' })
  @ApiQuery({ name: 'period', required: false, enum: ['month', 'year', 'all'] })
  getAnalytics(@Param('userId') userId: string, @Query('period') period?: 'month' | 'year' | 'all') {
    return this.expensesService.getAnalytics(userId, period ?? 'all');
  }

  @Get('patterns/:userId')
  @Roles(Role.ADVISOR)
  @ApiOperation({ summary: 'Patrones de consumo de un usuario (ADVISOR)' })
  getPatterns(@Param('userId') userId: string) {
    return this.expensesService.getPatterns(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener gasto por ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.expensesService.findOne(id, req.user.id, req.user.role);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un gasto' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, req.user.id, req.user.role, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un gasto' })
  remove(@Param('id') id: string, @Request() req) {
    return this.expensesService.remove(id, req.user.id, req.user.role);
  }
}
