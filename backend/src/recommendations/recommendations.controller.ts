import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RecommendationsService } from './recommendations.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post()
  @Roles(Role.ADVISOR)
  @ApiOperation({ summary: 'Crear recomendación manual (solo ADVISOR)' })
  @ApiResponse({ status: 201, description: 'Recomendación creada.' })
  create(@Request() req, @Body() dto: CreateRecommendationDto) {
    return this.recommendationsService.create(req.user.id, dto);
  }

  @Post('auto-generate/:userId')
  @Roles(Role.ADVISOR)
  @ApiOperation({
    summary: 'Generar recomendaciones automáticas para un usuario (solo ADVISOR)',
  })
  autoGenerate(@Param('userId') userId: string, @Request() req) {
    return this.recommendationsService.autoGenerate(userId, req.user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Obtener mis recomendaciones (usuario autenticado)' })
  getMyRecommendations(@Request() req) {
    return this.recommendationsService.findByUser(req.user.id);
  }

  @Get(':userId')
  @Roles(Role.ADVISOR)
  @ApiOperation({ summary: 'Obtener recomendaciones de un usuario (solo ADVISOR)' })
  findByUser(@Param('userId') userId: string) {
    return this.recommendationsService.findByUser(userId);
  }
}
