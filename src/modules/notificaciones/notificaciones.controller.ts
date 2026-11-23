import { Controller, Get, Param, ParseIntPipe, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  listar(
    @Request() req: any,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificacionesService.listar(req.user, { estado, tipo, page, limit });
  }

  @Get('no-leidas/contador')
  contarNoLeidas(@Request() req: any) {
    return this.notificacionesService.contarNoLeidas(req.user);
  }

  @Patch('marcar-todas-leidas')
  marcarTodasLeidas(@Request() req: any) {
    return this.notificacionesService.marcarTodasLeidas(req.user);
  }

  @Patch(':id/leida')
  marcarLeida(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.notificacionesService.marcarLeida(id, req.user);
  }
}
