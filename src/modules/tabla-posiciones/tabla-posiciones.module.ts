import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partido } from '../partidos/entities/partido.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { TablaPosicionesService } from './tabla-posiciones.service';
import { TablaPosicionesController } from './tabla-posiciones.controller';
import { EtapaGrupo } from '../partidos/entities/etapa-grupo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partido, Sancion, EtapaGrupo]),
  ],
  controllers: [TablaPosicionesController],
  providers: [TablaPosicionesService],
  exports: [TablaPosicionesService],
})
export class TablaPosicionesModule {}
