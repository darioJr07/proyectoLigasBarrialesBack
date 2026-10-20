import { ProgramacionSemanalService } from './programacion-semanal.service';

describe('ProgramacionSemanalService - programaciones confirmadas', () => {
  it('conserva los partidos en las bolillas despues de asignar fecha y hora', async () => {
    const programaciones = {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        ligaId: 2,
        campeonatoId: 4,
        categoriaId: null,
        etapa: 'segunda_etapa',
        jornada: 1,
        totalPartidos: 2,
        estado: 'confirmada',
      }),
    };
    const bolillas = {
      find: jest.fn().mockResolvedValue([
        { id: 1, numero: 1, partidoId: 11, estado: 'asignada', fecha: '2026-10-24', hora: '08:30', cancha: 'LIGA LA TOLITA' },
        { id: 2, numero: 2, partidoId: 12, estado: 'asignada', fecha: '2026-10-24', hora: '10:00', cancha: 'LIGA LA TOLITA' },
      ]),
    };
    const partidos = {
      find: jest.fn().mockResolvedValue([
        { id: 11, equipoLocal: { nombre: 'Equipo A' }, equipoVisitante: { nombre: 'Equipo B' }, categoria: { nombre: 'Primera' } },
        { id: 12, equipoLocal: { nombre: 'Equipo C' }, equipoVisitante: { nombre: 'Equipo D' }, categoria: { nombre: 'Primera' } },
      ]),
    };
    const service = new ProgramacionSemanalService(
      programaciones as any,
      bolillas as any,
      partidos as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const detalle = await service.detalle(8, { role: 'master' });

    expect(detalle.totalPartidos).toBe(2);
    expect(detalle.partidos).toHaveLength(2);
    expect(detalle.bolillas[0].partido).toEqual(expect.objectContaining({ id: 11 }));
    expect(detalle.bolillas[1].partido).toEqual(expect.objectContaining({ id: 12 }));
  });

  it('lista las sesiones confirmadas y conserva las de todas las categorías al filtrar', async () => {
    const programaciones = {
      find: jest.fn().mockResolvedValue([
        { id: 20, campeonatoId: 4, categoriaId: null, etapa: 'segunda_etapa', jornada: 2, estado: 'confirmada' },
        { id: 21, campeonatoId: 4, categoriaId: 7, etapa: 'segunda_etapa', jornada: 2, estado: 'confirmada' },
        { id: 22, campeonatoId: 4, categoriaId: 9, etapa: 'segunda_etapa', jornada: 2, estado: 'confirmada' },
      ]),
    };
    const campeonatos = {
      findOne: jest.fn().mockResolvedValue({ id: 4, ligaId: 2 }),
    };
    const service = new ProgramacionSemanalService(
      programaciones as any,
      {} as any,
      {} as any,
      campeonatos as any,
      {} as any,
      {} as any,
    );

    const resultado = await service.listarConfirmadas(4, 7, 'segunda_etapa', 2, { role: 'master' });

    expect(resultado.map(item => item.id)).toEqual([20, 21]);
    expect(programaciones.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { campeonatoId: 4, estado: 'confirmada', etapa: 'segunda_etapa', jornada: 2 },
    }));
  });

  it('propone la rotación circular correcta para los tres últimos partidos', async () => {
    const sesion = { id: 30, ligaId: 2, campeonatoId: 4, categoriaId: null, etapa: 'segunda_etapa', jornada: 3, totalPartidos: 3, estado: 'confirmada' };
    const partidosLista = [
      { id: 101, activo: true, equipoLocalId: 1, equipoVisitanteId: 2 },
      { id: 102, activo: true, equipoLocalId: 3, equipoVisitanteId: 4 },
      { id: 103, activo: true, equipoLocalId: 5, equipoVisitanteId: 6 },
    ];
    const bolillasLista = partidosLista.map((partido, indice) => ({
      id: indice + 1,
      numero: indice + 1,
      programacionId: 30,
      partidoId: partido.id,
      partido,
      estado: 'asignada',
      fecha: '2026-10-24',
      hora: ['13:30', '15:00', '16:30'][indice],
      cancha: 'Cancha central',
    }));
    const guardadas: any[] = [];
    const vocalias = {
      find: jest.fn().mockResolvedValueOnce([]).mockImplementation(async () => guardadas),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (items: any[]) => {
        guardadas.push(...items.map((item, indice) => ({ ...item, id: indice + 1 })));
        return guardadas;
      }),
    };
    const service = new ProgramacionSemanalService(
      { findOne: jest.fn().mockResolvedValue(sesion) } as any,
      { find: jest.fn().mockResolvedValue(bolillasLista) } as any,
      { find: jest.fn().mockResolvedValue(partidosLista) } as any,
      {} as any,
      vocalias as any,
      {} as any,
    );

    await service.prepararVocalias(30, { role: 'master', id: 1 });

    expect(guardadas.map(item => [item.partidoId, item.partidoOrigenId])).toEqual([
      [101, 103],
      [102, 101],
      [103, 102],
    ]);
    expect(guardadas.every(item => item.reglaAsignacion === 'cierre_tres')).toBe(true);
  });

  it('empareja los partidos y no aplica el cierre de tres cuando el total del día es par', async () => {
    const sesion = { id: 31, ligaId: 2, campeonatoId: 4, categoriaId: null, etapa: 'segunda_etapa', jornada: 4, totalPartidos: 4, estado: 'confirmada' };
    const partidosLista = [201, 202, 203, 204].map((id, indice) => ({ id, activo: true, equipoLocalId: indice * 2 + 1, equipoVisitanteId: indice * 2 + 2 }));
    const bolillasLista = partidosLista.map((partido, indice) => ({
      id: indice + 1,
      numero: indice + 1,
      programacionId: 31,
      partidoId: partido.id,
      partido,
      estado: 'asignada',
      fecha: '2026-10-25',
      hora: ['08:00', '09:30', '11:00', '12:30'][indice],
      cancha: indice < 2 ? 'Cancha A' : 'Cancha B',
    }));
    const guardadas: any[] = [];
    const vocalias = {
      find: jest.fn().mockResolvedValueOnce([]).mockImplementation(async () => guardadas),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (items: any[]) => {
        guardadas.push(...items.map((item, indice) => ({ ...item, id: indice + 1 })));
        return guardadas;
      }),
    };
    const service = new ProgramacionSemanalService(
      { findOne: jest.fn().mockResolvedValue(sesion) } as any,
      { find: jest.fn().mockResolvedValue(bolillasLista) } as any,
      { find: jest.fn().mockResolvedValue(partidosLista) } as any,
      {} as any,
      vocalias as any,
      {} as any,
    );

    await service.prepararVocalias(31, { role: 'master', id: 1 });

    expect(guardadas.map(item => [item.partidoId, item.partidoOrigenId])).toEqual([
      [201, 202],
      [202, 201],
      [203, 204],
      [204, 203],
    ]);
    expect(guardadas.every(item => item.reglaAsignacion === 'normal')).toBe(true);
  });
});
