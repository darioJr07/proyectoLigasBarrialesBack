import { ForbiddenException } from '@nestjs/common';
import { JugadoresService } from './jugadores.service';

describe('JugadoresService - permisos', () => {
  let service: JugadoresService;
  let jugadorRepo: Record<string, jest.Mock>;
  let equipoRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    jugadorRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    equipoRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    service = new JugadoresService(
      jugadorRepo as any,
      equipoRepo as any,
      { findOne: jest.fn() } as any,
      { deleteImage: jest.fn() } as any,
    );
  });

  it('permite al master consultar cualquier equipo sin liga ni equipo asignados', async () => {
    const jugadores = [{ id: 1, nombre: 'Jugador Uno', equipoId: 20 }];
    jugadorRepo.find.mockResolvedValue(jugadores);

    await expect(
      service.findByEquipo(20, { role: 'master', ligaId: null, equipoId: null }),
    ).resolves.toEqual(jugadores);

    expect(equipoRepo.findOne).not.toHaveBeenCalled();
  });

  it('impide que un directivo consulte jugadores de otra liga', async () => {
    equipoRepo.findOne.mockResolvedValue({ id: 20, ligaId: 2, activo: true });

    await expect(
      service.findByEquipo(20, { role: 'directivo_liga', ligaId: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(jugadorRepo.find).not.toHaveBeenCalled();
  });

  it('impide que un dirigente consulte jugadores de otro equipo', async () => {
    equipoRepo.findOne.mockResolvedValue({ id: 20, ligaId: 1, activo: true });

    await expect(
      service.findByEquipo(20, { role: 'dirigente_equipo', equipoId: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reserva la consulta de jugadores libres para el master', async () => {
    await expect(
      service.findLibres({ role: 'directivo_liga', ligaId: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    jugadorRepo.find.mockResolvedValue([]);
    await expect(service.findLibres({ role: 'master' })).resolves.toEqual([]);
  });
});
