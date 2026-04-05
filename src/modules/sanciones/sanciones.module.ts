import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoSancion } from './entities/tipo-sancion.entity';
import { ReglaSancion } from './entities/regla-sancion.entity';
import { Sancion } from './entities/sancion.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { ActaAlineacion } from '../acta-partido/entities/acta-alineacion.entity';
import { SancionesService } from './sanciones.service';
import { SancionesController } from './sanciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TipoSancion, ReglaSancion, Sancion, JugadorCampeonato, Campeonato, ActaAlineacion])],
  controllers: [SancionesController],
  providers: [SancionesService],
  exports: [SancionesService],
})
export class SancionesModule {}
