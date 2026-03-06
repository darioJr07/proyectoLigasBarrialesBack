import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LigasService } from './ligas.service';
import { LigasController } from './ligas.controller';
import { Liga } from './entities/liga.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { UploadModule } from '../upload/upload.module';

/**
 * Módulo de Ligas
 * Aplica el principio de modularidad y separación de responsabilidades
 */
@Module({
  imports: [TypeOrmModule.forFeature([Liga, Usuario]), UploadModule],
  controllers: [LigasController],
  providers: [LigasService],
  exports: [LigasService], // Exportar el servicio para uso en otros módulos
})
export class LigasModule {}
