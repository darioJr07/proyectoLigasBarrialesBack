import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GolesService, FilaGoleador } from './goles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConsultarHistorialGolesDto } from './dto/consultar-historial-goles.dto';

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
@UseGuards(JwtAuthGuard, RolesGuard)
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
   * Historial individual de goles con filtros y paginacion.
   * El master puede consultar cualquier liga; los demas roles quedan
   * restringidos a la liga asociada a su usuario.
   */
  @Get('historial')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  getHistorial(
    @Query() filtros: ConsultarHistorialGolesDto,
    @Request() req: any,
  ) {
    return this.golesService.getHistorial(filtros, req.user);
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
