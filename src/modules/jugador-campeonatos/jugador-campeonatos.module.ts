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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JugadorCampeonato,
      Jugador,
      Campeonato,
      Equipo,
      Categoria,
      Inscripcion,
      Usuario,
      Transferencia,
    ]),
  ],
  controllers: [JugadorCampeonatosController],
  providers: [JugadorCampeonatosService],
  exports: [JugadorCampeonatosService],
})
export class JugadorCampeonatosModule {}
