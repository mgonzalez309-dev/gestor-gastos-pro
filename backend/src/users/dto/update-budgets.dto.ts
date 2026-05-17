import { IsObject, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBudgetsDto {
  @ApiPropertyOptional({
    description: 'Presupuesto mensual por categoría en formato {CATEGORY: monto}',
    example: { FOOD: 5000, TRANSPORT: 2000, ENTERTAINMENT: 1500 },
  })
  @IsObject()
  budgets: Record<string, number>;
}
