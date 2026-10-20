import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gol } from './entities/gol.entity';
import { GolesService } from './goles.service';
import { GolesController } from './goles.controller';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';

/**
 * Módulo de Goles
 *
 * Se exporta GolesService para que PartidosModule pueda inyectarlo
 * y registrar los goles al guardar un resultado.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Gol, JugadorCampeonato, Inscripcion])],
  controllers: [GolesController],
  providers: [GolesService],
  exports: [GolesService],
})
export class GolesModule {}
