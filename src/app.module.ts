import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { LigasModule } from './modules/ligas/ligas.module';
import { EquiposModule } from './modules/equipos/equipos.module';
import { JugadoresModule } from './modules/jugadores/jugadores.module';
import { UploadModule } from './modules/upload/upload.module';
import { CampeonatosModule } from './modules/campeonatos/campeonatos.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { InscripcionesModule } from './modules/inscripciones/inscripciones.module';
import { JugadorCampeonatosModule } from './modules/jugador-campeonatos/jugador-campeonatos.module';
import { TransferenciasModule } from './modules/transferencias/transferencias.module';

/**
 * Módulo raíz de la aplicación
 * Aplica el principio de Single Responsibility: solo se encarga de la configuración global
 */
@Module({
  imports: [
    // Configuración de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración de base de datos con TypeORM
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),

    // Módulos de la aplicación
    AuthModule,
    LigasModule,
    EquiposModule,
    JugadoresModule,
    UploadModule,
    CampeonatosModule,
    CategoriasModule,
    InscripcionesModule,
    JugadorCampeonatosModule,
    TransferenciasModule,
  ],
})
export class AppModule {}
