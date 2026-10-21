import { GolesService } from './goles.service';

describe('GolesService - equipo actual del goleador', () => {
  let service: GolesService;
  let golesRepository: Record<string, jest.Mock>;
  let habilitacionesRepository: Record<string, jest.Mock>;
  let inscripcionesRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    golesRepository = { find: jest.fn() };
    habilitacionesRepository = { find: jest.fn() };
    inscripcionesRepository = { find: jest.fn() };
    service = new GolesService(
      golesRepository as any,
      habilitacionesRepository as any,
      inscripcionesRepository as any,
      {
        resolverNumerosActuales: jest.fn(async (habilitaciones: any[]) =>
          new Map(habilitaciones.map(item => [item.id, item.numeroCancha])),
        ),
      } as any,
    );
  });

  it('conserva los goles acumulados y muestra el equipo de la habilitación vigente', async () => {
    golesRepository.find.mockResolvedValue([
      {
        id: 1,
        jugadorId: 7,
        tipo: 'normal',
        jugador: { id: 7, nombre: 'Jugador Uno', equipoId: 20, equipo: { id: 20, nombre: 'Equipo B' } },
        equipoId: 10,
        equipo: { id: 10, nombre: 'Equipo A' },
      },
      {
        id: 2,
        jugadorId: 7,
        tipo: 'penal',
        jugador: { id: 7, nombre: 'Jugador Uno', equipoId: 20, equipo: { id: 20, nombre: 'Equipo B' } },
        equipoId: 20,
        equipo: { id: 20, nombre: 'Equipo B' },
      },
    ]);
    habilitacionesRepository.find.mockResolvedValue([
      {
        id: 30,
        jugadorId: 7,
        equipoId: 20,
        equipo: { id: 20, nombre: 'Equipo B' },
        numeroCancha: 9,
        estado: 'habilitado',
        activo: true,
      },
    ]);
    inscripcionesRepository.find.mockResolvedValue([{ equipoId: 20 }]);

    const resultado = await service.getGoleadoresPorCategoria(5, 3);

    expect(resultado).toEqual([
      expect.objectContaining({
        jugadorId: 7,
        equipoId: 20,
        equipoNombre: 'Equipo B',
        numeroCancha: 9,
        total: 2,
        penales: 1,
      }),
    ]);
  });

  it('usa el equipo actual tras la transferencia aunque la nueva habilitación siga pendiente', async () => {
    golesRepository.find.mockResolvedValue([
      {
        id: 1,
        jugadorId: 7,
        tipo: 'normal',
        jugador: { id: 7, nombre: 'Jugador Uno', equipoId: 20, equipo: { id: 20, nombre: 'Equipo B' } },
        equipoId: 10,
        equipo: { id: 10, nombre: 'Equipo A' },
      },
    ]);
    habilitacionesRepository.find.mockResolvedValue([]);
    inscripcionesRepository.find.mockResolvedValue([{ equipoId: 20 }]);

    const [resultado] = await service.getGoleadoresPorCategoria(5, 3);

    expect(resultado).toEqual(expect.objectContaining({
      equipoId: 20,
      equipoNombre: 'Equipo B',
      total: 1,
      numeroCancha: null,
    }));
  });

  it('no muestra un equipo actual que pertenece a otra categoría', async () => {
    golesRepository.find.mockResolvedValue([
      {
        id: 1,
        jugadorId: 7,
        tipo: 'normal',
        jugador: { id: 7, nombre: 'Jugador Uno', equipoId: 30, equipo: { id: 30, nombre: 'Equipo C' } },
        equipoId: 10,
        equipo: { id: 10, nombre: 'Equipo A' },
      },
    ]);
    habilitacionesRepository.find.mockResolvedValue([]);
    inscripcionesRepository.find.mockResolvedValue([]);

    const [resultado] = await service.getGoleadoresPorCategoria(5, 3);

    expect(resultado).toEqual(expect.objectContaining({
      equipoId: 10,
      equipoNombre: 'Equipo A',
      total: 1,
    }));
  });
});
