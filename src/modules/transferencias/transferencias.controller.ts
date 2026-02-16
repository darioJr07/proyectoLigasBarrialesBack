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
import { TransferenciasService } from './transferencias.service';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { AprobarTransferenciaDto } from './dto/aprobar-transferencia.dto';
import { RechazarTransferenciaDto } from './dto/rechazar-transferencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('transferencias')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransferenciasController {
  constructor(private readonly transferenciasService: TransferenciasService) {}

  @Post()
  @Roles('master', 'dirigente_equipo')
  create(@Body() createDto: CreateTransferenciaDto, @Request() req: any) {
    return this.transferenciasService.create(createDto, req.user);
  }

  @Get()
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findAll(@Request() req: any) {
    return this.transferenciasService.findAll(req.user);
  }

  @Get('pendientes-equipo-origen')
  @Roles('master', 'dirigente_equipo')
  findPendientesEquipoOrigen(@Request() req: any) {
    return this.transferenciasService.findPendientesEquipoOrigen(req.user);
  }

  @Get('pendientes-directivo')
  @Roles('master', 'directivo_liga')
  findPendientesDirectivo(@Request() req: any) {
    return this.transferenciasService.findPendientesDirectivo(req.user);
  }

  @Get(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.transferenciasService.findOne(id, req.user);
  }

  @Get('campeonato/:campeonatoId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByCampeonato(@Param('campeonatoId', ParseIntPipe) campeonatoId: number, @Request() req: any) {
    return this.transferenciasService.findByCampeonato(campeonatoId, req.user);
  }

  @Get('jugador/:jugadorId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByJugador(@Param('jugadorId', ParseIntPipe) jugadorId: number) {
    return this.transferenciasService.findByJugador(jugadorId);
  }

  @Patch(':id/aprobar-equipo-origen')
  @Roles('master', 'dirigente_equipo')
  aprobarPorEquipoOrigen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprobarTransferenciaDto,
    @Request() req: any,
  ) {
    return this.transferenciasService.aprobarPorEquipoOrigen(id, dto, req.user);
  }

  @Patch(':id/rechazar-equipo-origen')
  @Roles('master', 'dirigente_equipo')
  rechazarPorEquipoOrigen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarTransferenciaDto,
    @Request() req: any,
  ) {
    return this.transferenciasService.rechazarPorEquipoOrigen(id, dto, req.user);
  }

  @Patch(':id/aprobar-directivo')
  @Roles('master', 'directivo_liga')
  aprobarPorDirectivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprobarTransferenciaDto,
    @Request() req: any,
  ) {
    return this.transferenciasService.aprobarPorDirectivo(id, dto, req.user);
  }

  @Patch(':id/rechazar-directivo')
  @Roles('master', 'directivo_liga')
  rechazarPorDirectivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarTransferenciaDto,
    @Request() req: any,
  ) {
    return this.transferenciasService.rechazarPorDirectivo(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('master', 'dirigente_equipo')
  cancelar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.transferenciasService.cancelar(id, req.user);
  }
}
