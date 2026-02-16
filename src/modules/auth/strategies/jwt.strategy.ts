import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * Estrategia JWT para validar tokens
 * Aplica el principio de Strategy Pattern (patrón de diseño)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Valida el payload del token JWT
   * @param payload Payload decodificado del token
   * @returns Usuario validado con formato para req.user
   */
  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    // Retornar en el formato esperado por los controladores
    return {
      userId: user.id,
      role: user.rol.nombre,
      ...user,
    };
  }
}
