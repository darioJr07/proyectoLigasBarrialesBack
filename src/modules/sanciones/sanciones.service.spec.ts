import { SancionesService } from './sanciones.service';

describe('SancionesService - sanciones despues de una transferencia', () => {
  let service: SancionesService;
  let sancionRepo: Record<string, jest.Mock>;
  let cumplidoRepo: Record<string, jest.Mock>;
  let excluidoRepo: Record<string, jest.Mock>;
  let habilitacionRepo: Record<string, jest.Mock>;
  let actaRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    sancionRepo = { find: jest.fn(), save: jest.fn(async (valor) => valor) };
    cumplidoRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => valor),
    };
    excluidoRepo = { findOne: jest.fn().mockResolvedValue(null) };
    habilitacionRepo = { find: jest.fn() };
    actaRepo = { find: jest.fn().mockResolvedValue([]) };

    service = new SancionesService(
      {} as any,
      {} as any,
      sancionRepo as any,
      cumplidoRepo as any,
      excluidoRepo as any,
      {} as any,
      habilitacionRepo as any,
      actaRepo as any,
      {} as any,
    );
  });

  it('cuenta el partido del equipo actual sin cambiar el equipo de origen de la sancion', async () => {
    habilitacionRepo.find.mockResolvedValue([
      { id: 50, jugadorId: 7, campeonatoId: 1, equipoId: 20, estado: 'habilitado', activo: true },
    ]);
    const sancion = {
      id: 3,
      jugadorId: 7,
      campeonatoId: 1,
      equipoId: 10,
      partidosSuspension: 3,
      partidosCumplidos: 1,
      fechaFinSuspension: null,
      suspensionActiva: true,
      activo: true,
    };
    sancionRepo.find.mockResolvedValue([sancion]);

    await service.procesarPartidosCumplidos(1, 20, 30, 99);

    expect(sancion.partidosCumplidos).toBe(2);
    expect(sancion.equipoId).toBe(10);
    expect(cumplidoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      sancionId: 3,
      partidoId: 99,
    }));
  });

  it('no cuenta un partido del equipo anterior cuando el jugador ya no esta habilitado alli', async () => {
    habilitacionRepo.find.mockResolvedValue([]);

    await service.procesarPartidosCumplidos(1, 10, 30, 100);

    expect(sancionRepo.find).not.toHaveBeenCalled();
    expect(cumplidoRepo.save).not.toHaveBeenCalled();
  });

  it('cierra una sancion temporal vencida y no la convierte en contador de partidos', async () => {
    habilitacionRepo.find.mockResolvedValue([
      { id: 50, jugadorId: 7, campeonatoId: 1, equipoId: 20, estado: 'habilitado', activo: true },
    ]);
    const sancion = {
      id: 4,
      jugadorId: 7,
      campeonatoId: 1,
      equipoId: 10,
      partidosSuspension: 0,
      partidosCumplidos: 0,
      fechaFinSuspension: '2020-01-01',
      suspensionActiva: true,
      activo: true,
    };
    sancionRepo.find.mockResolvedValue([sancion]);

    await service.procesarPartidosCumplidos(1, 20, 30, 101);

    expect(sancion.suspensionActiva).toBe(false);
    expect(cumplidoRepo.save).not.toHaveBeenCalled();
  });

  it('cuenta un resultado administrativo a favor del equipo actual del jugador', async () => {
    habilitacionRepo.find.mockResolvedValue([
      { id: 50, jugadorId: 7, campeonatoId: 1, equipoId: 20, estado: 'habilitado', activo: true },
    ]);
    const sancion = {
      id: 5,
      jugadorId: 7,
      campeonatoId: 1,
      equipoId: 10,
      partidosSuspension: 2,
      partidosCumplidos: 0,
      fechaFinSuspension: null,
      suspensionActiva: true,
      activo: true,
    };
    sancionRepo.find.mockResolvedValue([sancion]);

    await service.procesarResultadoEquipoExpulsado(1, 20, 102);

    expect(sancion.partidosCumplidos).toBe(1);
    expect(sancion.equipoId).toBe(10);
    expect(cumplidoRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      sancionId: 5,
      partidoId: 102,
      estadoPlanilla: 'equipo_expelido',
    }));
  });
});
