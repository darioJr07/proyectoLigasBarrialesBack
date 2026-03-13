import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Configuración de base de datos PostgreSQL
 * Aplica el principio de Dependency Inversion: depende de abstracciones (ConfigService)
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    // synchronize: true crea las tablas automáticamente si no existen
    // Si ya existen, las respeta y no las borra (TypeORM las actualiza solo si detecta cambios)
    // Se puede desactivar con DB_SYNCHRONIZE=false en producción si se prefiere usar migraciones
    const synchronize = this.configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true';
    
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_DATABASE', 'ligas_barriales'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: synchronize,
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      //ssl: this.configService.get<string>('NODE_ENV') === 'production'
        //? { rejectUnauthorized: false }
        //: false,
      ssl: {
    rejectUnauthorized: false,
  },
    };
  }
}
