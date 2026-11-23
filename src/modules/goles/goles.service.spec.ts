import { GolesService } from './goles.service';

describe('GolesService - equipo actual del goleador', () => {
  let service: GolesService;
  let golesRepository: Record<string, jest.Mock>;
  let habilitacionesRepository: Record<string, jest.Mock>;
  let inscripcionesRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    golesRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
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

  it('distingue el equipo del jugador y el beneficiado en un autogol del historial', async () => {
    const autogol = {
      id: 55,
      partidoId: 8,
      campeonatoId: 5,
      categoriaId: 3,
      jugadorId: 7,
      jugador: { id: 7, nombre: 'Jugador Uno' },
      equipoId: 20,
      equipo: { id: 20, nombre: 'Equipo Visitante' },
      categoria: { id: 3, nombre: 'Primera' },
      minuto: 35,
      tipo: 'autogol',
      activo: true,
      partido: {
        id: 8,
        etapa: 'segunda_etapa',
        jornada: 4,
        fechaPartido: '2026-11-15',
        horaPartido: '12:00',
        golesLocal: 1,
        golesVisitante: 2,
        equipoLocalId: 10,
        equipoVisitanteId: 20,
        equipoLocal: { id: 10, nombre: 'Equipo Local' },
        equipoVisitante: { id: 20, nombre: 'Equipo Visitante' },
        campeonato: { id: 5, nombre: 'Campeonato 2026', ligaId: 2 },
      },
    };
    const queryBuilder: any = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      clone: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getMany: jest.fn()
        .mockResolvedValueOnce([autogol])
        .mockResolvedValueOnce([autogol])
        .mockResolvedValueOnce([autogol]),
    };
    for (const metodo of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) {
      queryBuilder[metodo].mockReturnValue(queryBuilder);
    }
    queryBuilder.clone.mockReturnValue(queryBuilder);
    golesRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const resultado = await service.getHistorial(
      { campeonatoId: 5, pagina: 1, limite: 20 },
      { role: 'directivo_liga', ligaId: 2 },
    );

    expect(resultado.items).toEqual([
      expect.objectContaining({
        jugadorNombre: 'Jugador Uno',
        equipoJugadorId: 10,
        equipoJugadorNombre: 'Equipo Local',
        equipoBeneficiadoId: 20,
        equipoBeneficiadoNombre: 'Equipo Visitante',
        rivalId: 20,
        tipo: 'autogol',
      }),
    ]);
    expect(resultado.resumen).toEqual({
      registros: 1,
      golesJugador: 0,
      penales: 0,
      autogoles: 1,
    });
    expect(resultado.opciones.equipos).toEqual([{ id: 10, nombre: 'Equipo Local' }]);
    expect(resultado.opciones.jugadores).toEqual([
      { id: 7, nombre: 'Jugador Uno', equipoIds: [10] },
    ]);
    expect(resultado.opciones.jornadasPorEtapa).toEqual({ segunda_etapa: [4] });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'campeonato.ligaId = :ligaUsuarioId',
      { ligaUsuarioId: 2 },
    );
  });
});
