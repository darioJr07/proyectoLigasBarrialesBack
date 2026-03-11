import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partido } from '../partidos/entities/partido.entity';
import { TablaPosicionesService } from './tabla-posiciones.service';
import { TablaPosicionesController } from './tabla-posiciones.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partido]),
  ],
  controllers: [TablaPosicionesController],
  providers: [TablaPosicionesService],
  exports: [TablaPosicionesService],
})
export class TablaPosicionesModule {}
