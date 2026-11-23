import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Gol } from '../goles/entities/gol.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { CambioDorsalEtapa } from '../jugador-campeonatos/entities/cambio-dorsal-etapa.entity';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ActaAlineacion } from '../acta-partido/entities/acta-alineacion.entity';
import { ActaIncidencia } from '../acta-partido/entities/acta-incidencia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campeonato,
      Categoria,
      Partido,
      Gol,
      Inscripcion,
      JugadorCampeonato,
      Sancion,
      Equipo,
      Jugador,
      Transferencia,
      CambioDorsalEtapa,
      ActaAlineacion,
      ActaIncidencia,
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
