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
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
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
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
    );

    const resultado = await service.listarConfirmadas(4, 7, 'segunda_etapa', 2, { role: 'master' });

    expect(resultado.map(item => item.id)).toEqual([20, 21]);
    expect(programaciones.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { campeonatoId: 4, estado: 'confirmada', etapa: 'segunda_etapa' },
    }));
  });

  it('encuentra una programacion mixta por la jornada secundaria de una categoria', async () => {
    const programacion = {
      id: 25, campeonatoId: 4, categoriaId: null, etapa: 'segunda_etapa', jornada: 3, estado: 'confirmada',
    };
    const service = new ProgramacionSemanalService(
      { find: jest.fn().mockResolvedValue([programacion]) } as any,
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue({ id: 4, ligaId: 2 }) } as any,
      {} as any,
      {} as any,
      { find: jest.fn().mockResolvedValue([
        { id: 1, programacionId: 25, categoriaId: 7, jornada: 3 },
        { id: 2, programacionId: 25, categoriaId: 9, jornada: 4 },
      ]) } as any,
      {} as any,
    );

    const resultado = await service.listarConfirmadas(4, 9, 'segunda_etapa', 4, { role: 'master' });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toEqual(expect.objectContaining({
      id: 25,
      selecciones: [
        { categoriaId: 7, jornada: 3 },
        { categoriaId: 9, jornada: 4 },
      ],
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
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
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
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
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

  it('vincula una solicitud aprobada con la bolilla compatible', async () => {
    const solicitud: any = {
      id: 50, partidoId: 301, estado: 'aprobada', fechaSolicitada: '2026-11-01',
      horaSolicitada: '10:00', canchaSolicitada: 'Cancha central', programacionId: null, bolillaId: null,
    };
    const bolilla: any = { id: 70, programacionId: 40, numero: 1, fecha: '2026-11-01', hora: '10:00', cancha: 'Cancha central', estado: 'disponible', partidoId: null };
    const solicitudes = { findOne: jest.fn().mockResolvedValue(solicitud) };
    const bolillas = { findOne: jest.fn().mockResolvedValue(null) };
    const manager = { save: jest.fn(async (_entidad: any, item: any) => item), update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const dataSource = { transaction: jest.fn(async (callback: any) => callback(manager)) };
    const service = new ProgramacionSemanalService(
      {} as any, bolillas as any, {} as any, {} as any, {} as any, solicitudes as any, {} as any, dataSource as any,
    );
    jest.spyOn(service, 'detalle').mockResolvedValue({
      id: 40, estado: 'en_sorteo',
      partidos: [{ id: 301, estado: 'programado', fechaPartido: null, horaPartido: null, cancha: 'Cancha central' }],
      bolillas: [bolilla],
    } as any);

    await service.asignarManual(40, 301, 70, { role: 'master' }, 50);

    expect(bolilla).toEqual(expect.objectContaining({ partidoId: 301, estado: 'asignada', asignacionManual: true, solicitudHorarioId: 50 }));
    expect(manager.update).toHaveBeenCalledWith(expect.any(Function), 50, { programacionId: 40, bolillaId: 70 });
  });

  it('devuelve un mensaje controlado si la solicitud ya pertenece a otro sorteo en curso', async () => {
    const solicitud: any = { id: 52, partidoId: 303, estado: 'aprobada', fechaSolicitada: '2026-11-01', horaSolicitada: '10:00', canchaSolicitada: 'Cancha central' };
    const bolilla: any = { id: 73, programacionId: 43, fecha: '2026-11-01', hora: '10:00', cancha: 'Cancha central', estado: 'disponible', partidoId: null };
    const service = new ProgramacionSemanalService(
      { findOne: jest.fn().mockResolvedValue({ id: 42, etapa: 'segunda_etapa', jornada: 3 }) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 72, programacionId: 42, solicitudHorarioId: 52 }) } as any,
      {} as any, {} as any, {} as any,
      { findOne: jest.fn().mockResolvedValue(solicitud) } as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'detalle').mockResolvedValue({
      id: 43, estado: 'en_sorteo',
      partidos: [{ id: 303, estado: 'programado', fechaPartido: null, horaPartido: null, cancha: 'Cancha central' }],
      bolillas: [bolilla],
    } as any);

    await expect(service.asignarManual(43, 303, 73, { role: 'master' }, 52))
      .rejects.toThrow('Esta solicitud ya está asignada al sorteo en curso #42');
  });

  it('al liberar una bolilla elimina el vínculo de la solicitud aprobada', async () => {
    const bolilla: any = { id: 71, programacionId: 41, partidoId: 302, estado: 'asignada', solicitudHorarioId: 51, asignacionManual: true };
    const solicitudes = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const bolillas = { save: jest.fn(async (item: any) => item) };
    const service = new ProgramacionSemanalService(
      {} as any, bolillas as any, {} as any, {} as any, {} as any, solicitudes as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'detalle')
      .mockResolvedValueOnce({ id: 41, estado: 'en_sorteo', partidos: [], bolillas: [bolilla] } as any)
      .mockResolvedValueOnce({ id: 41, estado: 'en_sorteo', partidos: [], bolillas: [bolilla], solicitudesHorario: [] } as any);

    await service.liberarBolilla(41, 71, { role: 'master' });

    expect(solicitudes.update).toHaveBeenCalledWith(51, { programacionId: null, bolillaId: null });
    expect(bolilla).toEqual(expect.objectContaining({ partidoId: null, estado: 'disponible', solicitudHorarioId: null, asignacionManual: false }));
  });

  it('guarda como extractor exactamente al equipo seleccionado en el nuevo sorteo de vocalia', async () => {
    const vocalias = {
      findOne: jest.fn().mockResolvedValue({
        id: 80,
        programacionId: 50,
        partidoId: 500,
        tipoAsignacion: 'sorteo',
        estado: 'pendiente',
        partidoOrigen: { equipoLocalId: 11, equipoVisitanteId: 12 },
        equipoExtractor: { id: 12, nombre: 'Extractor anterior' },
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new ProgramacionSemanalService(
      {} as any, {} as any, {} as any, {} as any, vocalias as any, {} as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'detalle').mockResolvedValue({
      bolillas: [{ partidoId: 500, fecha: '2026-10-31', hora: '12:00', partido: { equipoLocalId: 21, equipoVisitanteId: 22 } }],
    } as any);
    jest.spyOn(service, 'obtenerVocalias').mockResolvedValue({ estado: 'en_preparacion', vocalias: [] } as any);

    await service.sortearVocalia(50, 80, 11, { role: 'master' });

    const cambios = vocalias.update.mock.calls[0][1];
    expect(cambios.equipoExtractorId).toBe(11);
    expect(['si', 'no']).toContain(cambios.resultadoBolilla);
    expect(cambios.equipoVocalId).toBe(cambios.resultadoBolilla === 'si' ? 11 : 12);
  });

  it('libera una vocalia limpiando resultado, extractor y vocal aunque existan relaciones anteriores', async () => {
    const vocalias = {
      findOne: jest.fn().mockResolvedValue({
        id: 81,
        programacionId: 51,
        estado: 'asignada',
        equipoExtractorId: 11,
        equipoExtractor: { id: 11 },
        resultadoBolilla: 'si',
        equipoVocalId: 11,
        equipoVocal: { id: 11 },
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new ProgramacionSemanalService(
      {} as any, {} as any, {} as any, {} as any, vocalias as any, {} as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'detalle').mockResolvedValue({ estado: 'confirmada' } as any);
    jest.spyOn(service, 'obtenerVocalias').mockResolvedValue({ estado: 'en_preparacion', vocalias: [] } as any);

    await service.liberarVocalia(51, 81, { role: 'master' });

    expect(vocalias.update).toHaveBeenCalledWith(81, {
      equipoExtractorId: null,
      resultadoBolilla: null,
      equipoVocalId: null,
      directivoNombre: null,
      estado: 'pendiente',
    });
  });
});
