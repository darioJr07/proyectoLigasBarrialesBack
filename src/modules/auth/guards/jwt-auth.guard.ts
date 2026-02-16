import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para proteger rutas con autenticación JWT
 * Aplica el principio de Guard Pattern
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
