import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partido } from './entities/partido.entity';
import { PartidosService } from './partidos.service';
import { PartidosController } from './partidos.controller';

/**
 * Módulo de Partidos
 *
 * Registra la entidad Partido en TypeORM (esto crea la tabla en la BD
 * automáticamente si no existe), el servicio y el controlador.
 */
@Module({
  imports: [
    // Registra la entidad Partido para poder usar el repositorio en el servicio
    TypeOrmModule.forFeature([Partido]),
  ],
  controllers: [PartidosController],
  providers: [PartidosService],
  exports: [PartidosService], // Exportamos el servicio por si otros módulos lo necesitan
})
export class PartidosModule {}
