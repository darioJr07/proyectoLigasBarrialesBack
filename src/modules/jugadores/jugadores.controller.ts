import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JugadoresService } from './jugadores.service';
import { CreateJugadorDto } from './dto/create-jugador.dto';
import { UpdateJugadorDto } from './dto/update-jugador.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de jugadores
 * Maneja endpoints REST para gestión de jugadores
 */
@Controller('jugadores')
@UseGuards(JwtAuthGuard)
export class JugadoresController {
  constructor(private readonly jugadoresService: JugadoresService) {}

  @Post()
  create(@Body() createJugadorDto: CreateJugadorDto, @Request() req: any) {
    return this.jugadoresService.create(
      createJugadorDto,
      req.user.userId,
      req.user.role,
      req.user.ligaId,
    );
  }

  @Get()
  findAll(@Request() req: any) {
    return this.jugadoresService.findAll(req.user);
  }

  @Get('equipo/:equipoId')
  findByEquipo(@Param('equipoId') equipoId: string) {
    return this.jugadoresService.findByEquipo(+equipoId);
  }

  @Get('libres')
  findLibres() {
    return this.jugadoresService.findLibres();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jugadoresService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateJugadorDto: UpdateJugadorDto,
    @Request() req: any,
  ) {
    return this.jugadoresService.update(
      +id,
      updateJugadorDto,
      req.user.userId,
      req.user.role,
      req.user.ligaId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.jugadoresService.remove(+id, req.user.role, req.user.ligaId);
  }

  @Delete(':id/permanente')
  removePermanently(@Param('id') id: string, @Request() req: any) {
    return this.jugadoresService.removePermanently(+id, req.user.role);
  }
}
