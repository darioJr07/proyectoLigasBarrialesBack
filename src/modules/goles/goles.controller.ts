import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { GolesService, FilaGoleador } from './goles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de Goles
 *
 * ENDPOINTS:
 *   GET /goles/goleadores?campeonatoId=X&categoriaId=Y
 *     → Tabla de goleadores para una categoría.
 *
 *   GET /goles/partido?partidoId=X
 *     → Lista de goles de un partido específico (detalle de resultado).
 *
 * NOTA: El registro de goles (POST) se hace desde PartidosController
 * al registrar el resultado del partido, no como endpoint independiente.
 * Esto garantiza que los goles siempre estén sincronizados con el marcador.
 */
@Controller('goles')
@UseGuards(JwtAuthGuard)
export class GolesController {
  constructor(private readonly golesService: GolesService) {}

  /**
   * Tabla de goleadores por campeonato y categoría.
   * Incluye total de goles, penales y autogoles (informativos).
   */
  @Get('goleadores')
  getGoleadores(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
  ): Promise<FilaGoleador[]> {
    return this.golesService.getGoleadoresPorCategoria(campeonatoId, categoriaId);
  }

  /**
   * Goles de un partido específico (para mostrar en el detalle del resultado).
   */
  @Get('partido')
  getGolesPorPartido(
    @Query('partidoId', ParseIntPipe) partidoId: number,
  ) {
    return this.golesService.getGolesPorPartido(partidoId);
  }
}
