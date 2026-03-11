import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TablaPosicionesService, FilaPosicion } from './tabla-posiciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de Tabla de Posiciones
 *
 * ENDPOINT DISPONIBLE:
 *   GET /tabla-posiciones?campeonatoId=X&categoriaId=Y&etapa=Z
 *     → Devuelve el ranking de equipos para esa categoría y etapa.
 *       Requiere autenticación JWT.
 */
@Controller('tabla-posiciones')
@UseGuards(JwtAuthGuard)
export class TablaPosicionesController {
  constructor(private readonly tablaPosicionesService: TablaPosicionesService) {}

  /**
   * Calcula y devuelve la tabla de posiciones.
   * @param campeonatoId  ID del campeonato
   * @param categoriaId   ID de la categoría
   * @param etapa         Nombre de la etapa (ej: 'primera_etapa', 'liguilla')
   */
  @Get()
  calcular(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
    @Query('etapa') etapa: string,
  ): Promise<FilaPosicion[]> {
    return this.tablaPosicionesService.calcular(campeonatoId, categoriaId, etapa);
  }
}
