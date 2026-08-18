import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PublicoService } from './publico.service';

/**
 * Rutas de lectura abiertas, separadas de los controladores protegidos por JWT.
 */
@Controller('publico')
export class PublicoController {
  constructor(private readonly publicoService: PublicoService) {}

  @Get('ligas')
  listarLigas() {
    return this.publicoService.listarLigas();
  }

  @Get('ligas/:ligaId/campeonatos')
  listarCampeonatosEnCurso(@Param('ligaId', ParseIntPipe) ligaId: number) {
    return this.publicoService.listarCampeonatosEnCurso(ligaId);
  }

  @Get('ligas/:ligaId/partidos-destacados')
  listarPartidosDestacados(@Param('ligaId', ParseIntPipe) ligaId: number) {
    return this.publicoService.listarPartidosDestacados(ligaId);
  }

  @Get('campeonatos/:campeonatoId/categorias')
  listarCategorias(@Param('campeonatoId', ParseIntPipe) campeonatoId: number) {
    return this.publicoService.listarCategorias(campeonatoId);
  }

  @Get('posiciones')
  consultarPosiciones(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
    @Query('etapa') etapa: string,
  ) {
    return this.publicoService.consultarPosiciones(campeonatoId, categoriaId, etapa);
  }

  @Get('partidos/etapas')
  listarEtapas(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
  ) {
    return this.publicoService.listarEtapas(campeonatoId, categoriaId);
  }

  @Get('partidos/jornadas')
  listarJornadas(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
    @Query('etapa') etapa: string,
  ) {
    return this.publicoService.listarJornadas(campeonatoId, categoriaId, etapa);
  }

  @Get('partidos')
  listarPartidos(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
    @Query('etapa') etapa: string,
    @Query('jornada') jornada?: string,
  ) {
    return this.publicoService.listarPartidos(campeonatoId, categoriaId, etapa, jornada ? Number(jornada) : undefined);
  }

  @Get('goleadores')
  listarGoleadores(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
  ) {
    return this.publicoService.listarGoleadores(campeonatoId, categoriaId);
  }

  @Get('sanciones')
  listarSancionesActivas(@Query('campeonatoId', ParseIntPipe) campeonatoId: number) {
    return this.publicoService.listarSancionesActivas(campeonatoId);
  }
}
