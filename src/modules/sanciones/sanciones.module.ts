import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoSancion } from './entities/tipo-sancion.entity';
import { ReglaSancion } from './entities/regla-sancion.entity';
import { Sancion } from './entities/sancion.entity';
import { SancionesService } from './sanciones.service';
import { SancionesController } from './sanciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TipoSancion, ReglaSancion, Sancion])],
  controllers: [SancionesController],
  providers: [SancionesService],
  exports: [SancionesService],
})
export class SancionesModule {}
