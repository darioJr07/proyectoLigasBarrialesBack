import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActaAlineacion } from './entities/acta-alineacion.entity';
import { ActaInformePartido } from './entities/acta-informe-partido.entity';
import { ActaIncidencia } from './entities/acta-incidencia.entity';
import { ActaPartidoService } from './acta-partido.service';
import { ActaPartidoController } from './acta-partido.controller';
import { Partido } from '../partidos/entities/partido.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActaAlineacion,
      ActaInformePartido,
      ActaIncidencia,
      Partido,
      JugadorCampeonato,
      Sancion,
      Campeonato,
    ]),
  ],
  controllers: [ActaPartidoController],
  providers: [ActaPartidoService],
  exports: [ActaPartidoService],
})
export class ActaPartidoModule {}
