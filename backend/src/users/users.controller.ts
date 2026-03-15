import {
  Controller,
  Get,
  Put,
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
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADVISOR)
  @ApiOperation({ summary: 'Listar todos los usuarios (solo ADVISOR)' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios.' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Resumen financiero de un usuario' })
  getSummary(@Param('id') id: string) {
    return this.usersService.getUserSummary(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar perfil de usuario' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, req.user.id, req.user.role, dto);
  }
}
