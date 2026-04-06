import { IsString, IsOptional, MinLength, MaxLength, IsEmail, IsIn, IsInt, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SUPPORTED_CURRENCIES = ['ARS','USD','EUR','BRL','CLP','MXN','UYU','GBP'] as const;

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'nueva@email.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'NuevaContraseña123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'USD', enum: SUPPORTED_CURRENCIES })
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES, { message: 'Moneda no soportada.' })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 28 })
  @IsInt()
  @Min(1)
  @Max(120)
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ example: 150000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyIncome?: number;

  @ApiPropertyOptional({ example: 30000, description: 'Monto mensual a destinar al ahorro' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  savingsGoal?: number;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,...' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
