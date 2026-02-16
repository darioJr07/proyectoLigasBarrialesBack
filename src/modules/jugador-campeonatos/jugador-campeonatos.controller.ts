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
import { JugadorCampeonatosService } from './jugador-campeonatos.service';
import { CreateJugadorCampeonatoDto } from './dto/create-jugador-campeonato.dto';
import { UpdateJugadorCampeonatoDto } from './dto/update-jugador-campeonato.dto';
import { AprobarHabilitacionDto } from './dto/aprobar-habilitacion.dto';
import { RechazarHabilitacionDto } from './dto/rechazar-habilitacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('jugador-campeonatos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JugadorCampeonatosController {
  constructor(private readonly jugadorCampeonatosService: JugadorCampeonatosService) {}

  @Post()
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  create(@Body() createDto: CreateJugadorCampeonatoDto, @Request() req: any) {
    return this.jugadorCampeonatosService.create(createDto, req.user);
  }

  @Get()
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findAll(@Request() req: any) {
    return this.jugadorCampeonatosService.findAll(req.user);
  }

  @Get('pendientes')
  @Roles('master', 'directivo_liga')
  findPendientes(@Request() req: any) {
    return this.jugadorCampeonatosService.findPendientes(req.user);
  }

  @Get(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.jugadorCampeonatosService.findOne(id, req.user);
  }

  @Get('campeonato/:campeonatoId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByCampeonato(@Param('campeonatoId', ParseIntPipe) campeonatoId: number, @Request() req: any) {
    return this.jugadorCampeonatosService.findByCampeonato(campeonatoId, req.user);
  }

  @Get('campeonato/:campeonatoId/disponibles-transferencia')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findDisponiblesParaTransferencia(
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Request() req: any,
  ) {
    return this.jugadorCampeonatosService.findDisponiblesParaTransferencia(campeonatoId, req.user);
  }

  @Get('campeonato/:campeonatoId/equipo/:equipoId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByCampeonatoAndEquipo(
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Param('equipoId', ParseIntPipe) equipoId: number,
    @Request() req: any,
  ) {
    return this.jugadorCampeonatosService.findByCampeonatoAndEquipo(campeonatoId, equipoId, req.user);
  }

  @Get('jugador/:jugadorId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByJugador(@Param('jugadorId', ParseIntPipe) jugadorId: number) {
    return this.jugadorCampeonatosService.findByJugador(jugadorId);
  }

  @Patch(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateJugadorCampeonatoDto,
    @Request() req: any,
  ) {
    return this.jugadorCampeonatosService.update(id, updateDto, req.user);
  }

  @Patch(':id/aprobar')
  @Roles('master', 'directivo_liga')
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprobarHabilitacionDto,
    @Request() req: any,
  ) {
    return this.jugadorCampeonatosService.aprobar(id, dto, req.user);
  }

  @Patch(':id/rechazar')
  @Roles('master', 'directivo_liga')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarHabilitacionDto,
    @Request() req: any,
  ) {
    return this.jugadorCampeonatosService.rechazar(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('master', 'directivo_liga')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.jugadorCampeonatosService.remove(id, req.user);
  }
}
