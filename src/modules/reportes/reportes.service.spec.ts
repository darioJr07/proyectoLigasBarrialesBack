import { ForbiddenException } from '@nestjs/common';
import { ReportesService } from './reportes.service';

const queryBuilder = (resultado: any, metodo: 'getRawMany' | 'getMany' | 'getCount') => {
  const query: any = {};
  for (const nombre of [
    'select',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'innerJoin',
    'innerJoinAndSelect',
    'leftJoin',
    'leftJoinAndSelect',
  ]) {
    query[nombre] = jest.fn().mockReturnValue(query);
  }
  query[metodo] = jest.fn().mockResolvedValue(resultado);
  return query;
};

describe('ReportesService', () => {
  const campeonato = {
    id: 7,
    nombre: 'Campeonato 2026',
    ligaId: 2,
    liga: { nombre: 'Liga de prueba' },
    activo: true,
  };

  const crearServicio = (sobrescrituras: Record<string, any> = {}) => {
    const repositorios = {
      campeonatos: { findOne: jest.fn().mockResolvedValue(campeonato) },
      categorias: { findOne: jest.fn() },
      partidos: {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder([], 'getRawMany')),
      },
      goles: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder([], 'getMany')) },
      inscripciones: { find: jest.fn().mockResolvedValue([]) },
      habilitaciones: {
        count: jest.fn().mockResolvedValue(0),
        find: jest.fn().mockResolvedValue([]),
      },
      sanciones: {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder(0, 'getCount')),
      },
      equipos: { findOne: jest.fn() },
      jugadores: { findOne: jest.fn() },
      transferencias: { find: jest.fn().mockResolvedValue([]) },
      cambiosDorsal: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder([], 'getMany')) },
      alineaciones: { find: jest.fn().mockResolvedValue([]) },
      incidencias: { find: jest.fn().mockResolvedValue([]) },
      ...sobrescrituras,
    };

    const servicio = new ReportesService(
      repositorios.campeonatos as any,
      repositorios.categorias as any,
      repositorios.partidos as any,
      repositorios.goles as any,
      repositorios.inscripciones as any,
      repositorios.habilitaciones as any,
      repositorios.sanciones as any,
      repositorios.equipos as any,
      repositorios.jugadores as any,
      repositorios.transferencias as any,
      repositorios.cambiosDorsal as any,
      repositorios.alineaciones as any,
      repositorios.incidencias as any,
    );
    return { servicio, repositorios };
  };

  it('impide consultar un campeonato de otra liga', async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.obtenerReporteCampeonato(
        { campeonatoId: campeonato.id },
        { role: 'directivo_liga', ligaId: 9 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impide que un dirigente consulte el reporte de otro equipo', async () => {
    const { servicio } = crearServicio({
      equipos: { findOne: jest.fn().mockResolvedValue({ id: 20, ligaId: 2, activo: true }) },
    });

    await expect(
      servicio.obtenerReporteEquipo(
        { campeonatoId: campeonato.id, equipoId: 20 },
        { role: 'dirigente_equipo', ligaId: 2, equipoId: 10 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impide que un dirigente consulte un jugador que ya no pertenece a su equipo', async () => {
    const { servicio } = crearServicio({
      jugadores: { findOne: jest.fn().mockResolvedValue({ id: 30, equipoId: 20 }) },
      habilitaciones: {
        count: jest.fn().mockResolvedValue(0),
        find: jest.fn().mockResolvedValue([{
          id: 1, jugadorId: 30, campeonatoId: 7, equipoId: 20,
          estado: 'habilitado', activo: true,
        }]),
      },
    });

    await expect(
      servicio.obtenerReporteJugador(
        { campeonatoId: campeonato.id, jugadorId: 30 },
        { role: 'dirigente_equipo', ligaId: 2, equipoId: 10 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resume partidos, rendimiento y goleadores sin modificar datos', async () => {
    const equipoLocal = { id: 10, nombre: 'Local' };
    const equipoVisitante = { id: 20, nombre: 'Visitante' };
    const partidos = [
      {
        id: 1,
        campeonatoId: 7,
        equipoLocalId: 10,
        equipoVisitanteId: 20,
        equipoLocal,
        equipoVisitante,
        estado: 'jugado',
        golesLocal: 3,
        golesVisitante: 1,
        sancionado: null,
      },
      {
        id: 2,
        campeonatoId: 7,
        equipoLocalId: 20,
        equipoVisitanteId: 10,
        equipoLocal: equipoVisitante,
        equipoVisitante: equipoLocal,
        estado: 'programado',
        golesLocal: null,
        golesVisitante: null,
        sancionado: null,
      },
    ];
    const gol = {
      id: 1,
      jugadorId: 30,
      jugador: { nombre: 'Jugador Uno' },
      equipoId: 10,
      equipo: equipoLocal,
      tipo: 'normal',
    };
    const { servicio } = crearServicio({
      partidos: {
        find: jest.fn().mockResolvedValue(partidos),
        createQueryBuilder: jest.fn().mockReturnValue(
          queryBuilder([{ etapa: 'segunda_etapa' }], 'getRawMany'),
        ),
      },
      goles: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder([gol], 'getMany')),
      },
      inscripciones: {
        find: jest.fn().mockResolvedValue([
          { equipoId: 10, equipo: equipoLocal },
          { equipoId: 20, equipo: equipoVisitante },
        ]),
      },
      habilitaciones: {
        count: jest.fn().mockResolvedValue(22),
        find: jest.fn().mockResolvedValue([
          { jugadorId: 30, equipoId: 10, equipo: equipoLocal },
        ]),
      },
      sanciones: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder(1, 'getCount')),
      },
    });

    const reporte = await servicio.obtenerReporteCampeonato(
      { campeonatoId: campeonato.id },
      { role: 'directivo_liga', ligaId: campeonato.ligaId },
    );

    expect(reporte.resumen).toMatchObject({
      totalPartidos: 2,
      partidosJugados: 1,
      partidosPendientes: 1,
      porcentajeAvance: 50,
      totalGoles: 4,
      promedioGoles: 4,
      totalEquipos: 2,
      jugadoresHabilitados: 22,
      sancionesActivas: 1,
    });
    expect(reporte.rendimientoEquipos[0]).toMatchObject({
      equipoId: 10,
      pj: 1,
      pg: 1,
      gf: 3,
      gc: 1,
      dg: 2,
      efectividad: 100,
    });
    expect(reporte.goleadores[0]).toMatchObject({
      jugadorId: 30,
      equipoId: 10,
      goles: 1,
    });
  });

  it('reconstruye la plantilla historica aunque la categoria actual haya cambiado', async () => {
    const categoriaMaxima = { id: 1, campeonatoId: 7, nombre: 'MAXIMA', activo: true };
    const categoriaPrimera = { id: 2, campeonatoId: 7, nombre: 'PRIMERA', activo: true };
    const equipo = { id: 10, ligaId: 2, nombre: 'Vasco', activo: true };
    const jugador = { id: 30, nombre: 'Jugador Historico', cedula: '1234567890' };
    const partido = {
      id: 1,
      campeonatoId: 7,
      categoriaId: 1,
      etapa: 'primera_etapa',
      equipoLocalId: 10,
      equipoVisitanteId: 20,
      equipoLocal: equipo,
      equipoVisitante: { id: 20, nombre: 'Rival' },
      estado: 'jugado',
      golesLocal: 1,
      golesVisitante: 0,
      fechaPartido: new Date('2026-06-01T12:00:00Z'),
      jornada: 1,
      activo: true,
    };
    const { servicio } = crearServicio({
      categorias: { findOne: jest.fn().mockResolvedValue(categoriaMaxima) },
      equipos: { findOne: jest.fn().mockResolvedValue(equipo) },
      partidos: {
        find: jest.fn().mockResolvedValue([partido]),
        createQueryBuilder: jest.fn().mockReturnValue(
          queryBuilder([{ etapa: 'primera_etapa' }], 'getRawMany'),
        ),
      },
      inscripciones: {
        find: jest.fn().mockResolvedValue([
          {
            id: 1,
            campeonatoId: 7,
            equipoId: 10,
            categoriaId: 1,
            categoria: categoriaMaxima,
            equipo,
            estado: 'transferida',
            motivo: 'descenso',
            fechaInscripcion: new Date('2026-03-01T12:00:00Z'),
            activo: true,
          },
          {
            id: 2,
            campeonatoId: 7,
            equipoId: 10,
            categoriaId: 2,
            categoria: categoriaPrimera,
            equipo,
            estado: 'confirmada',
            motivo: null,
            fechaInscripcion: new Date('2026-08-01T12:00:00Z'),
            activo: true,
          },
        ]),
      },
      habilitaciones: {
        count: jest.fn().mockResolvedValue(1),
        find: jest.fn().mockResolvedValue([{
          id: 100,
          campeonatoId: 7,
          jugadorId: 30,
          jugador,
          equipoId: 10,
          equipo,
          categoriaId: 2,
          categoria: categoriaPrimera,
          numeroCancha: 9,
          posicion: 'Delantero',
          estado: 'habilitado',
          tipoSolicitud: 'normal',
          fechaInscripcion: new Date('2026-03-10T12:00:00Z'),
          fechaAprobacion: new Date('2026-03-15T12:00:00Z'),
          fechaBaja: null,
          activo: true,
        }]),
      },
    });

    const reporte = await servicio.obtenerReporteEquipo(
      {
        campeonatoId: campeonato.id,
        equipoId: equipo.id,
        categoriaId: categoriaMaxima.id,
        etapa: 'primera_etapa',
      },
      { role: 'directivo_liga', ligaId: campeonato.ligaId },
    );

    expect(reporte.contexto).toMatchObject({
      categoriaNombre: 'MAXIMA',
      categoriaActualNombre: 'PRIMERA',
    });
    expect(reporte.plantilla).toHaveLength(1);
    expect(reporte.plantilla[0]).toMatchObject({
      jugadorId: 30,
      categoriaHistoricaNombre: 'MAXIMA',
      categoriaActualNombre: 'PRIMERA',
      estado: 'habilitado',
    });
    expect(reporte.movimientosCategoria[0]).toMatchObject({
      categoriaOrigenNombre: 'MAXIMA',
      categoriaDestinoNombre: 'PRIMERA',
      motivo: 'descenso',
    });
  });

  it('cuenta las bajas manuales y las generadas por transferencias', async () => {
    const categoria = { id: 1, campeonatoId: 7, nombre: 'MAXIMA', activo: true };
    const equipo = { id: 10, ligaId: 2, nombre: 'Equipo origen', activo: true };
    const datosBase = {
      campeonatoId: 7,
      equipoId: 10,
      equipo,
      categoriaId: 1,
      categoria,
      numeroCancha: 1,
      posicion: 'Jugador',
      tipoSolicitud: 'normal',
      fechaInscripcion: new Date('2026-03-01T12:00:00Z'),
      fechaAprobacion: new Date('2026-03-02T12:00:00Z'),
    };
    const { servicio } = crearServicio({
      equipos: { findOne: jest.fn().mockResolvedValue(equipo) },
      inscripciones: {
        find: jest.fn().mockResolvedValue([{
          id: 1,
          campeonatoId: 7,
          equipoId: 10,
          equipo,
          categoriaId: 1,
          categoria,
          estado: 'confirmada',
          fechaInscripcion: new Date('2026-02-01T12:00:00Z'),
          activo: true,
        }]),
      },
      habilitaciones: {
        count: jest.fn().mockResolvedValue(1),
        find: jest.fn().mockResolvedValue([
          {
            ...datosBase,
            id: 100,
            jugadorId: 30,
            jugador: { id: 30, nombre: 'Jugador activo', cedula: '100' },
            estado: 'habilitado',
            activo: true,
            fechaBaja: null,
          },
          {
            ...datosBase,
            id: 101,
            jugadorId: 31,
            jugador: { id: 31, nombre: 'Jugador transferido', cedula: '101' },
            estado: 'baja',
            activo: false,
            fechaBaja: null,
            observaciones: 'Baja automatica por transferencia aprobada',
          },
          {
            ...datosBase,
            id: 102,
            jugadorId: 32,
            jugador: { id: 32, nombre: 'Jugador dado de baja', cedula: '102' },
            estado: 'baja',
            activo: false,
            fechaBaja: new Date('2026-05-10T12:00:00Z'),
            motivoBaja: 'Baja solicitada por el equipo',
          },
        ]),
      },
      transferencias: {
        find: jest.fn().mockResolvedValue([{
          id: 50,
          jugadorId: 31,
          campeonatoId: 7,
          equipoOrigenId: 10,
          equipoDestinoId: 20,
          estadoEquipoOrigen: 'aprobado',
          estadoDirectivo: 'aprobado',
          fechaSolicitud: new Date('2026-06-01T12:00:00Z'),
          fechaAprobacionOrigen: new Date('2026-06-02T12:00:00Z'),
          fechaAprobacionDirectivo: new Date('2026-06-03T12:00:00Z'),
          activo: true,
        }]),
      },
    });

    const reporte = await servicio.obtenerReporteEquipo(
      { campeonatoId: campeonato.id, equipoId: equipo.id },
      { role: 'directivo_liga', ligaId: campeonato.ligaId },
    );

    expect(reporte.resumen).toMatchObject({ habilitados: 1, pendientes: 0, bajas: 2 });
    expect(reporte.plantilla.filter((item) => item.estado === 'baja')).toHaveLength(2);
  });

  it('lista al jugador en su equipo historico y no en el destino antes de la transferencia', async () => {
    const categoria = { id: 1, campeonatoId: 7, nombre: 'MAXIMA', activo: true };
    const equipoOrigen = { id: 10, ligaId: 2, nombre: 'Equipo origen', activo: true };
    const equipoDestino = { id: 20, ligaId: 2, nombre: 'Equipo destino', activo: true };
    const jugador = {
      id: 30,
      nombre: 'Jugador transferido',
      cedula: '1234567890',
      equipoId: 20,
      equipo: equipoDestino,
    };
    const partido = (equipo: any) => ({
      id: equipo.id,
      campeonatoId: 7,
      categoriaId: 1,
      etapa: 'primera_etapa',
      equipoLocalId: equipo.id,
      equipoVisitanteId: 99,
      fechaPartido: new Date('2026-06-01T12:00:00Z'),
      jornada: 1,
      activo: true,
    });
    const transferencia = {
      id: 50,
      jugadorId: 30,
      campeonatoId: 7,
      equipoOrigenId: 10,
      equipoDestinoId: 20,
      estadoEquipoOrigen: 'aprobado',
      estadoDirectivo: 'aprobado',
      fechaSolicitud: new Date('2026-08-01T12:00:00Z'),
      fechaAprobacionOrigen: new Date('2026-08-02T12:00:00Z'),
      fechaAprobacionDirectivo: new Date('2026-08-03T12:00:00Z'),
      activo: true,
    };
    const crearOpciones = (equipo: any, habilitacion: any) => crearServicio({
      categorias: { findOne: jest.fn().mockResolvedValue(categoria) },
      equipos: { findOne: jest.fn().mockResolvedValue(equipo) },
      partidos: {
        find: jest.fn().mockResolvedValue([partido(equipo)]),
        createQueryBuilder: jest.fn().mockReturnValue(
          queryBuilder([{ etapa: 'primera_etapa' }], 'getRawMany'),
        ),
      },
      inscripciones: {
        find: jest.fn().mockResolvedValue([{
          id: equipo.id,
          campeonatoId: 7,
          equipoId: equipo.id,
          categoriaId: 1,
          categoria,
          equipo,
          estado: 'confirmada',
          fechaInscripcion: new Date('2026-02-01T12:00:00Z'),
          activo: true,
        }]),
      },
      habilitaciones: {
        count: jest.fn().mockResolvedValue(1),
        find: jest.fn().mockResolvedValue([habilitacion]),
      },
      transferencias: { find: jest.fn().mockResolvedValue([transferencia]) },
    }).servicio;

    const servicioOrigen = crearOpciones(equipoOrigen, {
      id: 100,
      campeonatoId: 7,
      jugadorId: 30,
      jugador,
      equipoId: 10,
      equipo: equipoOrigen,
      categoriaId: 1,
      categoria,
      numeroCancha: 9,
      posicion: 'Delantero',
      estado: 'baja',
      fechaInscripcion: new Date('2026-03-01T12:00:00Z'),
      fechaAprobacion: new Date('2026-03-02T12:00:00Z'),
      fechaBaja: null,
      activo: false,
    });
    const servicioDestino = crearOpciones(equipoDestino, {
      id: 101,
      campeonatoId: 7,
      jugadorId: 30,
      jugador,
      equipoId: 20,
      equipo: equipoDestino,
      categoriaId: 1,
      categoria,
      numeroCancha: 9,
      posicion: 'Delantero',
      estado: 'habilitado',
      fechaInscripcion: new Date('2026-08-04T12:00:00Z'),
      fechaAprobacion: new Date('2026-08-05T12:00:00Z'),
      fechaBaja: null,
      activo: true,
    });

    const filtros = {
      campeonatoId: 7,
      categoriaId: 1,
      etapa: 'primera_etapa',
    };
    const opcionesOrigen = await servicioOrigen.obtenerOpcionesJugadores(
      { ...filtros, equipoId: 10 },
      { role: 'directivo_liga', ligaId: 2 },
    );
    const opcionesDestino = await servicioDestino.obtenerOpcionesJugadores(
      { ...filtros, equipoId: 20 },
      { role: 'directivo_liga', ligaId: 2 },
    );

    expect(opcionesOrigen.jugadores).toEqual([
      expect.objectContaining({ jugadorId: 30, equipoPeriodoId: 10, equipoActualId: 20 }),
    ]);
    expect(opcionesDestino.jugadores).toEqual([]);
  });

  it('resume participacion y disciplina solo durante la vigencia de la habilitacion', async () => {
    const equipo = { id: 10, nombre: 'Equipo historico' };
    const rival = { id: 20, nombre: 'Rival' };
    const partido = (id: number, fecha: string, extra: Record<string, any> = {}) => ({
      id,
      campeonatoId: 7,
      equipoLocalId: 10,
      equipoVisitanteId: 20,
      equipoLocal: equipo,
      equipoVisitante: rival,
      estado: 'jugado',
      fechaPartido: new Date(fecha),
      etapa: 'primera_etapa',
      jornada: id,
      resultadoAdministrativoPorExpulsion: false,
      ...extra,
    });
    const partidos = [
      partido(1, '2026-04-01T12:00:00Z'),
      partido(2, '2026-04-08T12:00:00Z'),
      partido(3, '2026-04-15T12:00:00Z'),
      partido(4, '2026-04-22T12:00:00Z'),
      partido(5, '2026-04-29T12:00:00Z', { resultadoAdministrativoPorExpulsion: true }),
      partido(6, '2026-02-01T12:00:00Z'),
    ];
    const { servicio } = crearServicio({
      alineaciones: {
        find: jest.fn().mockResolvedValue([
          { id: 1, partidoId: 1, jugadorId: 30, estado: 'jugo', numeroCancha: 9, activo: true },
          { id: 2, partidoId: 2, jugadorId: 30, estado: 'expulsado', numeroCancha: 9, activo: true },
          { id: 3, partidoId: 3, jugadorId: 30, estado: 'no_jugo', numeroCancha: 9, activo: true },
          { id: 4, partidoId: 4, jugadorId: 30, estado: 'ausente', numeroCancha: 9, activo: true },
        ]),
      },
      incidencias: {
        find: jest.fn().mockResolvedValue([
          { id: 1, partidoId: 1, jugadorId: 30, tipoIncidencia: 'tarjeta_amarilla', activo: true },
          { id: 2, partidoId: 2, jugadorId: 30, tipoIncidencia: 'doble_amarilla', activo: true },
          { id: 3, partidoId: 2, jugadorId: 30, tipoIncidencia: 'tarjeta_roja', activo: true },
        ]),
      },
    });
    const habilitacion = {
      id: 100,
      campeonatoId: 7,
      jugadorId: 30,
      equipoId: 10,
      estado: 'habilitado',
      fechaInscripcion: new Date('2026-03-01T12:00:00Z'),
      fechaAprobacion: new Date('2026-03-02T12:00:00Z'),
      fechaBaja: null,
      activo: true,
    };
    const goles = [
      { id: 1, partidoId: 1, jugadorId: 30, tipo: 'normal' },
      { id: 2, partidoId: 1, jugadorId: 30, tipo: 'penal' },
    ];

    const resultado = await (servicio as any).construirParticipacionJugador({
      jugadorId: 30,
      equipoId: 10,
      partidos,
      habilitaciones: [habilitacion],
      transferencias: [],
      goles,
    });

    expect(resultado.resumen).toMatchObject({
      partidosEquipo: 4,
      partidosConRegistro: 4,
      partidosJugados: 2,
      partidosNoJugados: 2,
      noConvocado: 1,
      ausencias: 1,
      expulsiones: 1,
      amarillas: 3,
      doblesAmarillas: 1,
      rojas: 1,
      porcentajeParticipacion: 50,
    });
    expect(resultado.detalle[0]).toMatchObject({ partidoId: 1, goles: 2, amarillas: 1 });
  });
});
