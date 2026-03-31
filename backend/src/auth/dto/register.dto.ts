import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'juan@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MiContraseña123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}
