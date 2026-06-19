import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SavingsGoalsService } from './savings-goals.service';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';
import { AddContributionDto } from './dto/add-contribution.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('savings-goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('savings-goals')
export class SavingsGoalsController {
  constructor(private readonly savingsGoalsService: SavingsGoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una meta de ahorro' })
  create(@Request() req, @Body() dto: CreateSavingsGoalDto) {
    return this.savingsGoalsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar las metas de ahorro del usuario autenticado' })
  findAll(@Request() req) {
    return this.savingsGoalsService.findAllByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una meta de ahorro por ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.savingsGoalsService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una meta de ahorro' })
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateSavingsGoalDto) {
    return this.savingsGoalsService.update(id, req.user.id, dto);
  }

  @Post(':id/contribute')
  @ApiOperation({ summary: 'Sumar un aporte al monto ahorrado de la meta' })
  contribute(@Param('id') id: string, @Request() req, @Body() dto: AddContributionDto) {
    return this.savingsGoalsService.addContribution(id, req.user.id, dto.amount);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una meta de ahorro' })
  remove(@Param('id') id: string, @Request() req) {
    return this.savingsGoalsService.remove(id, req.user.id);
  }
}
