import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '@prisma/client';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Supermercado La Anónima' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  merchant: string;

  @ApiProperty({ example: 1250.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: Category, example: Category.FOOD })
  @IsEnum(Category)
  category: Category;

  @ApiProperty({ example: '2024-03-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'Compras de la semana' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'ID del ticket asociado (opcional)' })
  @IsString()
  @IsOptional()
  ticketId?: string;
}
