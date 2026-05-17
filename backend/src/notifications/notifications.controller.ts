import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Genera notificaciones automáticas basadas en los analytics del usuario.
   *  El frontend lo llama al cargar el dashboard. Tiene cooldown de 24 h por tipo.
   */
  @Post('generate')
  @ApiOperation({ summary: 'Generar notificaciones automáticas para el usuario autenticado' })
  generate(@Request() req) {
    return this.notificationsService.generate(req.user.id).then((count) => ({
      generated: count,
      message: count > 0
        ? `Se generaron ${count} notificación(es).`
        : 'No hay notificaciones nuevas por el momento.',
    }));
  }

  @Get()
  @ApiOperation({ summary: 'Obtener notificaciones del usuario (máx. 50, sin-leer primero)' })
  @ApiQuery({ name: 'unread', required: false, description: 'Si es "true", devuelve solo las no leídas' })
  findAll(@Request() req, @Query('unread') unread?: string) {
    return this.notificationsService.findAll(req.user.id, unread === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cantidad de notificaciones no leídas' })
  async countUnread(@Request() req) {
    const count = await this.notificationsService.countUnread(req.user.id);
    return { count };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  markRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  markAllRead(@Request() req) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Delete('clear-all')
  @ApiOperation({ summary: 'Eliminar todas las notificaciones del usuario' })
  clearAll(@Request() req) {
    return this.notificationsService.clearAll(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una notificación específica' })
  remove(@Param('id') id: string, @Request() req) {
    return this.notificationsService.remove(id, req.user.id);
  }
}
