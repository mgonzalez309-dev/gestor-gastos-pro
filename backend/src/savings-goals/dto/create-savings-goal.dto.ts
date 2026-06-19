import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSavingsGoalDto {
  @ApiProperty({ example: 'Vacaciones en la playa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 1000000, description: 'Monto objetivo de la meta' })
  @IsNumber()
  @Min(0.01)
  targetAmount: number;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha límite para alcanzar la meta' })
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({ example: 0, description: 'Monto ya ahorrado hacia esta meta' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  currentAmount?: number;
}
