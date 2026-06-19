import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddContributionDto {
  @ApiProperty({ example: 5000, description: 'Monto a sumar al ahorro acumulado de la meta' })
  @IsNumber()
  @Min(0.01)
  amount: number;
}
