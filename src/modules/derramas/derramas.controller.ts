/**
 * DerramasController
 *
 * Endpoints disponibles:
 *
 *  POST   /derramas                                  → Crear nueva derrama
 *  GET    /derramas?campeonatoId=                    → Listar derramas de un campeonato
 *  GET    /derramas/:id                              → Detalle de una derrama con equipos
 *  POST   /derramas/:id/equipos                      → Asignar/actualizar equipos en bloque
 *  PATCH  /derramas/:id/equipos/:equipoId            → Actualizar cantidad/modo_pago de un equipo
 *  PATCH  /derramas/:id/equipos/:equipoId/dividir-cuotas → Dividir deuda en N cuotas de vocalía
 *  POST   /derramas/:id/equipos/:equipoId/pago       → Registrar pago directo de un equipo
 *  POST   /derramas/:id/cerrar                       → Cerrar derrama (marca deudas como 'arrastrado')
 *  GET    /derramas/deudas?ligaId=&equipoId=         → Deudas pendientes de un equipo en una liga
 *  GET    /derramas/vocalia?campeonatoId=&equipoId=  → Derramas por_vocalia activas (para acta)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DerramasService } from './derramas.service';
import { CreateDerramaDto } from './dto/create-derrama.dto';
import {
  AsignarEquiposDto,
  ActualizarDerramaEquipoDto,
  PagarDerramaEquipoDto,
} from './dto/derrama-equipo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('derramas')
@UseGuards(JwtAuthGuard)
export class DerramasController {
  constructor(private readonly derramasService: DerramasService) {}

  /** Crea una nueva derrama */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() dto: CreateDerramaDto, @Request() req: any) {
    return this.derramasService.crear(dto, req.user);
  }

  /**
   * Deudas consolidadas de un equipo en una liga.
   * Ruta GET /derramas/deudas — debe ir ANTES de /:id para que
   * Express no trate "deudas" como un id numérico.
   */
  @Get('deudas')
  deudasEquipo(
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('equipoId', ParseIntPipe) equipoId: number,
  ) {
    return this.derramasService.deudasDerramaEquipo(ligaId, equipoId);
  }

  /**
   * Derramas por_vocalia pendientes de un equipo (para pre-rellenar acta).
   * Ruta GET /derramas/vocalia — igual que arriba, antes de /:id.
   */
  @Get('vocalia')
  vocaliasActivas(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('equipoId', ParseIntPipe) equipoId: number,
  ) {
    return this.derramasService.derramasVocaliaActivas(campeonatoId, equipoId);
  }

  /** Lista derramas de un campeonato con resumen de cobros */
  @Get()
  listar(@Query('campeonatoId', ParseIntPipe) campeonatoId: number) {
    return this.derramasService.listarPorCampeonato(campeonatoId);
  }

  /** Detalle de una derrama con sus equipos */
  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.derramasService.obtenerDetalle(id);
  }

  /** Asigna o actualiza los equipos de una derrama en bloque */
  @Post(':id/equipos')
  asignarEquipos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarEquiposDto,
    @Request() req: any,
  ) {
    return this.derramasService.asignarEquipos(id, dto, req.user);
  }

  /** Actualiza cantidad / modo_pago de un equipo individual */
  @Patch(':id/equipos/:equipoId')
  actualizarEquipo(
    @Param('id', ParseIntPipe) id: number,
    @Param('equipoId', ParseIntPipe) equipoId: number,
    @Body() dto: ActualizarDerramaEquipoDto,
    @Request() req: any,
  ) {
    return this.derramasService.actualizarEquipo(id, equipoId, dto, req.user);
  }

  /** Divide la deuda pendiente de un equipo en N cuotas de vocalía */
  @Patch(':id/equipos/:equipoId/dividir-cuotas')
  dividirEnCuotas(
    @Param('id', ParseIntPipe) id: number,
    @Param('equipoId', ParseIntPipe) equipoId: number,
    @Body('numeroCuotas', ParseIntPipe) numeroCuotas: number,
    @Request() req: any,
  ) {
    return this.derramasService.dividirEnCuotas(id, equipoId, numeroCuotas, req.user);
  }

  /** Registra un pago directo de un equipo */
  @Post(':id/equipos/:equipoId/pago')
  @HttpCode(HttpStatus.OK)
  registrarPago(
    @Param('id', ParseIntPipe) id: number,
    @Param('equipoId', ParseIntPipe) equipoId: number,
    @Body() dto: PagarDerramaEquipoDto,
    @Request() req: any,
  ) {
    return this.derramasService.registrarPago(id, equipoId, dto, req.user);
  }

  /** Cierra una derrama y arrastra deudas pendientes */
  @Post(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  cerrar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.derramasService.cerrar(id, req.user);
  }
}
