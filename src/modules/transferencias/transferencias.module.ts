import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferenciasService } from './transferencias.service';
import { TransferenciasController } from './transferencias.controller';
import { Transferencia } from './entities/transferencia.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Usuario } from '../auth/entities/usuario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transferencia,
      Jugador,
      Campeonato,
      Equipo,
      JugadorCampeonato,
      Inscripcion,
      Usuario,
    ]),
  ],
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
  exports: [TransferenciasService],
})
export class TransferenciasModule {}
