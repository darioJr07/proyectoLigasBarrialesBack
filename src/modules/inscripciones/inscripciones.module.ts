import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InscripcionesService } from './inscripciones.service';
import { InscripcionesController } from './inscripciones.controller';
import { Inscripcion } from './entities/inscripcion.entity';
import { CampeonatosModule } from '../campeonatos/campeonatos.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { EquiposModule } from '../equipos/equipos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inscripcion]),
    CampeonatosModule,
    CategoriasModule,
    EquiposModule,
  ],
  controllers: [InscripcionesController],
  providers: [InscripcionesService],
  exports: [InscripcionesService],
})
export class InscripcionesModule {}
