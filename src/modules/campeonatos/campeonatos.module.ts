import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampeonatosService } from './campeonatos.service';
import { CampeonatosController } from './campeonatos.controller';
import { Campeonato } from './entities/campeonato.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campeonato])],
  controllers: [CampeonatosController],
  providers: [CampeonatosService],
  exports: [CampeonatosService, TypeOrmModule],
})
export class CampeonatosModule {}
