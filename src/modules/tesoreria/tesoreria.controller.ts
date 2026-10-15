import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TesoreriaService } from './tesoreria.service';
import { GuardarConfigVocaliaDto } from './dto/guardar-config-vocalia.dto';
import { CreateCobroPartidoDto } from './dto/create-cobro-partido.dto';
import { PagarCobroPartidoDto } from './dto/pagar-cobro-partido.dto';
import { CreateMovimientoTesoreriaDto } from './dto/create-movimiento-tesoreria.dto';
import { UpdateMovimientoTesoreriaDto } from './dto/update-movimiento-tesoreria.dto';
import { TrasladarSaldoDto } from './dto/trasladar-saldo.dto';
import { IniciarOperacionTesoreriaDto } from './dto/iniciar-operacion-tesoreria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCierreCajaTesoreriaDto } from './dto/create-cierre-caja-tesoreria.dto';

/**
 * Controlador de Tesorería
 *
 * ── Config Vocalía ────────────────────────────────────────────────────────
 * GET    /tesoreria/config-vocalia/:ligaId           → Obtener valores de vocalía
 * PUT    /tesoreria/config-vocalia/:ligaId           → Guardar/reemplazar configuración
 *
 * ── Cobros de Partido ─────────────────────────────────────────────────────
 * POST   /tesoreria/cobros-partido                   → Guardar cobros del acta (upsert)
 * GET    /tesoreria/cobros-partido?ligaId=&campe...  → Listar con filtros
 * GET    /tesoreria/cobros-partido/partido/:id       → Cobros de un partido específico
 * PATCH  /tesoreria/cobros-partido/:id/pagar         → Marcar como pagado
 *
 * ── Movimientos Generales ────────────────────────────────────────────────
 * POST   /tesoreria/movimientos                      → Registrar movimiento manual
 * GET    /tesoreria/movimientos?ligaId=&campe...     → Listar con filtros
 * PATCH  /tesoreria/movimientos/:id                  → Actualizar estado (pagar/anular)
 *
 * ── Resumen de Caja ───────────────────────────────────────────────────────
 * GET    /tesoreria/resumen?campeonatoId=&ligaId=    → Resumen consolidado
 */
@Controller('tesoreria')
@UseGuards(JwtAuthGuard)
export class TesoreriaController {
  constructor(private readonly tesoreriaService: TesoreriaService) {}

  @Get('cierres/preview')
  previsualizarCierre(
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('fechaCorte') fechaCorte: string,
    @Request() req: any,
  ) {
    return this.tesoreriaService.previsualizarCierreCaja(
      ligaId,
      campeonatoId,
      fechaCorte,
      req.user,
    );
  }

  @Get('cierres')
  listarCierres(
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Request() req: any,
  ) {
    return this.tesoreriaService.listarCierresCaja(ligaId, campeonatoId, req.user);
  }

  @Post('cierres')
  crearCierre(@Body() dto: CreateCierreCajaTesoreriaDto, @Request() req: any) {
    return this.tesoreriaService.crearCierreCaja(dto, req.user);
  }

  @Get('inicio-operativo')
  consultarInicioOperativo(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Request() req: any,
  ) {
    return this.tesoreriaService.consultarInicioOperativo(campeonatoId, ligaId, req.user);
  }

  @Post('inicio-operativo')
  iniciarOperacion(@Body() dto: IniciarOperacionTesoreriaDto, @Request() req: any) {
    return this.tesoreriaService.iniciarOperacion(dto, req.user);
  }

  // ── Config Vocalía ────────────────────────────────────────────────────────

  @Get('config-vocalia/:ligaId')
  obtenerConfigVocalia(@Param('ligaId', ParseIntPipe) ligaId: number, @Request() req: any) {
    return this.tesoreriaService.obtenerConfigVocalia(ligaId, req.user);
  }

  @Patch('config-vocalia/:ligaId')
  guardarConfigVocalia(
    @Param('ligaId', ParseIntPipe) ligaId: number,
    @Body() dto: GuardarConfigVocaliaDto,
    @Request() req?: any,
  ) {
    return this.tesoreriaService.guardarConfigVocalia(ligaId, dto, req.user);
  }

  // ── Cobros de Partido ─────────────────────────────────────────────────────

  @Post('cobros-partido')
  guardarCobroPartido(@Body() dto: CreateCobroPartidoDto, @Request() req: any) {
    return this.tesoreriaService.guardarCobroPartido(dto, req.user);
  }

  @Get('cobros-partido/partido/:partidoId')
  cobrosDePartido(@Param('partidoId', ParseIntPipe) partidoId: number, @Request() req: any) {
    return this.tesoreriaService.cobrosDePartido(partidoId, req.user);
  }

  @Get('cobros-partido')
  listarCobrosPartido(
    @Query('ligaId')       ligaId?: string,
    @Query('campeonatoId') campeonatoId?: string,
    @Query('equipoId')     equipoId?: string,
    @Query('partidoId')    partidoId?: string,
    @Query('jornada')      jornada?: string,
    @Query('estado')       estado?: string,
    @Query('incluirHistorial') incluirHistorial?: string,
    @Request() req?: any,
  ) {
    return this.tesoreriaService.listarCobrosPartido({
      ligaId:       ligaId       ? Number(ligaId)       : undefined,
      campeonatoId: campeonatoId ? Number(campeonatoId) : undefined,
      equipoId:     equipoId     ? Number(equipoId)     : undefined,
      partidoId:    partidoId    ? Number(partidoId)    : undefined,
      jornada:      jornada      ? Number(jornada)      : undefined,
      estado,
      incluirHistorial: incluirHistorial === 'true',
    }, req.user);
  }

  @Patch('cobros-partido/:id/pagar')
  pagarCobroPartido(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PagarCobroPartidoDto,
    @Request() req: any,
  ) {
    return this.tesoreriaService.pagarCobroPartido(id, dto, req.user);
  }

  @Patch('cobros-partido/:id/no-presentado')
  registrarNoPresentado(
    @Param('id', ParseIntPipe) id: number,
    @Body('observaciones') observaciones: string | undefined,
    @Request() req: any,
  ) {
    return this.tesoreriaService.registrarNoPresentado(id, observaciones, req.user);
  }

  // ── Movimientos Generales ────────────────────────────────────────────────

  @Post('movimientos')
  crearMovimiento(@Body() dto: CreateMovimientoTesoreriaDto, @Request() req: any) {
    return this.tesoreriaService.crearMovimiento(dto, req.user);
  }

  @Get('movimientos')
  listarMovimientos(
    @Query('ligaId')       ligaId?: string,
    @Query('campeonatoId') campeonatoId?: string,
    @Query('equipoId')     equipoId?: string,
    @Query('tipo')         tipo?: string,
    @Query('categoria')    categoria?: string,
    @Query('estado')       estado?: string,
    @Request() req?: any,
  ) {
    return this.tesoreriaService.listarMovimientos({
      ligaId:       ligaId       ? Number(ligaId)       : undefined,
      campeonatoId: campeonatoId ? Number(campeonatoId) : undefined,
      equipoId:     equipoId     ? Number(equipoId)     : undefined,
      tipo,
      categoria,
      estado,
    }, req.user);
  }

  @Patch('movimientos/:id')
  actualizarMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovimientoTesoreriaDto,
    @Request() req: any,
  ) {
    return this.tesoreriaService.actualizarMovimiento(id, dto, req.user);
  }

  // ── Cuenta consolidada por equipo ────────────────────────────────────────

  @Get('deudas')
  deudasConsolidadas(
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('equipoId') equipoId?: string,
    @Request() req?: any,
  ) {
    return this.tesoreriaService.deudasConsolidadas(
      ligaId,
      equipoId ? Number(equipoId) : undefined,
      req.user,
    );
  }

  // ── Libro de Caja ──────────────────────────────────────────────────────────

  @Get('libro-caja')
  getLibroCaja(
    @Query('ligaId')       ligaId?: string,
    @Query('campeonatoId') campeonatoId?: string,
    @Query('fechaDesde')   fechaDesde?: string,
    @Query('fechaHasta')   fechaHasta?: string,
    @Request() req?: any,
  ) {
    return this.tesoreriaService.getLibroCaja({
      ligaId:       ligaId       ? Number(ligaId)       : undefined,
      campeonatoId: campeonatoId ? Number(campeonatoId) : undefined,
      fechaDesde,
      fechaHasta,
    }, req.user);
  }

  // ── Resumen de Caja ───────────────────────────────────────────────────────

  @Get('resumen')
  resumenCaja(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('ligaId', ParseIntPipe)       ligaId: number,
    @Request() req: any,
  ) {
    return this.tesoreriaService.resumenCaja(campeonatoId, ligaId, req.user);
  }

  // ── Traslado de saldo entre campeonatos ───────────────────────────────────

  @Post('trasladar-saldo')
  trasladarSaldo(@Body() dto: TrasladarSaldoDto, @Request() req: any) {
    return this.tesoreriaService.trasladarSaldo(dto, req.user);
  }
}
