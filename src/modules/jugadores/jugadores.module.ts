import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JugadoresService } from './jugadores.service';
import { JugadoresController } from './jugadores.controller';
import { Jugador } from './entities/jugador.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { UploadModule } from '../upload/upload.module';

/**
 * Módulo de Jugadores
 * Organiza todos los componentes relacionados con jugadores
 */
@Module({
  imports: [TypeOrmModule.forFeature([Jugador, Equipo, JugadorCampeonato]), UploadModule],
  controllers: [JugadoresController],
  providers: [JugadoresService],
  exports: [JugadoresService, TypeOrmModule],
})
export class JugadoresModule {}
