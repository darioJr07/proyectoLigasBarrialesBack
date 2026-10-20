import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfiguracionService } from '../configuracion.service';
import { MODULO_HABILITADO_KEY } from '../decorators/modulo-habilitado.decorator';

/**
 * Hace que la configuracion del backend sea la autoridad final para los
 * modulos operados por dirigentes de equipo.
 */
@Injectable()
export class ModuloHabilitadoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const clave = this.reflector.getAllAndOverride<string>(MODULO_HABILITADO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!clave) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // La apertura/cierre operativo solo restringe a dirigentes de equipo.
    if (user?.role !== 'dirigente_equipo') {
      return true;
    }

    const configuracion = await this.configuracionService.findOne(clave);
    if (configuracion.valor !== 'true') {
      throw new ForbiddenException(
        'Este modulo se encuentra temporalmente deshabilitado para dirigentes de equipo',
      );
    }

    return true;
  }
}
