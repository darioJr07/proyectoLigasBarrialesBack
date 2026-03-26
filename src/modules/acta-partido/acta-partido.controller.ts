import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActaPartidoService } from './acta-partido.service';
import { GuardarAlineacionDto } from './dto/guardar-alineacion.dto';
import { GuardarInformePartidoDto } from './dto/guardar-informe-partido.dto';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';

/**
 * Controlador del Acta Digital de Partido
 *
 * ENDPOINTS:
 *
 * GET /acta-partido/:partidoId/jugadores-disponibles  → Jugadores habilitados con estado sugerido
 * GET /acta-partido/:partidoId/informe                 → Informe del vocal + incidencias
 * GET /acta-partido/campeonato/:campeonatoId/incidencias → Incidencias pendientes (tribunal)
 * PUT /acta-partido/:partidoId/alineacion             → Guardar/actualizar alineación completa
 * PUT /acta-partido/:partidoId/informe                 → El vocal guarda informe + incidencias
 * PUT /acta-partido/incidencias/:incidenciaId/resolver → El tribunal resuelve una incidencia
 * GET /acta-partido/:partidoId                        → Alineación ya guardada
 */
@Controller('acta-partido')
@UseGuards(JwtAuthGuard)
export class ActaPartidoController {
  constructor(private readonly actaService: ActaPartidoService) {}

  // ── TRIBUNAL: incidencias pendientes (ruta fija ANTES de :partidoId) ───────────────

  /**
   * GET /acta-partido/campeonato/:campeonatoId/incidencias
   *
   * Lista todas las incidencias disciplinarias pendientes de resolución
   * para un campeonato. Es la vista principal del Tribunal de Penas.
   *
   * NOTA DE ROUTING: Esta ruta tiene 3 segmentos (campeonato/:id/incidencias)
   * mientras que :partidoId solo tiene 1, por lo tanto no hay conflicto.
   * Roles: master, directivo_liga
   */
  @Get('campeonato/:campeonatoId/incidencias')
  listarIncidenciasPendientes(
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Request() req: any,
  ) {
    return this.actaService.listarIncidenciasPendientes(campeonatoId, req.user);
  }

  /**
   * PUT /acta-partido/incidencias/:incidenciaId/resolver
   *
   * El Tribunal de Penas resuelve una incidencia:
   * si decision='sancionar' → crea una Sancion automáticamente.
   * si decision='absolver'  → la cierra sin crear sanción.
   * Roles: master, directivo_liga
   */
  @Put('incidencias/:incidenciaId/resolver')
  resolverIncidencia(
    @Param('incidenciaId', ParseIntPipe) incidenciaId: number,
    @Body() dto: ResolverIncidenciaDto,
    @Request() req: any,
  ) {
    return this.actaService.resolverIncidencia(incidenciaId, dto, req.user);
  }

  // ── VOCAL: informe y alineación por partido ──────────────────────────────────

  /**
   * GET /acta-partido/:partidoId/jugadores-disponibles
   *
   * Retorna los jugadores habilitados de ambos equipos pre-cargados,
   * marcando automáticamente como 'suspendido' a quienes tengan sanción activa.
   * Útil para pre-llenar el acta antes de editarla manualmente.
   */
  @Get(':partidoId/jugadores-disponibles')
  obtenerJugadoresDisponibles(
    @Param('partidoId', ParseIntPipe) partidoId: number,
    @Request() req: any,
  ) {
    return this.actaService.obtenerJugadoresDisponibles(partidoId, req.user);
  }

  /**
   * GET /acta-partido/:partidoId/informe
   *
   * Retorna el informe del vocal del partido más las incidencias registradas.
   */
  @Get(':partidoId/informe')
  obtenerInforme(
    @Param('partidoId', ParseIntPipe) partidoId: number,
    @Request() req: any,
  ) {
    return this.actaService.obtenerInforme(partidoId, req.user);
  }

  /**
   * PUT /acta-partido/:partidoId/informe
   *
   * El vocal guarda (o actualiza) el informe general y las incidencias del partido.
   * Solo reemplaza las incidencias aún 'pendiente' — las ya resueltas por el tribunal
   * no se tocan.
   * Roles: master, directivo_liga
   */
  @Put(':partidoId/informe')
  guardarInforme(
    @Param('partidoId', ParseIntPipe) partidoId: number,
    @Body() dto: GuardarInformePartidoDto,
    @Request() req: any,
  ) {
    return this.actaService.guardarInforme(partidoId, dto, req.user);
  }

  /**
   * GET /acta-partido/:partidoId
   *
   * Retorna la alineación ya guardada de un partido, agrupada por equipo.
   */
  @Get(':partidoId')
  obtenerAlineacion(
    @Param('partidoId', ParseIntPipe) partidoId: number,
    @Request() req: any,
  ) {
    return this.actaService.obtenerAlineacion(partidoId, req.user);
  }

  /**
   * PUT /acta-partido/:partidoId/alineacion
   *
   * Guarda (o reemplaza) la alineación completa de un partido.
   * Se puede llamar múltiples veces para actualizar los datos.
   * Roles: master, directivo_liga
   */
  @Put(':partidoId/alineacion')
  guardarAlineacion(
    @Param('partidoId', ParseIntPipe) partidoId: number,
    @Body() dto: GuardarAlineacionDto,
    @Request() req: any,
  ) {
    return this.actaService.guardarAlineacion(partidoId, dto, req.user);
  }
}
