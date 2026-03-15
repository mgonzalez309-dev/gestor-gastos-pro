import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecommendationDto {
  @ApiProperty({ description: 'ID del usuario destinatario' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'Reducí gastos en entretenimiento un 20% respecto al mes anterior.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    enum: ['GENERAL', 'ALERT', 'SAVING', 'PATTERN'],
    default: 'GENERAL',
  })
  @IsString()
  @IsIn(['GENERAL', 'ALERT', 'SAVING', 'PATTERN'])
  @IsOptional()
  type?: string;
}
