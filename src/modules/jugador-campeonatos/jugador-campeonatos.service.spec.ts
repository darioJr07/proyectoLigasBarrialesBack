import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JugadorCampeonatosService } from './jugador-campeonatos.service';

describe('JugadorCampeonatosService - ciclo de habilitaciones', () => {
  let service: JugadorCampeonatosService;
  let habilitacionRepo: Record<string, jest.Mock>;
  let jugadorRepo: Record<string, jest.Mock>;
  let campeonatoRepo: Record<string, jest.Mock>;
  let equipoRepo: Record<string, jest.Mock>;
  let categoriaRepo: Record<string, jest.Mock>;
  let inscripcionRepo: Record<string, jest.Mock>;
  let transferenciaRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    habilitacionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn((value) => value),
    };
    jugadorRepo = { findOne: jest.fn(), find: jest.fn() };
    campeonatoRepo = { findOne: jest.fn() };
    equipoRepo = { findOne: jest.fn() };
    categoriaRepo = { findOne: jest.fn() };
    inscripcionRepo = { findOne: jest.fn() };
    transferenciaRepo = { findOne: jest.fn() };
    dataSource = { transaction: jest.fn() };

    service = new JugadorCampeonatosService(
      habilitacionRepo as any,
      jugadorRepo as any,
      campeonatoRepo as any,
      equipoRepo as any,
      categoriaRepo as any,
      inscripcionRepo as any,
      transferenciaRepo as any,
      {} as any,
      dataSource as any,
    );
  });

  it('permite al master consultar cualquier campeonato sin liga asignada', async () => {
    campeonatoRepo.findOne.mockResolvedValue({ id: 5, ligaId: 9 });
    habilitacionRepo.find.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.findByCampeonato(5, { role: 'master', ligaId: null, equipoId: null }),
    ).resolves.toEqual([{ id: 1 }]);
  });

  it('bloquea a un directivo cuando el campeonato pertenece a otra liga', async () => {
    campeonatoRepo.findOne.mockResolvedValue({ id: 5, ligaId: 9 });

    await expect(
      service.findByCampeonato(5, { role: 'directivo_liga', ligaId: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(habilitacionRepo.find).not.toHaveBeenCalled();
  });

  it('reutiliza una solicitud rechazada del mismo equipo', async () => {
    const rechazada = {
      id: 77,
      jugadorId: 4,
      campeonatoId: 5,
      equipoId: 10,
      estado: 'rechazado',
      activo: false,
    };
    const reactivada = { ...rechazada, estado: 'pendiente', activo: true };

    campeonatoRepo.findOne.mockResolvedValue({
      id: 5,
      ligaId: 1,
      activo: true,
      estado: 'en_curso',
      maxJugadoresHabilitados: 20,
    });
    jugadorRepo.findOne.mockResolvedValue({ id: 4, equipoId: 10, activo: true });
    equipoRepo.findOne.mockResolvedValue({ id: 10, ligaId: 1, activo: true });
    inscripcionRepo.findOne.mockResolvedValue({ id: 30, estado: 'confirmada', activo: true });
    categoriaRepo.findOne.mockResolvedValue({ id: 3, campeonatoId: 5, activo: true });
    transferenciaRepo.findOne.mockResolvedValue(null);
    habilitacionRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(rechazada)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reactivada);
    habilitacionRepo.count.mockResolvedValue(2);

    const result = await service.create(
      {
        jugadorId: 4,
        campeonatoId: 5,
        equipoId: 10,
        categoriaId: 3,
        numeroCancha: 12,
        posicion: 'Delantero',
      },
      { role: 'dirigente_equipo', equipoId: 10, userId: 100 },
    );

    expect(habilitacionRepo.update).toHaveBeenCalledWith(
      { id: 77 },
      expect.objectContaining({ estado: 'pendiente', activo: true, solicitadoPor: 100 }),
    );
    expect(habilitacionRepo.findOne.mock.calls[1][0].where).toEqual(
      expect.objectContaining({ estado: 'rechazado', activo: false, equipoId: 10 }),
    );
    expect(habilitacionRepo.create).not.toHaveBeenCalled();
    expect(result).toEqual(reactivada);
  });

  it('vuelve a validar el cupo antes de aprobar', async () => {
    const pendiente = {
      id: 80,
      jugadorId: 4,
      campeonatoId: 5,
      equipoId: 10,
      numeroCancha: 12,
      estado: 'pendiente',
      activo: true,
      campeonato: { id: 5, ligaId: 1, maxJugadoresHabilitados: 2 },
    };
    habilitacionRepo.findOne
      .mockResolvedValueOnce(pendiente)
      .mockResolvedValueOnce(null);
    inscripcionRepo.findOne.mockResolvedValue({ id: 30, estado: 'confirmada', activo: true });
    jugadorRepo.findOne.mockResolvedValue({ id: 4, equipoId: 10, activo: true });
    habilitacionRepo.count.mockResolvedValue(2);

    await expect(
      service.aprobar(80, {}, { role: 'directivo_liga', ligaId: 1, userId: 200 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(habilitacionRepo.save).not.toHaveBeenCalled();
  });
});
