import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partido } from './entities/partido.entity';
import { PartidosService } from './partidos.service';
import { PartidosController } from './partidos.controller';
import { GolesModule } from '../goles/goles.module';
import { SancionesModule } from '../sanciones/sanciones.module';
import { Gol } from '../goles/entities/gol.entity';
import { ActaAlineacion } from '../acta-partido/entities/acta-alineacion.entity';
import { ActaIncidencia } from '../acta-partido/entities/acta-incidencia.entity';

/**
 * Módulo de Partidos
 *
 * Registra la entidad Partido en TypeORM (esto crea la tabla en la BD
 * automáticamente si no existe), el servicio y el controlador.
 */
@Module({
  imports: [
    // Registra la entidad Partido para poder usar el repositorio en el servicio
    TypeOrmModule.forFeature([Partido, Gol, ActaAlineacion, ActaIncidencia]),
    // GolesModule exporta GolesService, que PartidosService usa para registrar goles al guardar resultado
    GolesModule,
    // SancionesModule exporta SancionesService, que PartidosService usa para procesar partidos cumplidos
    SancionesModule,
  ],
  controllers: [PartidosController],
  providers: [PartidosService],
  exports: [PartidosService], // Exportamos el servicio por si otros módulos lo necesitan
})
export class PartidosModule {}
