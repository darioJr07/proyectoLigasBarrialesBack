import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InscripcionesService } from './inscripciones.service';
import { InscripcionesController } from './inscripciones.controller';
import { Inscripcion } from './entities/inscripcion.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { CampeonatosModule } from '../campeonatos/campeonatos.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { EquiposModule } from '../equipos/equipos.module';
import { TesoreriaModule } from '../tesoreria/tesoreria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inscripcion, JugadorCampeonato]),
    CampeonatosModule,
    CategoriasModule,
    EquiposModule,
    TesoreriaModule,
  ],
  controllers: [InscripcionesController],
  providers: [InscripcionesService],
  exports: [InscripcionesService],
})
export class InscripcionesModule {}
