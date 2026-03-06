import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquiposService } from './equipos.service';
import { EquiposController } from './equipos.controller';
import { Equipo } from './entities/equipo.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { Liga } from '../ligas/entities/liga.entity';
import { UploadModule } from '../upload/upload.module';

/**
 * Módulo de Equipos
 * Organiza todos los componentes relacionados con equipos
 */
@Module({
  imports: [TypeOrmModule.forFeature([Equipo, Usuario, Liga]), UploadModule],
  controllers: [EquiposController],
  providers: [EquiposService],
  exports: [EquiposService, TypeOrmModule],
})
export class EquiposModule {}
