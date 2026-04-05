import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SancionesService } from './sanciones.service';
import { CreateTipoSancionDto } from './dto/create-tipo-sancion.dto';
import { UpdateTipoSancionDto } from './dto/update-tipo-sancion.dto';
import { CreateReglaSancionDto } from './dto/create-regla-sancion.dto';
import { UpdateReglaSancionDto } from './dto/update-regla-sancion.dto';
import { CreateSancionDto } from './dto/create-sancion.dto';
import { UpdateSancionDto } from './dto/update-sancion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Controlador de Sanciones
 *
 * ENDPOINTS DISPONIBLES:
 *
 * ── Tipos de sanción ──────────────────────────────────────────────────────
 * POST   /sanciones/tipos                          → Crear tipo
 * GET    /sanciones/tipos?ligaId=X                 → Listar tipos de una liga
 * PATCH  /sanciones/tipos/:id                      → Editar tipo
 * DELETE /sanciones/tipos/:id                      → Desactivar tipo
 *
 * ── Reglas de sanción ────────────────────────────────────────────────────
 * POST   /sanciones/reglas                         → Crear regla
 * GET    /sanciones/reglas?ligaId=X&campeonatoId=Y → Listar reglas
 * PATCH  /sanciones/reglas/:id                     → Editar regla
 *
 * ── Sanciones ────────────────────────────────────────────────────────────
 * POST   /sanciones                                → Registrar sanción
 * GET    /sanciones?campeonatoId=X&jugadorId=Y...  → Listar con filtros
 * GET    /sanciones/jugador/:id/activas            → Suspensiones activas de jugador
 * PATCH  /sanciones/:id                            → Editar sanción
 * DELETE /sanciones/:id                            → Anular sanción
 */
@Controller('sanciones')
@UseGuards(JwtAuthGuard)
export class SancionesController {
  constructor(private readonly sancionesService: SancionesService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // TIPOS DE SANCIÓN
  // ─────────────────────────────────────────────────────────────────────────

  @Post('tipos')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  crearTipo(@Body() dto: CreateTipoSancionDto, @Request() req: any) {
    return this.sancionesService.crearTipoSancion(dto, req.user);
  }

  @Get('tipos')
  listarTipos(@Query('ligaId') ligaId?: string) {
    return this.sancionesService.listarTiposSancion(ligaId ? Number(ligaId) : undefined);
  }

  @Patch('tipos/:id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  actualizarTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoSancionDto,
    @Request() req: any,
  ) {
    return this.sancionesService.actualizarTipoSancion(id, dto, req.user);
  }

  @Delete('tipos/:id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  desactivarTipo(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.sancionesService.desactivarTipoSancion(id, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGLAS DE SANCIÓN
  // ─────────────────────────────────────────────────────────────────────────

  @Post('reglas')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  crearRegla(@Body() dto: CreateReglaSancionDto, @Request() req: any) {
    return this.sancionesService.crearReglaSancion(dto, req.user);
  }

  @Get('reglas')
  listarReglas(
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('campeonatoId') campeonatoId?: string,
  ) {
    return this.sancionesService.listarReglas(ligaId, campeonatoId ? Number(campeonatoId) : undefined);
  }

  @Patch('reglas/:id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  actualizarRegla(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReglaSancionDto,
    @Request() req: any,
  ) {
    return this.sancionesService.actualizarReglaSancion(id, dto, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SANCIONES
  // ─────────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  registrar(@Body() dto: CreateSancionDto, @Request() req: any) {
    return this.sancionesService.registrarSancion(dto, req.user);
  }

  @Get()
  listar(
    @Request() req: any,
    @Query('campeonatoId') campeonatoId?: string,
    @Query('ligaId') ligaId?: string,
    @Query('jugadorId') jugadorId?: string,
    @Query('equipoId') equipoId?: string,
    @Query('tipoSancionId') tipoSancionId?: string,
    @Query('soloActivas') soloActivas?: string,
  ) {
    return this.sancionesService.listarSanciones(
      {
        campeonatoId: campeonatoId ? Number(campeonatoId) : undefined,
        ligaId: ligaId ? Number(ligaId) : undefined,
        jugadorId: jugadorId ? Number(jugadorId) : undefined,
        equipoId: equipoId ? Number(equipoId) : undefined,
        tipoSancionId: tipoSancionId ? Number(tipoSancionId) : undefined,
        soloActivas: soloActivas === 'true',
      },
      req.user,
    );
  }

  @Get('jugador/:jugadorId/activas')
  sancionesActivas(@Param('jugadorId', ParseIntPipe) jugadorId: number) {
    return this.sancionesService.sancionesActivasJugador(jugadorId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSancionDto,
    @Request() req: any,
  ) {
    return this.sancionesService.actualizarSancion(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  anular(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.sancionesService.anularSancion(id, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ARRASTRE ENTRE CAMPEONATOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /sanciones/jugador/:jugadorId/arrastradas?ligaId=X&campeonatoId=Y
   * Devuelve suspensiones activas del jugador en otros campeonatos de la misma liga.
   */
  @Get('jugador/:jugadorId/arrastradas')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  suspensionesArrastradas(
    @Param('jugadorId', ParseIntPipe) jugadorId: number,
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
  ) {
    return this.sancionesService.obtenerSuspensionesArrastradas(jugadorId, ligaId, campeonatoId);
  }

  /**
   * POST /sanciones/:id/transferir/:campeonatoId
   * Transfiere la suspensión al nuevo campeonato y cierra la original.
   */
  @Post(':id/transferir/:campeonatoId')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  transferir(
    @Param('id', ParseIntPipe) id: number,
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Request() req: any,
  ) {
    return this.sancionesService.transferirSancion(id, campeonatoId, req.user);
  }
}
