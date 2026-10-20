import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liga } from '../ligas/entities/liga.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { ReglaSancion } from '../sanciones/entities/regla-sancion.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { TablaPosicionesModule } from '../tabla-posiciones/tabla-posiciones.module';
import { GolesModule } from '../goles/goles.module';
import { PublicoController } from './publico.controller';
import { PublicoService } from './publico.service';
import { EtapaCompetencia } from '../partidos/entities/etapa-competencia.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Liga, Campeonato, Categoria, Equipo, Partido, Sancion, ReglaSancion, Jugador, EtapaCompetencia, JugadorCampeonato]), TablaPosicionesModule, GolesModule],
  controllers: [PublicoController],
  providers: [PublicoService],
})
export class PublicoModule {}
