import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasService } from './categorias.service';
import { CategoriasController } from './categorias.controller';
import { Categoria } from './entities/categoria.entity';
import { CampeonatosModule } from '../campeonatos/campeonatos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Categoria]),
    CampeonatosModule,
  ],
  controllers: [CategoriasController],
  providers: [CategoriasService],
  exports: [CategoriasService, TypeOrmModule],
})
export class CategoriasModule {}
