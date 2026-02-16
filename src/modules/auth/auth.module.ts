import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './entities/rol.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Módulo de autenticación y gestión de usuarios
 * Aplica el principio de modularidad y separación de responsabilidades
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '24h'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, UsuariosService, JwtStrategy],
  exports: [AuthService, UsuariosService, JwtStrategy, PassportModule],
})
export class AuthModule {}
