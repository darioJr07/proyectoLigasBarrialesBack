import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActaPartidoService } from './acta-partido.service';

describe('ActaPartidoService - seguridad e integridad de la planilla', () => {
  const crearServicio = (overrides: Record<string, any> = {}) => {
    const actaRepo = overrides.actaRepo ?? {
      find: jest.fn().mockResolvedValue([]),
      manager: { transaction: jest.fn() },
    };
    const partidoRepo = overrides.partidoRepo ?? { findOne: jest.fn() };
    const jugadorCampeonatoRepo = overrides.jugadorCampeonatoRepo ?? { find: jest.fn() };
    const sancionRepo = overrides.sancionRepo ?? { find: jest.fn().mockResolvedValue([]) };
    const sancionPartidoExcluidoRepo = overrides.sancionPartidoExcluidoRepo ?? { find: jest.fn() };

    const service = new ActaPartidoService(
      actaRepo as any,
      partidoRepo as any,
      jugadorCampeonatoRepo as any,
      sancionRepo as any,
      sancionPartidoExcluidoRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, actaRepo, partidoRepo, jugadorCampeonatoRepo };
  };

  const partidoBase = {
    id: 10,
    campeonatoId: 1,
    categoriaId: 2,
    equipoLocalId: 20,
    equipoVisitanteId: 30,
    estado: 'programado',
    campeonato: { ligaId: 5 },
  };

  it('impide que un dirigente modifique la planilla aunque su equipo participe', async () => {
    const { service, partidoRepo } = crearServicio();
    partidoRepo.findOne.mockResolvedValue(partidoBase);

    await expect(
      service.guardarAlineacion(
        partidoBase.id,
        { jugadores: [] },
        { role: 'dirigente_equipo', equipoId: partidoBase.equipoLocalId },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza jugadores duplicados antes de reemplazar la planilla', async () => {
    const { service, partidoRepo, actaRepo } = crearServicio();
    partidoRepo.findOne.mockResolvedValue(partidoBase);

    await expect(
      service.guardarAlineacion(
        partidoBase.id,
        {
          jugadores: [
            { jugadorId: 100, equipoId: 20, estado: 'jugo' },
            { jugadorId: 100, equipoId: 20, estado: 'no_jugo' },
          ],
        },
        { role: 'master', userId: 1 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(actaRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('exige un motivo al corregir la planilla de un partido jugado', async () => {
    const { service, partidoRepo } = crearServicio();
    partidoRepo.findOne.mockResolvedValue({ ...partidoBase, estado: 'jugado' });

    await expect(
      service.guardarAlineacion(
        partidoBase.id,
        { permitirCorreccion: true, jugadores: [] },
        { role: 'master', userId: 1 },
      ),
    ).rejects.toThrow('Debe indicar un motivo');
  });

  it('permite conservar en una correccion a un jugador que ya constaba historicamente', async () => {
    const anterior = {
      id: 1,
      partidoId: 10,
      campeonatoId: 1,
      equipoId: 20,
      jugadorId: 100,
      estado: 'jugo',
      numeroCancha: 9,
      observaciones: null,
      activo: true,
    };
    const actaTx = {
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (registros) => registros),
    };
    const historialTx = {
      create: jest.fn().mockImplementation((registro) => registro),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValueOnce(actaTx).mockReturnValueOnce(historialTx),
    };
    const actaRepo = {
      find: jest.fn().mockResolvedValue([anterior]),
      manager: {
        transaction: jest.fn().mockImplementation(async (callback) => callback(manager)),
      },
    };
    const { service, partidoRepo, jugadorCampeonatoRepo } = crearServicio({ actaRepo });
    partidoRepo.findOne.mockResolvedValue({ ...partidoBase, estado: 'jugado' });
    jugadorCampeonatoRepo.find.mockResolvedValue([]);

    await service.guardarAlineacion(
      partidoBase.id,
      {
        permitirCorreccion: true,
        motivoCorreccion: 'Correccion confirmada en el acta',
        jugadores: [{ jugadorId: 100, equipoId: 20, estado: 'expulsado', numeroCancha: 9 }],
      },
      { role: 'master', userId: 1 },
    );

    expect(actaTx.delete).toHaveBeenCalledWith({ partidoId: partidoBase.id });
    expect(historialTx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        partidoId: partidoBase.id,
        usuarioId: 1,
        motivo: 'Correccion confirmada en el acta',
      }),
    );
  });
});
