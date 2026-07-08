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
import { GarantiasService } from './garantias.service';
import { CreateGarantiaDto } from './dto/create-garantia.dto';
import { AccionGarantiaDto } from './dto/accion-garantia.dto';
import { CreatePrestamoFondoDto } from './dto/create-prestamo-fondo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de Garantías
 *
 * ── Garantías individuales de equipos ─────────────────────────────────────
 * POST   /garantias                          → Registrar garantía (estado: pendiente)
 * GET    /garantias?ligaId=                  → Listar garantías de una liga
 * GET    /garantias/resumen?ligaId=          → Resumen del fondo (custodiado, préstamos, disponible)
 * PATCH  /garantias/:id/pagar               → pendiente → pagada
 * PATCH  /garantias/:id/resolver            → pagada → devuelta | ejecutada
 *
 * ── Préstamos del fondo colectivo ─────────────────────────────────────────
 * POST   /garantias/prestamos               → Registrar préstamo (crea INGRESO en caja)
 * GET    /garantias/prestamos?ligaId=       → Listar préstamos de una liga
 * PATCH  /garantias/prestamos/:id/devolver  → tomado → devuelto (crea EGRESO en caja)
 */
@Controller('garantias')
@UseGuards(JwtAuthGuard)
export class GarantiasController {
  constructor(private readonly garantiasService: GarantiasService) {}

  // ── Garantías individuales ────────────────────────────────────────────────

  @Post()
  crearGarantia(@Body() dto: CreateGarantiaDto, @Request() req: any) {
    return this.garantiasService.crearGarantia(dto, req.user);
  }

  @Get('resumen')
  resumenFondo(@Query('ligaId', ParseIntPipe) ligaId: number) {
    return this.garantiasService.resumenFondo(ligaId);
  }

  @Get()
  listarGarantias(@Query('ligaId', ParseIntPipe) ligaId: number) {
    return this.garantiasService.listarGarantias(ligaId);
  }

  @Patch(':id/pagar')
  marcarPagada(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.garantiasService.marcarPagada(id, req.user);
  }

  @Patch(':id/resolver')
  resolverGarantia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AccionGarantiaDto,
    @Request() req: any,
  ) {
    return this.garantiasService.resolverGarantia(id, dto, req.user);
  }

  // ── Préstamos del fondo ───────────────────────────────────────────────────

  @Post('prestamos')
  crearPrestamo(@Body() dto: CreatePrestamoFondoDto, @Request() req: any) {
    return this.garantiasService.crearPrestamo(dto, req.user);
  }

  @Get('prestamos')
  listarPrestamos(@Query('ligaId', ParseIntPipe) ligaId: number) {
    return this.garantiasService.listarPrestamos(ligaId);
  }

  @Patch('prestamos/:id/devolver')
  devolverPrestamo(
    @Param('id', ParseIntPipe) id: number,
    @Body('campeonatoId') campeonatoId: number | null,
    @Request() req: any,
  ) {
    return this.garantiasService.devolverPrestamo(id, campeonatoId ?? null, req.user);
  }
}
