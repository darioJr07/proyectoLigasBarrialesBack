import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JugadorCampeonatosService } from './jugador-campeonatos.service';
import { JugadorCampeonatosController } from './jugador-campeonatos.controller';
import { JugadorCampeonato } from './entities/jugador-campeonato.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { CambioDorsalEtapa } from './entities/cambio-dorsal-etapa.entity';
import { EtapaCompetencia } from '../partidos/entities/etapa-competencia.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { CambiosDorsalService } from './cambios-dorsal.service';

@Module({
  imports: [
    ConfiguracionModule,
    TypeOrmModule.forFeature([
      JugadorCampeonato,
      Jugador,
      Campeonato,
      Equipo,
      Categoria,
      Inscripcion,
      Usuario,
      Transferencia,
      Sancion,
      CambioDorsalEtapa,
      EtapaCompetencia,
      Partido,
    ]),
  ],
  controllers: [JugadorCampeonatosController],
  providers: [JugadorCampeonatosService, CambiosDorsalService],
  exports: [JugadorCampeonatosService, CambiosDorsalService],
})
export class JugadorCampeonatosModule {}
