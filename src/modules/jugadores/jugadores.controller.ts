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
  ParseIntPipe,
} from '@nestjs/common';
import { JugadoresService } from './jugadores.service';
import { CreateJugadorDto } from './dto/create-jugador.dto';
import { UpdateJugadorDto } from './dto/update-jugador.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Controlador de jugadores
 * Maneja endpoints REST para gestión de jugadores
 */
@Controller('jugadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('master', 'directivo_liga', 'dirigente_equipo')
export class JugadoresController {
  constructor(private readonly jugadoresService: JugadoresService) {}

  @Post()
  create(@Body() createJugadorDto: CreateJugadorDto, @Request() req: any) {
    return this.jugadoresService.create(
      createJugadorDto,
      req.user.userId,
      req.user.role,
      req.user.ligaId,
      req.user.equipoId,
    );
  }

  @Get()
  findAll(@Request() req: any) {
    return this.jugadoresService.findAll(req.user);
  }

  @Get('equipo/:equipoId')
  findByEquipo(
    @Param('equipoId', ParseIntPipe) equipoId: number,
    @Request() req: any,
  ) {
    return this.jugadoresService.findByEquipo(equipoId, req.user);
  }

  @Get('libres')
  findLibres(@Request() req: any) {
    return this.jugadoresService.findLibres(req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.jugadoresService.findOne(id, req.user);
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
      req.user.equipoId,
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
