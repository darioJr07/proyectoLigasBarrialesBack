import { ForbiddenException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService - cambio de contraseña', () => {
  let service: UsuariosService;
  let usuarioRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    usuarioRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (usuario) => usuario),
    };

    service = new UsuariosService(
      usuarioRepository as any,
      { findOne: jest.fn() } as any,
    );
  });

  it('permite al master cambiar la contraseña de cualquier usuario', async () => {
    usuarioRepository.findOne.mockResolvedValue({
      id: 20,
      ligaId: 2,
      rol: { nombre: 'dirigente_equipo' },
    });

    await expect(
      service.changePassword(
        20,
        { newPassword: 'nueva123' },
        { id: 1, rol: { nombre: 'master' } } as any,
      ),
    ).resolves.toEqual({ message: 'Contraseña actualizada correctamente' });

    expect(usuarioRepository.save).toHaveBeenCalledTimes(1);
  });

  it('permite al directivo cambiar la contraseña de un usuario de su liga', async () => {
    usuarioRepository.findOne.mockResolvedValue({
      id: 20,
      ligaId: 1,
      rol: { nombre: 'dirigente_equipo' },
    });

    await expect(
      service.changePassword(
        20,
        { newPassword: 'nueva123' },
        { id: 10, ligaId: 1, rol: { nombre: 'directivo_liga' } } as any,
      ),
    ).resolves.toEqual({ message: 'Contraseña actualizada correctamente' });
  });

  it('impide al directivo cambiar la contraseña de un usuario de otra liga', async () => {
    usuarioRepository.findOne.mockResolvedValue({
      id: 20,
      ligaId: 2,
      rol: { nombre: 'dirigente_equipo' },
    });

    await expect(
      service.changePassword(
        20,
        { newPassword: 'nueva123' },
        { id: 10, ligaId: 1, rol: { nombre: 'directivo_liga' } } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usuarioRepository.save).not.toHaveBeenCalled();
  });

  it('impide al directivo cambiar la contraseña del master', async () => {
    usuarioRepository.findOne.mockResolvedValue({
      id: 1,
      ligaId: 1,
      rol: { nombre: 'master' },
    });

    await expect(
      service.changePassword(
        1,
        { newPassword: 'nueva123' },
        { id: 10, ligaId: 1, rol: { nombre: 'directivo_liga' } } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite a los demás roles cambiar únicamente su propia contraseña', async () => {
    usuarioRepository.findOne.mockResolvedValue({
      id: 30,
      ligaId: 1,
      rol: { nombre: 'tesoreria' },
    });

    await expect(
      service.changePassword(
        30,
        { newPassword: 'nueva123' },
        { id: 30, ligaId: 1, rol: { nombre: 'tesoreria' } } as any,
      ),
    ).resolves.toEqual({ message: 'Contraseña actualizada correctamente' });

    usuarioRepository.findOne.mockResolvedValue({
      id: 31,
      ligaId: 1,
      rol: { nombre: 'dirigente_equipo' },
    });

    await expect(
      service.changePassword(
        31,
        { newPassword: 'nueva123' },
        { id: 30, ligaId: 1, rol: { nombre: 'tesoreria' } } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
