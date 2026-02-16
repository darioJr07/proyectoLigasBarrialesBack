import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquiposService } from './equipos.service';
import { EquiposController } from './equipos.controller';
import { Equipo } from './entities/equipo.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { Liga } from '../ligas/entities/liga.entity';

/**
 * Módulo de Equipos
 * Organiza todos los componentes relacionados con equipos
 */
@Module({
  imports: [TypeOrmModule.forFeature([Equipo, Usuario, Liga])],
  controllers: [EquiposController],
  providers: [EquiposService],
  exports: [EquiposService, TypeOrmModule],
})
export class EquiposModule {}
