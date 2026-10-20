import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfiguracionService } from '../configuracion.service';
import { ModuloHabilitadoGuard } from './modulo-habilitado.guard';

describe('ModuloHabilitadoGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let configuracionService: { findOne: jest.Mock };
  let guard: ModuloHabilitadoGuard;

  const contextFor = (role: string): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue('modulo_inscripciones') };
    configuracionService = { findOne: jest.fn() };
    guard = new ModuloHabilitadoGuard(
      reflector as unknown as Reflector,
      configuracionService as unknown as ConfiguracionService,
    );
  });

  it('permite rutas que no tienen un modulo configurado', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextFor('dirigente_equipo'))).resolves.toBe(true);
    expect(configuracionService.findOne).not.toHaveBeenCalled();
  });

  it.each(['master', 'directivo_liga'])(
    'permite al rol %s sin consultar el cierre operativo',
    async (role) => {
      await expect(guard.canActivate(contextFor(role))).resolves.toBe(true);
      expect(configuracionService.findOne).not.toHaveBeenCalled();
    },
  );

  it('permite al dirigente cuando el modulo esta habilitado', async () => {
    configuracionService.findOne.mockResolvedValue({ valor: 'true' });

    await expect(guard.canActivate(contextFor('dirigente_equipo'))).resolves.toBe(true);
    expect(configuracionService.findOne).toHaveBeenCalledWith('modulo_inscripciones');
  });

  it('bloquea al dirigente cuando el modulo esta deshabilitado', async () => {
    configuracionService.findOne.mockResolvedValue({ valor: 'false' });

    await expect(guard.canActivate(contextFor('dirigente_equipo'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
