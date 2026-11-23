import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Gol } from '../goles/entities/gol.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { ConsultarReporteCampeonatoDto } from './dto/consultar-reporte-campeonato.dto';
import { Equipo } from '../equipos/entities/equipo.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { CambioDorsalEtapa } from '../jugador-campeonatos/entities/cambio-dorsal-etapa.entity';
import { ConsultarReporteEquipoDto } from './dto/consultar-reporte-equipo.dto';
import { ConsultarReporteJugadorDto } from './dto/consultar-reporte-jugador.dto';
import { ActaAlineacion } from '../acta-partido/entities/acta-alineacion.entity';
import { ActaIncidencia } from '../acta-partido/entities/acta-incidencia.entity';

export interface RendimientoEquipo {
  equipoId: number;
  equipoNombre: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  efectividad: number;
}

export interface GoleadorReporte {
  jugadorId: number;
  jugadorNombre: string;
  equipoId: number | null;
  equipoNombre: string;
  goles: number;
  penales: number;
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Campeonato) private readonly campeonatos: Repository<Campeonato>,
    @InjectRepository(Categoria) private readonly categorias: Repository<Categoria>,
    @InjectRepository(Partido) private readonly partidos: Repository<Partido>,
    @InjectRepository(Gol) private readonly goles: Repository<Gol>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(JugadorCampeonato) private readonly habilitaciones: Repository<JugadorCampeonato>,
    @InjectRepository(Sancion) private readonly sanciones: Repository<Sancion>,
    @InjectRepository(Equipo) private readonly equipos: Repository<Equipo>,
    @InjectRepository(Jugador) private readonly jugadores: Repository<Jugador>,
    @InjectRepository(Transferencia) private readonly transferencias: Repository<Transferencia>,
    @InjectRepository(CambioDorsalEtapa) private readonly cambiosDorsal: Repository<CambioDorsalEtapa>,
    @InjectRepository(ActaAlineacion) private readonly alineaciones: Repository<ActaAlineacion>,
    @InjectRepository(ActaIncidencia) private readonly incidencias: Repository<ActaIncidencia>,
  ) {}

  async obtenerReporteCampeonato(filtros: ConsultarReporteCampeonatoDto, usuario: any) {
    const campeonato = await this.campeonatos.findOne({
      where: { id: filtros.campeonatoId, activo: true },
    });
    if (!campeonato) throw new NotFoundException('El campeonato seleccionado no existe.');
    this.validarLiga(campeonato, usuario);

    const categoria = filtros.categoriaId
      ? await this.categorias.findOne({
          where: { id: filtros.categoriaId, campeonatoId: campeonato.id, activo: true },
        })
      : null;
    if (filtros.categoriaId && !categoria) {
      throw new NotFoundException('La categoría no pertenece al campeonato seleccionado.');
    }

    const etapa = filtros.etapa?.trim() || undefined;
    const opcionesEtapas = await this.obtenerEtapas(campeonato.id, categoria?.id);
    if (etapa && !opcionesEtapas.includes(etapa)) {
      throw new NotFoundException('La etapa no pertenece a los filtros seleccionados.');
    }

    const wherePartidos: any = { campeonatoId: campeonato.id, activo: true };
    if (categoria) wherePartidos.categoriaId = categoria.id;
    if (etapa) wherePartidos.etapa = etapa;

    const partidos = await this.partidos.find({
      where: wherePartidos,
      order: { jornada: 'ASC', id: 'ASC' },
    });

    const equipos = await this.inicializarEquipos(campeonato.id, categoria?.id, partidos);
    let totalGoles = 0;
    for (const partido of partidos) {
      if (partido.estado !== 'jugado') continue;
      const local = equipos.get(partido.equipoLocalId);
      const visitante = equipos.get(partido.equipoVisitanteId);
      if (!local || !visitante) continue;
      const golesLocal = Number(partido.golesLocal ?? 0);
      const golesVisitante = Number(partido.golesVisitante ?? 0);
      totalGoles += golesLocal + golesVisitante;
      this.registrarPartido(local, golesLocal, golesVisitante, partido.sancionado === 'local', partido.sancionado === 'visitante');
      this.registrarPartido(visitante, golesVisitante, golesLocal, partido.sancionado === 'visitante', partido.sancionado === 'local');
    }

    const rendimiento = [...equipos.values()]
      .map((equipo) => ({
        ...equipo,
        dg: equipo.gf - equipo.gc,
        efectividad: equipo.pj ? this.redondear((equipo.pg / equipo.pj) * 100) : 0,
      }))
      .sort((a, b) =>
        b.pg - a.pg ||
        b.pe - a.pe ||
        (b.gf - b.gc) - (a.gf - a.gc) ||
        b.gf - a.gf ||
        a.equipoNombre.localeCompare(b.equipoNombre, 'es'),
      );

    const estados = {
      jugados: partidos.filter((partido) => partido.estado === 'jugado').length,
      programados: partidos.filter((partido) => partido.estado === 'programado').length,
      enJuego: partidos.filter((partido) => partido.estado === 'en_juego').length,
      suspendidos: partidos.filter((partido) => partido.estado === 'suspendido').length,
      cancelados: partidos.filter((partido) => partido.estado === 'cancelado').length,
    };
    const totalCompetitivos = Math.max(0, partidos.length - estados.cancelados);

    const [jugadoresHabilitados, sancionesActivas, goleadores] = await Promise.all([
      this.contarHabilitados(campeonato.id, categoria?.id),
      this.contarSancionesActivas(campeonato.id, categoria?.id, etapa),
      this.obtenerGoleadores(campeonato.id, categoria?.id, etapa),
    ]);

    return {
      contexto: {
        ligaId: campeonato.ligaId,
        ligaNombre: campeonato.liga?.nombre ?? 'Liga',
        campeonatoId: campeonato.id,
        campeonatoNombre: campeonato.nombre,
        categoriaId: categoria?.id ?? null,
        categoriaNombre: categoria?.nombre ?? 'Todas las categorías',
        etapa: etapa ?? null,
      },
      opciones: { etapas: opcionesEtapas },
      resumen: {
        totalPartidos: partidos.length,
        partidosJugados: estados.jugados,
        partidosPendientes: estados.programados + estados.enJuego + estados.suspendidos,
        porcentajeAvance: totalCompetitivos ? this.redondear((estados.jugados / totalCompetitivos) * 100) : 0,
        totalGoles,
        promedioGoles: estados.jugados ? this.redondear(totalGoles / estados.jugados) : 0,
        totalEquipos: equipos.size,
        jugadoresHabilitados,
        sancionesActivas,
      },
      estadosPartidos: estados,
      rendimientoEquipos: rendimiento,
      goleadores,
    };
  }

  async obtenerReporteEquipo(filtros: ConsultarReporteEquipoDto, usuario: any) {
    const campeonato = await this.obtenerCampeonatoSeguro(filtros.campeonatoId, usuario);
    const categoria = await this.obtenerCategoriaSegura(filtros.categoriaId, campeonato.id);
    const etapa = await this.validarEtapa(filtros.etapa, campeonato.id, categoria?.id);
    const equipo = await this.equipos.findOne({ where: { id: filtros.equipoId, activo: true } });
    if (!equipo || Number(equipo.ligaId) !== Number(campeonato.ligaId)) {
      throw new NotFoundException('El equipo no pertenece a la liga del campeonato.');
    }
    if (usuario?.role === 'dirigente_equipo' && Number(usuario.equipoId) !== equipo.id) {
      throw new ForbiddenException('Solo puede consultar el reporte de su equipo.');
    }

    const inscripcionesEquipo = await this.inscripciones.find({
      where: { campeonatoId: campeonato.id, equipoId: equipo.id, activo: true },
      order: { fechaInscripcion: 'ASC', id: 'ASC' },
    });
    const movimientosCategoria = this.construirMovimientosCategoria(inscripcionesEquipo);
    const inscripcionActual = [...inscripcionesEquipo].reverse().find((item) => item.estado === 'confirmada');

    const wherePartidoBase: any = { campeonatoId: campeonato.id, activo: true };
    if (categoria) wherePartidoBase.categoriaId = categoria.id;
    if (etapa) wherePartidoBase.etapa = etapa;
    const partidos = await this.partidos.find({
      where: [
        { ...wherePartidoBase, equipoLocalId: equipo.id },
        { ...wherePartidoBase, equipoVisitanteId: equipo.id },
      ],
      order: { jornada: 'ASC', id: 'ASC' },
    });

    const rendimiento = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, efectividad: 0 };
    const detallePartidos = partidos.map((partido) => {
      const esLocal = partido.equipoLocalId === equipo.id;
      const rival = esLocal ? partido.equipoVisitante : partido.equipoLocal;
      const gf = Number((esLocal ? partido.golesLocal : partido.golesVisitante) ?? 0);
      const gc = Number((esLocal ? partido.golesVisitante : partido.golesLocal) ?? 0);
      let resultado: 'pendiente' | 'ganado' | 'empatado' | 'perdido' = 'pendiente';
      if (partido.estado === 'jugado') {
        rendimiento.pj++;
        rendimiento.gf += gf;
        rendimiento.gc += gc;
        const sancionado = partido.sancionado === (esLocal ? 'local' : 'visitante');
        const rivalSancionado = partido.sancionado === (esLocal ? 'visitante' : 'local');
        if (sancionado) resultado = 'perdido';
        else if (rivalSancionado || gf > gc) resultado = 'ganado';
        else if (gf === gc) resultado = 'empatado';
        else resultado = 'perdido';
        if (resultado === 'ganado') rendimiento.pg++;
        else if (resultado === 'empatado') rendimiento.pe++;
        else rendimiento.pp++;
      }
      return {
        id: partido.id,
        jornada: partido.jornada,
        etapa: partido.etapa,
        fecha: partido.fechaPartido,
        hora: partido.horaPartido,
        condicion: esLocal ? 'local' : 'visitante',
        rivalId: rival?.id ?? null,
        rivalNombre: rival?.nombre ?? 'Rival',
        estado: partido.estado,
        gf: partido.estado === 'jugado' ? gf : null,
        gc: partido.estado === 'jugado' ? gc : null,
        resultado,
      };
    });
    rendimiento.dg = rendimiento.gf - rendimiento.gc;
    rendimiento.efectividad = rendimiento.pj
      ? this.redondear((rendimiento.pg / rendimiento.pj) * 100)
      : 0;

    const whereHabilitacion: any = { campeonatoId: campeonato.id, equipoId: equipo.id };
    const habilitaciones = await this.habilitaciones.find({
      where: whereHabilitacion,
      order: { fechaInscripcion: 'DESC', id: 'DESC' },
    });
    const transferencias = await this.transferencias.find({
      where: [
        { campeonatoId: campeonato.id, equipoOrigenId: equipo.id, activo: true },
        { campeonatoId: campeonato.id, equipoDestinoId: equipo.id, activo: true },
      ],
      order: { fechaSolicitud: 'DESC', id: 'DESC' },
    });
    const rangoHistorico = this.obtenerRangoPartidos(partidos);
    const reconstruirHistorico = !!categoria || !!etapa;
    const plantilla = habilitaciones
      .filter((item) => reconstruirHistorico && rangoHistorico
        ? this.habilitacionVigenteEnRango(item, rangoHistorico, transferencias)
        : ['habilitado', 'pendiente', 'baja'].includes(item.estado)
          && (item.activo || item.estado === 'baja'))
      .map((item) => ({
        habilitacionId: item.id,
        jugadorId: item.jugadorId,
        jugadorNombre: item.jugador?.nombre ?? `Jugador #${item.jugadorId}`,
        cedula: item.jugador?.cedula ?? '',
        dorsal: item.numeroCancha,
        posicion: item.posicion,
        estado: reconstruirHistorico && rangoHistorico
          ? this.estadoHabilitacionEnRango(item, rangoHistorico, transferencias)
          : item.estado,
        tipoSolicitud: item.tipoSolicitud,
        fecha: item.fechaAprobacion ?? item.fechaInscripcion,
        categoriaActualNombre: item.categoria?.nombre ?? '',
        categoriaHistoricaNombre: categoria?.nombre ?? item.categoria?.nombre ?? '',
      }))
      .sort((a, b) => a.jugadorNombre.localeCompare(b.jugadorNombre, 'es'));

    const goles = await this.consultarGoles({
      campeonatoId: campeonato.id,
      categoriaId: categoria?.id,
      etapa,
      equipoId: equipo.id,
    });
    const goleadoresMapa = new Map<number, { jugadorId: number; jugadorNombre: string; goles: number; penales: number }>();
    for (const gol of goles) {
      if (gol.tipo === 'autogol') continue;
      const item = goleadoresMapa.get(gol.jugadorId) ?? {
        jugadorId: gol.jugadorId,
        jugadorNombre: gol.jugador?.nombre ?? `Jugador #${gol.jugadorId}`,
        goles: 0,
        penales: 0,
      };
      item.goles++;
      if (gol.tipo === 'penal') item.penales++;
      goleadoresMapa.set(gol.jugadorId, item);
    }
    const goleadores = [...goleadoresMapa.values()].sort((a, b) =>
      b.goles - a.goles || a.jugadorNombre.localeCompare(b.jugadorNombre, 'es'),
    );

    const whereSancion: any = { campeonatoId: campeonato.id, equipoId: equipo.id };
    if (categoria) whereSancion.categoriaId = categoria.id;
    const sanciones = await this.sanciones.find({
      where: whereSancion,
      order: { fechaSancion: 'DESC', id: 'DESC' },
    });
    const sancionesDetalle = sanciones.map((sancion) => this.mapearSancion(sancion));

    return {
      contexto: {
        ligaId: campeonato.ligaId,
        ligaNombre: campeonato.liga?.nombre ?? equipo.liga?.nombre ?? 'Liga',
        campeonatoId: campeonato.id,
        campeonatoNombre: campeonato.nombre,
        categoriaId: categoria?.id ?? null,
        categoriaNombre: categoria?.nombre ?? 'Todas las categorias',
        categoriaActualNombre: inscripcionActual?.categoria?.nombre ?? 'Sin categoria vigente',
        etapa: etapa ?? null,
        equipoId: equipo.id,
        equipoNombre: equipo.nombre,
        equipoImagen: equipo.imagen ?? null,
        representante: equipo.representante ?? '',
      },
      opciones: { etapas: await this.obtenerEtapas(campeonato.id, categoria?.id) },
      resumen: {
        habilitados: plantilla.filter((item) => item.estado === 'habilitado').length,
        pendientes: plantilla.filter((item) => item.estado === 'pendiente').length,
        bajas: plantilla.filter((item) => item.estado === 'baja').length,
        partidosJugados: rendimiento.pj,
        partidosPendientes: partidos.filter((item) => item.estado !== 'jugado' && item.estado !== 'cancelado').length,
        golesFavor: rendimiento.gf,
        golesContra: rendimiento.gc,
        sancionesActivas: sancionesDetalle.filter((item) => item.activa).length,
        transferencias: transferencias.length,
      },
      rendimiento,
      plantilla,
      partidos: detallePartidos,
      goleadores,
      sanciones: sancionesDetalle,
      movimientosCategoria,
      transferencias: transferencias.map((item) => ({
        id: item.id,
        jugadorId: item.jugadorId,
        jugadorNombre: item.jugador?.nombre ?? `Jugador #${item.jugadorId}`,
        equipoOrigen: item.equipoOrigen?.nombre ?? '',
        equipoDestino: item.equipoDestino?.nombre ?? '',
        fecha: item.fechaSolicitud,
        estadoOrigen: item.estadoEquipoOrigen,
        estadoDirectivo: item.estadoDirectivo,
      })),
    };
  }

  async obtenerOpcionesJugadores(filtros: ConsultarReporteEquipoDto, usuario: any) {
    const campeonato = await this.obtenerCampeonatoSeguro(filtros.campeonatoId, usuario);
    const categoria = await this.obtenerCategoriaSegura(filtros.categoriaId, campeonato.id);
    const etapa = await this.validarEtapa(filtros.etapa, campeonato.id, categoria?.id);
    const equipo = await this.equipos.findOne({ where: { id: filtros.equipoId, activo: true } });
    if (!equipo || Number(equipo.ligaId) !== Number(campeonato.ligaId)) {
      throw new NotFoundException('El equipo no pertenece a la liga del campeonato.');
    }
    if (usuario?.role === 'dirigente_equipo' && Number(usuario.equipoId) !== equipo.id) {
      throw new ForbiddenException('Solo puede consultar jugadores de su equipo.');
    }

    const etapas = await this.obtenerEtapas(campeonato.id, categoria?.id);
    const inscripcionesEquipo = await this.inscripciones.find({
      where: { campeonatoId: campeonato.id, equipoId: equipo.id, activo: true },
      order: { fechaInscripcion: 'ASC', id: 'ASC' },
    });
    if (categoria && !inscripcionesEquipo.some((item) => item.categoriaId === categoria.id)) {
      return { etapas, jugadores: [] };
    }

    const wherePartido: any = { campeonatoId: campeonato.id, activo: true };
    if (categoria) wherePartido.categoriaId = categoria.id;
    if (etapa) wherePartido.etapa = etapa;
    const partidos = categoria || etapa
      ? await this.partidos.find({
          where: [
            { ...wherePartido, equipoLocalId: equipo.id },
            { ...wherePartido, equipoVisitanteId: equipo.id },
          ],
          order: { jornada: 'ASC', id: 'ASC' },
        })
      : [];
    const rango = this.obtenerRangoPartidos(partidos);

    const [habilitaciones, transferencias] = await Promise.all([
      this.habilitaciones.find({
        where: { campeonatoId: campeonato.id, equipoId: equipo.id },
        order: { fechaInscripcion: 'ASC', id: 'ASC' },
      }),
      this.transferencias.find({
        where: [
          { campeonatoId: campeonato.id, equipoOrigenId: equipo.id, activo: true },
          { campeonatoId: campeonato.id, equipoDestinoId: equipo.id, activo: true },
        ],
        order: { fechaSolicitud: 'ASC', id: 'ASC' },
      }),
    ]);

    const candidatos = habilitaciones.filter((item) => {
      if (!['habilitado', 'pendiente', 'baja'].includes(item.estado)) return false;
      if (!categoria && !etapa) return item.activo || item.estado === 'baja';
      if (!rango) return false;
      return this.habilitacionVigenteEnRango(item, rango, transferencias);
    });
    const jugadores = new Map<number, any>();
    for (const habilitacion of candidatos) {
      if (!habilitacion.jugador) continue;
      jugadores.set(habilitacion.jugadorId, {
        jugadorId: habilitacion.jugadorId,
        jugadorNombre: habilitacion.jugador.nombre,
        cedula: habilitacion.jugador.cedula ?? '',
        equipoPeriodoId: equipo.id,
        equipoPeriodoNombre: equipo.nombre,
        equipoActualId: habilitacion.jugador.equipoId ?? null,
        equipoActualNombre: habilitacion.jugador.equipo?.nombre ?? '',
        estadoEnPeriodo: rango
          ? this.estadoHabilitacionEnRango(habilitacion, rango, transferencias)
          : habilitacion.estado,
      });
    }

    return {
      etapas,
      jugadores: [...jugadores.values()].sort((a, b) =>
        a.jugadorNombre.localeCompare(b.jugadorNombre, 'es'),
      ),
    };
  }

  async obtenerReporteJugador(filtros: ConsultarReporteJugadorDto, usuario: any) {
    const campeonato = await this.obtenerCampeonatoSeguro(filtros.campeonatoId, usuario);
    const categoria = await this.obtenerCategoriaSegura(filtros.categoriaId, campeonato.id);
    const etapa = await this.validarEtapa(filtros.etapa, campeonato.id, categoria?.id);
    const jugador = await this.jugadores.findOne({ where: { id: filtros.jugadorId } });
    if (!jugador) throw new NotFoundException('El jugador seleccionado no existe.');
    const equipoConsultado = filtros.equipoId
      ? await this.equipos.findOne({ where: { id: filtros.equipoId, activo: true } })
      : null;
    if (filtros.equipoId && (!equipoConsultado
      || Number(equipoConsultado.ligaId) !== Number(campeonato.ligaId))) {
      throw new NotFoundException('El equipo consultado no pertenece a la liga del campeonato.');
    }

    const whereHabilitacion: any = { campeonatoId: campeonato.id, jugadorId: jugador.id };
    const habilitaciones = await this.habilitaciones.find({
      where: whereHabilitacion,
      order: { fechaInscripcion: 'DESC', id: 'DESC' },
    });
    if (!habilitaciones.length) {
      throw new NotFoundException('El jugador no tiene registros en el campeonato seleccionado.');
    }
    if (usuario?.role === 'dirigente_equipo') {
      if (filtros.equipoId && Number(filtros.equipoId) !== Number(usuario.equipoId)) {
        throw new ForbiddenException('Solo puede consultar jugadores de su equipo.');
      }
      const perteneceAlEquipo = habilitaciones.some((item) =>
        Number(item.equipoId) === Number(usuario.equipoId),
      );
      const perteneceActualmente = Number(jugador.equipoId) === Number(usuario.equipoId)
        || habilitaciones.some((item) =>
          item.activo && ['habilitado', 'pendiente'].includes(item.estado)
          && Number(item.equipoId) === Number(usuario.equipoId),
        );
      if (filtros.equipoId ? !perteneceAlEquipo : !perteneceActualmente) {
        throw new ForbiddenException('Solo puede consultar jugadores de su equipo.');
      }
    }

    const equipoIds = [...new Set(habilitaciones.map((item) => item.equipoId))];
    const inscripcionesJugador = equipoIds.length
      ? await this.inscripciones.find({
          where: { campeonatoId: campeonato.id, equipoId: In(equipoIds), activo: true },
          order: { fechaInscripcion: 'ASC', id: 'ASC' },
        })
      : [];
    const movimientosCategoria = equipoIds.flatMap((equipoId) =>
      this.construirMovimientosCategoria(
        inscripcionesJugador.filter((item) => item.equipoId === equipoId),
      ),
    );
    const transferencias = await this.transferencias.find({
      where: { campeonatoId: campeonato.id, jugadorId: jugador.id, activo: true },
      order: { fechaSolicitud: 'DESC', id: 'DESC' },
    });
    const wherePartidosContexto: any = { campeonatoId: campeonato.id, activo: true };
    if (categoria) wherePartidosContexto.categoriaId = categoria.id;
    if (etapa) wherePartidosContexto.etapa = etapa;
    const partidosContexto = equipoIds.length
      ? await this.partidos.find({
          where: [
            { ...wherePartidosContexto, equipoLocalId: In(equipoIds) },
            { ...wherePartidosContexto, equipoVisitanteId: In(equipoIds) },
          ],
          order: { jornada: 'ASC', id: 'ASC' },
        })
      : [];
    const habilitacionesReporte = habilitaciones.filter((item) => {
      if (filtros.equipoId && Number(item.equipoId) !== Number(filtros.equipoId)) return false;
      if (categoria && !inscripcionesJugador.some((inscripcion) =>
        inscripcion.equipoId === item.equipoId && inscripcion.categoriaId === categoria.id,
      )) return false;
      if (!categoria && !etapa) return true;
      const partidosEquipo = partidosContexto.filter((partido) =>
        partido.equipoLocalId === item.equipoId || partido.equipoVisitanteId === item.equipoId,
      );
      if (etapa && !partidosEquipo.length) return false;
      const rango = this.obtenerRangoPartidos(partidosEquipo);
      return rango ? this.habilitacionVigenteEnRango(item, rango, transferencias) : true;
    });
    if (filtros.equipoId && !habilitacionesReporte.length) {
      throw new NotFoundException('El jugador no pertenecio al equipo durante el periodo consultado.');
    }

    const goles = await this.consultarGoles({
      campeonatoId: campeonato.id,
      categoriaId: categoria?.id,
      etapa,
      equipoId: filtros.equipoId,
      jugadorId: jugador.id,
    });
    const whereSancion: any = { campeonatoId: campeonato.id, jugadorId: jugador.id };
    if (categoria) whereSancion.categoriaId = categoria.id;
    if (filtros.equipoId) whereSancion.equipoId = filtros.equipoId;
    const sanciones = await this.sanciones.find({
      where: whereSancion,
      order: { fechaSancion: 'DESC', id: 'DESC' },
    });
    const sancionesDetalle = sanciones.map((sancion) => this.mapearSancion(sancion));
    const cambiosQuery = this.cambiosDorsal.createQueryBuilder('cambio')
      .innerJoinAndSelect('cambio.jugadorCampeonato', 'habilitacion')
      .leftJoinAndSelect('cambio.etapa', 'etapa')
      .where('habilitacion.campeonato_id = :campeonatoId', { campeonatoId: campeonato.id })
      .andWhere('habilitacion.jugador_id = :jugadorId', { jugadorId: jugador.id });
    const cambios = await cambiosQuery.orderBy('cambio.creado_en', 'DESC').getMany();
    const habilitacionIdsReporte = new Set(habilitacionesReporte.map((item) => item.id));
    const cambiosReporte = cambios.filter((item) => habilitacionIdsReporte.has(item.jugadorCampeonatoId));

    const habilitacionesDetalle = habilitacionesReporte.map((item) => {
      const categoriasHistoricas = [...new Set(inscripcionesJugador
        .filter((inscripcion) => inscripcion.equipoId === item.equipoId)
        .map((inscripcion) => inscripcion.categoria?.nombre)
        .filter(Boolean))];
      const rangoEquipo = this.obtenerRangoPartidos(partidosContexto.filter((partido) =>
        partido.equipoLocalId === item.equipoId || partido.equipoVisitanteId === item.equipoId,
      ));
      const fechaBaja = this.fechaBajaEfectiva(item, transferencias);
      return {
      id: item.id,
      equipoId: item.equipoId,
      equipoNombre: item.equipo?.nombre ?? '',
      categoriaId: item.categoriaId,
      categoriaNombre: categoria?.nombre || categoriasHistoricas.join(' → ') || item.categoria?.nombre || '',
      categoriaActualNombre: item.categoria?.nombre ?? '',
      dorsal: item.numeroCancha,
      posicion: item.posicion,
      estado: rangoEquipo
        ? this.estadoHabilitacionEnRango(item, rangoEquipo, transferencias)
        : item.estado,
      tipoSolicitud: item.tipoSolicitud,
      fechaSolicitud: item.fechaInscripcion,
      fechaAprobacion: item.fechaAprobacion,
      fechaBaja,
      motivoBaja: item.motivoBaja
        ?? item.observaciones
        ?? (fechaBaja && item.estado === 'baja' ? 'Baja registrada' : null),
      };
    });
    const transferenciasDetalle = transferencias.map((item) => ({
      id: item.id,
      equipoOrigen: item.equipoOrigen?.nombre ?? '',
      equipoDestino: item.equipoDestino?.nombre ?? '',
      fecha: item.fechaSolicitud,
      estadoOrigen: item.estadoEquipoOrigen,
      estadoDirectivo: item.estadoDirectivo,
    }));
    const cambiosDetalle = cambiosReporte.map((item) => ({
      id: item.id,
      etapa: item.etapa?.nombre ?? '',
      dorsalAnterior: item.jugadorCampeonato?.numeroCancha ?? null,
      dorsalNuevo: item.numeroCancha,
      jornadaDesde: item.jornadaDesde,
      motivo: item.motivo,
      activo: item.activo,
      fecha: item.creadoEn,
      fechaAnulacion: item.fechaAnulacion,
    }));
    const golesDetalle = goles.map((gol) => ({
      id: gol.id,
      partidoId: gol.partidoId,
      fecha: gol.partido?.fechaPartido ?? gol.creadoEn,
      jornada: gol.partido?.jornada ?? null,
      etapa: gol.partido?.etapa ?? '',
      equipoNombre: gol.equipo?.nombre ?? '',
      tipo: gol.tipo,
      minuto: gol.minuto,
    }));
    const participacion = await this.construirParticipacionJugador({
      jugadorId: jugador.id,
      equipoId: filtros.equipoId,
      partidos: partidosContexto,
      habilitaciones: habilitacionesReporte,
      transferencias,
      goles,
    });

    const lineaTiempo = [
      ...habilitacionesDetalle.flatMap((item) => {
        const eventos: any[] = [{
          id: `habilitacion-${item.id}`,
          fecha: item.fechaSolicitud,
          tipo: 'habilitacion',
          titulo: item.tipoSolicitud === 'reingreso' ? 'Solicitud de reingreso' : 'Solicitud de habilitacion',
          detalle: `${item.equipoNombre} · #${item.dorsal} · ${item.estado}`,
        }];
        if (item.fechaBaja) eventos.push({
          id: `baja-${item.id}`,
          fecha: item.fechaBaja,
          tipo: 'baja',
          titulo: 'Baja de habilitacion',
          detalle: `${item.equipoNombre}${item.motivoBaja ? ` · ${item.motivoBaja}` : ''}`,
        });
        return eventos;
      }),
      ...transferenciasDetalle.map((item) => ({
        id: `transferencia-${item.id}`,
        fecha: item.fecha,
        tipo: 'transferencia',
        titulo: 'Solicitud de transferencia',
        detalle: `${item.equipoOrigen} → ${item.equipoDestino} · ${item.estadoDirectivo}`,
      })),
      ...movimientosCategoria.filter((movimiento) => habilitacionesReporte.some((habilitacion) =>
        habilitacion.equipoId === movimiento.equipoId
        && this.fechaDentroVigenciaHabilitacion(movimiento.fecha, habilitacion),
      )).map((item) => ({
        id: `categoria-${item.inscripcionOrigenId}`,
        fecha: item.fecha,
        tipo: 'categoria',
        titulo: item.motivo === 'ascenso' ? 'Ascenso de categoria' : 'Descenso de categoria',
        detalle: `${item.categoriaOrigenNombre} → ${item.categoriaDestinoNombre}`,
      })),
      ...cambiosDetalle.map((item) => ({
        id: `dorsal-${item.id}`,
        fecha: item.fecha,
        tipo: 'dorsal',
        titulo: 'Cambio de dorsal',
        detalle: `#${item.dorsalAnterior} → #${item.dorsalNuevo} · ${item.etapa}, jornada ${item.jornadaDesde}`,
      })),
      ...golesDetalle.map((item) => ({
        id: `gol-${item.id}`,
        fecha: item.fecha,
        tipo: 'gol',
        titulo: item.tipo === 'autogol' ? 'Autogol registrado' : 'Gol registrado',
        detalle: `${item.equipoNombre} · ${item.etapa} · Jornada ${item.jornada ?? '-'}`,
      })),
      ...sancionesDetalle.map((item) => ({
        id: `sancion-${item.id}`,
        fecha: item.fecha,
        tipo: 'sancion',
        titulo: item.tipoNombre || 'Sancion registrada',
        detalle: item.descripcion || (item.activa ? 'Activa' : 'Cumplida o anulada'),
      })),
    ].filter((item) => !!item.fecha)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const habilitacionActual = habilitaciones.find((item) =>
      item.activo && ['habilitado', 'pendiente'].includes(item.estado),
    );
    return {
      contexto: {
        ligaId: campeonato.ligaId,
        ligaNombre: campeonato.liga?.nombre ?? 'Liga',
        campeonatoId: campeonato.id,
        campeonatoNombre: campeonato.nombre,
        categoriaId: categoria?.id ?? null,
        categoriaNombre: categoria?.nombre ?? 'Todas las categorias',
        etapa: etapa ?? null,
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
        jugadorImagen: jugador.imagen ?? null,
        cedula: jugador.cedula ?? '',
        equipoConsultado: equipoConsultado?.nombre ?? '',
        equipoActual: habilitacionActual?.equipo?.nombre ?? jugador.equipo?.nombre ?? 'Sin equipo',
        dorsalActual: habilitacionActual?.numeroCancha ?? jugador.numeroCancha ?? null,
        posicion: habilitacionActual?.posicion ?? jugador.posicion ?? '',
      },
      opciones: { etapas: await this.obtenerEtapas(campeonato.id, categoria?.id) },
      resumen: {
        goles: goles.filter((item) => item.tipo !== 'autogol').length,
        penales: goles.filter((item) => item.tipo === 'penal').length,
        autogoles: goles.filter((item) => item.tipo === 'autogol').length,
        sancionesActivas: sancionesDetalle.filter((item) => item.activa).length,
        habilitaciones: habilitacionesReporte.length,
        transferencias: transferencias.length,
        cambiosDorsal: cambiosReporte.filter((item) => item.activo).length,
      },
      habilitaciones: habilitacionesDetalle,
      transferencias: transferenciasDetalle,
      cambiosDorsal: cambiosDetalle,
      movimientosCategoria,
      goles: golesDetalle,
      participacion,
      sanciones: sancionesDetalle,
      lineaTiempo,
    };
  }

  private construirMovimientosCategoria(inscripciones: Inscripcion[]) {
    const ordenadas = [...inscripciones].sort((a, b) =>
      new Date(a.fechaInscripcion).getTime() - new Date(b.fechaInscripcion).getTime() || a.id - b.id,
    );
    const movimientos: Array<{
      inscripcionOrigenId: number;
      inscripcionDestinoId: number;
      equipoId: number;
      equipoNombre: string;
      categoriaOrigenId: number;
      categoriaOrigenNombre: string;
      categoriaDestinoId: number;
      categoriaDestinoNombre: string;
      motivo: 'ascenso' | 'descenso';
      fecha: Date;
    }> = [];
    for (let indice = 0; indice < ordenadas.length - 1; indice++) {
      const origen = ordenadas[indice];
      if (origen.estado !== 'transferida' || !origen.motivo) continue;
      const destino = ordenadas.slice(indice + 1).find((item) => item.categoriaId !== origen.categoriaId);
      if (!destino) continue;
      movimientos.push({
        inscripcionOrigenId: origen.id,
        inscripcionDestinoId: destino.id,
        equipoId: origen.equipoId,
        equipoNombre: origen.equipo?.nombre ?? '',
        categoriaOrigenId: origen.categoriaId,
        categoriaOrigenNombre: origen.categoria?.nombre ?? `Categoria #${origen.categoriaId}`,
        categoriaDestinoId: destino.categoriaId,
        categoriaDestinoNombre: destino.categoria?.nombre ?? `Categoria #${destino.categoriaId}`,
        motivo: origen.motivo,
        fecha: destino.fechaInscripcion,
      });
    }
    return movimientos;
  }

  private obtenerRangoPartidos(partidos: Partido[]): { desde: Date; hasta: Date } | null {
    const fechas = partidos
      .map((partido) => partido.fechaPartido ? new Date(partido.fechaPartido) : null)
      .filter((fecha): fecha is Date => !!fecha && !Number.isNaN(fecha.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return fechas.length ? { desde: fechas[0], hasta: fechas[fechas.length - 1] } : null;
  }

  private fechaAltaHabilitacion(habilitacion: JugadorCampeonato): Date | null {
    if (habilitacion.fechaAprobacion) return new Date(habilitacion.fechaAprobacion);
    if (['habilitado', 'baja'].includes(habilitacion.estado) && habilitacion.fechaInscripcion) {
      return new Date(habilitacion.fechaInscripcion);
    }
    return null;
  }

  private habilitacionVigenteEnRango(
    habilitacion: JugadorCampeonato,
    rango: { desde: Date; hasta: Date },
    transferencias: Transferencia[] = [],
  ): boolean {
    const alta = this.fechaAltaHabilitacion(habilitacion);
    if (!alta || alta.getTime() > rango.hasta.getTime()) return false;
    const baja = this.fechaBajaEfectiva(habilitacion, transferencias);
    return !baja || baja.getTime() >= rango.desde.getTime();
  }

  private estadoHabilitacionEnRango(
    habilitacion: JugadorCampeonato,
    rango: { desde: Date; hasta: Date },
    transferencias: Transferencia[] = [],
  ): 'habilitado' | 'baja' {
    const baja = this.fechaBajaEfectiva(habilitacion, transferencias);
    return baja && baja.getTime() <= rango.hasta.getTime() ? 'baja' : 'habilitado';
  }

  private fechaDentroVigenciaHabilitacion(
    fecha: Date,
    habilitacion: JugadorCampeonato,
    transferencias: Transferencia[] = [],
  ): boolean {
    const evento = new Date(fecha).getTime();
    const alta = this.fechaAltaHabilitacion(habilitacion);
    if (!alta || alta.getTime() > evento) return false;
    const baja = this.fechaBajaEfectiva(habilitacion, transferencias);
    return !baja || baja.getTime() >= evento;
  }

  private async construirParticipacionJugador(params: {
    jugadorId: number;
    equipoId?: number;
    partidos: Partido[];
    habilitaciones: JugadorCampeonato[];
    transferencias: Transferencia[];
    goles: Gol[];
  }) {
    const partidos = params.partidos.filter((partido) => {
      if (partido.estado !== 'jugado' || partido.resultadoAdministrativoPorExpulsion) return false;
      if (params.equipoId
        && partido.equipoLocalId !== params.equipoId
        && partido.equipoVisitanteId !== params.equipoId) return false;
      if (!partido.fechaPartido) return false;
      return params.habilitaciones.some((habilitacion) =>
        (!params.equipoId || habilitacion.equipoId === params.equipoId)
        && (partido.equipoLocalId === habilitacion.equipoId
          || partido.equipoVisitanteId === habilitacion.equipoId)
        && this.fechaDentroVigenciaHabilitacion(
          new Date(partido.fechaPartido),
          habilitacion,
          params.transferencias,
        ),
      );
    });
    const partidoIds = partidos.map((partido) => partido.id);
    const [alineaciones, incidencias] = partidoIds.length
      ? await Promise.all([
          this.alineaciones.find({
            where: { partidoId: In(partidoIds), jugadorId: params.jugadorId, activo: true },
            order: { partidoId: 'ASC', id: 'ASC' },
          }),
          this.incidencias.find({
            where: { partidoId: In(partidoIds), jugadorId: params.jugadorId, activo: true },
            order: { partidoId: 'ASC', id: 'ASC' },
          }),
        ])
      : [[], []];
    const alineacionPorPartido = new Map(alineaciones.map((item) => [item.partidoId, item]));
    const incidenciasPorPartido = new Map<number, ActaIncidencia[]>();
    for (const incidencia of incidencias) {
      const lista = incidenciasPorPartido.get(incidencia.partidoId) ?? [];
      lista.push(incidencia);
      incidenciasPorPartido.set(incidencia.partidoId, lista);
    }
    const golesPorPartido = new Map<number, number>();
    for (const gol of params.goles) {
      if (gol.tipo === 'autogol') continue;
      golesPorPartido.set(gol.partidoId, (golesPorPartido.get(gol.partidoId) ?? 0) + 1);
    }

    const detalle = partidos.map((partido) => {
      const alineacion = alineacionPorPartido.get(partido.id);
      const incidenciasPartido = incidenciasPorPartido.get(partido.id) ?? [];
      const doblesAmarillas = incidenciasPartido.filter((item) => item.tipoIncidencia === 'doble_amarilla').length;
      const amarillas = incidenciasPartido.filter((item) => item.tipoIncidencia === 'tarjeta_amarilla').length
        + (doblesAmarillas * 2);
      const rojas = incidenciasPartido.filter((item) =>
        ['tarjeta_roja', 'expulsion_directa'].includes(item.tipoIncidencia),
      ).length;
      const expulsado = alineacion?.estado === 'expulsado'
        || incidenciasPartido.some((item) =>
          ['tarjeta_roja', 'doble_amarilla', 'expulsion_directa'].includes(item.tipoIncidencia),
        );
      const habilitacionVigente = params.habilitaciones.find((item) =>
        (item.equipoId === partido.equipoLocalId || item.equipoId === partido.equipoVisitanteId)
        && this.fechaDentroVigenciaHabilitacion(
          new Date(partido.fechaPartido),
          item,
          params.transferencias,
        ),
      );
      const equipoId = params.equipoId
        ?? alineacion?.equipoId
        ?? habilitacionVigente?.equipoId
        ?? 0;
      const rival = partido.equipoLocalId === equipoId ? partido.equipoVisitante : partido.equipoLocal;
      return {
        partidoId: partido.id,
        fecha: partido.fechaPartido,
        etapa: partido.etapa,
        jornada: partido.jornada,
        equipoId,
        rivalId: rival?.id ?? null,
        rivalNombre: rival?.nombre ?? 'Rival',
        estado: alineacion?.estado ?? 'sin_registro',
        dorsal: alineacion?.numeroCancha ?? null,
        goles: golesPorPartido.get(partido.id) ?? 0,
        amarillas,
        doblesAmarillas,
        rojas,
        expulsado,
        observaciones: alineacion?.observaciones ?? '',
      };
    });
    const estadosNoJugo = new Set(['no_jugo', 'suspendido', 'ausente', 'lesionado']);
    const jugados = detalle.filter((item) => ['jugo', 'expulsado'].includes(item.estado)).length;
    const noJugados = detalle.filter((item) => estadosNoJugo.has(item.estado)).length;
    const conRegistro = detalle.filter((item) => item.estado !== 'sin_registro').length;
    return {
      resumen: {
        partidosEquipo: detalle.length,
        partidosConRegistro: conRegistro,
        partidosJugados: jugados,
        partidosNoJugados: noJugados,
        sinRegistro: detalle.length - conRegistro,
        noConvocado: detalle.filter((item) => item.estado === 'no_jugo').length,
        ausencias: detalle.filter((item) => item.estado === 'ausente').length,
        suspendido: detalle.filter((item) => item.estado === 'suspendido').length,
        lesionado: detalle.filter((item) => item.estado === 'lesionado').length,
        expulsiones: detalle.filter((item) => item.expulsado).length,
        amarillas: detalle.reduce((total, item) => total + item.amarillas, 0),
        doblesAmarillas: detalle.reduce((total, item) => total + item.doblesAmarillas, 0),
        rojas: detalle.reduce((total, item) => total + item.rojas, 0),
        porcentajeParticipacion: conRegistro
          ? this.redondear((jugados / conRegistro) * 100)
          : 0,
      },
      detalle,
    };
  }

  private fechaBajaEfectiva(
    habilitacion: JugadorCampeonato,
    transferencias: Transferencia[],
  ): Date | null {
    if (habilitacion.fechaBaja) return new Date(habilitacion.fechaBaja);
    if (habilitacion.estado !== 'baja') return null;

    const alta = this.fechaAltaHabilitacion(habilitacion)?.getTime() ?? 0;
    const fechas = transferencias
      .filter((transferencia) =>
        transferencia.jugadorId === habilitacion.jugadorId
        && transferencia.campeonatoId === habilitacion.campeonatoId
        && transferencia.equipoOrigenId === habilitacion.equipoId
        && transferencia.estadoEquipoOrigen === 'aprobado'
        && transferencia.estadoDirectivo === 'aprobado',
      )
      .map((transferencia) => this.fechaCierreTransferencia(transferencia))
      .filter((fecha): fecha is Date => !!fecha && fecha.getTime() >= alta)
      .sort((a, b) => a.getTime() - b.getTime());
    return fechas[0] ?? null;
  }

  private fechaCierreTransferencia(transferencia: Transferencia): Date | null {
    const fechas = [
      transferencia.fechaAprobacionOrigen,
      transferencia.fechaAprobacionDirectivo,
      transferencia.fechaSolicitud,
      transferencia.creadoEn,
    ]
      .filter(Boolean)
      .map((fecha) => new Date(fecha))
      .filter((fecha) => !Number.isNaN(fecha.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    return fechas[0] ?? null;
  }

  private async obtenerCampeonatoSeguro(id: number, usuario: any): Promise<Campeonato> {
    const campeonato = await this.campeonatos.findOne({ where: { id, activo: true } });
    if (!campeonato) throw new NotFoundException('El campeonato seleccionado no existe.');
    this.validarLiga(campeonato, usuario);
    return campeonato;
  }

  private async obtenerCategoriaSegura(id: number | undefined, campeonatoId: number): Promise<Categoria | null> {
    if (!id) return null;
    const categoria = await this.categorias.findOne({
      where: { id, campeonatoId, activo: true },
    });
    if (!categoria) throw new NotFoundException('La categoria no pertenece al campeonato seleccionado.');
    return categoria;
  }

  private async validarEtapa(
    valor: string | undefined,
    campeonatoId: number,
    categoriaId?: number,
  ): Promise<string | undefined> {
    const etapa = valor?.trim() || undefined;
    if (!etapa) return undefined;
    const etapas = await this.obtenerEtapas(campeonatoId, categoriaId);
    if (!etapas.includes(etapa)) {
      throw new NotFoundException('La etapa no pertenece a los filtros seleccionados.');
    }
    return etapa;
  }

  private consultarGoles(filtros: {
    campeonatoId: number;
    categoriaId?: number;
    etapa?: string;
    equipoId?: number;
    jugadorId?: number;
  }): Promise<Gol[]> {
    const query = this.goles.createQueryBuilder('gol')
      .innerJoinAndSelect('gol.partido', 'partido')
      .leftJoinAndSelect('gol.jugador', 'jugador')
      .leftJoinAndSelect('gol.equipo', 'equipo')
      .where('gol.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId })
      .andWhere('gol.activo = true')
      .andWhere("partido.estado = 'jugado'");
    if (filtros.categoriaId) query.andWhere('gol.categoria_id = :categoriaId', { categoriaId: filtros.categoriaId });
    if (filtros.etapa) query.andWhere('partido.etapa = :etapa', { etapa: filtros.etapa });
    if (filtros.equipoId) query.andWhere('gol.equipo_id = :equipoId', { equipoId: filtros.equipoId });
    if (filtros.jugadorId) query.andWhere('gol.jugador_id = :jugadorId', { jugadorId: filtros.jugadorId });
    return query.orderBy('partido.fecha_partido', 'DESC').addOrderBy('gol.id', 'DESC').getMany();
  }

  private mapearSancion(sancion: Sancion) {
    return {
      id: sancion.id,
      tipoNombre: sancion.tipoSancion?.nombre ?? 'Sancion',
      aplicaA: sancion.tipoSancion?.aplicaA ?? 'jugador',
      jugadorId: sancion.jugadorId ?? null,
      jugadorNombre: sancion.jugador?.nombre ?? '',
      descripcion: sancion.descripcion ?? '',
      partidosSuspension: Number(sancion.partidosSuspension ?? 0),
      partidosCumplidos: Number(sancion.partidosCumplidos ?? 0),
      fecha: sancion.fechaSancion ?? sancion.creadoEn,
      fechaFin: sancion.fechaFinSuspension ?? null,
      activa: this.sancionEstaActiva(sancion),
    };
  }

  private sancionEstaActiva(sancion: Sancion): boolean {
    if (!sancion.activo) return false;
    if (sancion.fechaFinSuspension) {
      const fin = new Date(sancion.fechaFinSuspension);
      fin.setHours(23, 59, 59, 999);
      return fin.getTime() >= Date.now();
    }
    if (sancion.suspensionActiva) return true;
    return ['equipo', 'barra', 'directivo'].includes(sancion.tipoSancion?.aplicaA ?? '');
  }

  private validarLiga(campeonato: Campeonato, usuario: any): void {
    if (usuario?.role === 'master') return;
    if (!usuario?.ligaId || Number(usuario.ligaId) !== Number(campeonato.ligaId)) {
      throw new ForbiddenException('No puede consultar reportes de otra liga.');
    }
  }

  private async obtenerEtapas(campeonatoId: number, categoriaId?: number): Promise<string[]> {
    const query = this.partidos.createQueryBuilder('partido')
      .select('DISTINCT partido.etapa', 'etapa')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.activo = true');
    if (categoriaId) query.andWhere('partido.categoria_id = :categoriaId', { categoriaId });
    const filas = await query.orderBy('partido.etapa', 'ASC').getRawMany<{ etapa: string }>();
    return filas.map((fila) => fila.etapa).filter(Boolean);
  }

  private async inicializarEquipos(
    campeonatoId: number,
    categoriaId: number | undefined,
    partidos: Partido[],
  ): Promise<Map<number, Omit<RendimientoEquipo, 'dg' | 'efectividad'>>> {
    const where: any = { campeonatoId, estado: 'confirmada', activo: true };
    if (categoriaId) where.categoriaId = categoriaId;
    const inscripciones = await this.inscripciones.find({ where });
    const mapa = new Map<number, Omit<RendimientoEquipo, 'dg' | 'efectividad'>>();
    const agregar = (id: number, nombre: string) => {
      if (!mapa.has(id)) {
        mapa.set(id, { equipoId: id, equipoNombre: nombre, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 });
      }
    };
    for (const inscripcion of inscripciones) {
      if (inscripcion.equipo) agregar(inscripcion.equipoId, inscripcion.equipo.nombre);
    }
    for (const partido of partidos) {
      if (partido.equipoLocal) agregar(partido.equipoLocalId, partido.equipoLocal.nombre);
      if (partido.equipoVisitante) agregar(partido.equipoVisitanteId, partido.equipoVisitante.nombre);
    }
    return mapa;
  }

  private registrarPartido(
    equipo: Omit<RendimientoEquipo, 'dg' | 'efectividad'>,
    golesFavor: number,
    golesContra: number,
    sancionado: boolean,
    rivalSancionado: boolean,
  ): void {
    equipo.pj++;
    equipo.gf += golesFavor;
    equipo.gc += golesContra;
    if (sancionado) equipo.pp++;
    else if (rivalSancionado || golesFavor > golesContra) equipo.pg++;
    else if (golesFavor === golesContra) equipo.pe++;
    else equipo.pp++;
  }

  private contarHabilitados(campeonatoId: number, categoriaId?: number): Promise<number> {
    const where: any = { campeonatoId, estado: 'habilitado', activo: true };
    if (categoriaId) where.categoriaId = categoriaId;
    return this.habilitaciones.count({ where });
  }

  private async contarSancionesActivas(
    campeonatoId: number,
    categoriaId?: number,
    etapa?: string,
  ): Promise<number> {
    const query = this.sanciones.createQueryBuilder('sancion')
      .leftJoin('sancion.tipoSancion', 'tipo')
      .where('sancion.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('sancion.activo = true')
      .andWhere(
        '((sancion.fecha_fin_suspension IS NOT NULL AND sancion.fecha_fin_suspension >= CURRENT_DATE) OR ' +
        '(sancion.fecha_fin_suspension IS NULL AND sancion.suspension_activa = true) OR ' +
        "(tipo.\"aplicaA\" IN ('equipo', 'barra', 'directivo') AND sancion.fecha_fin_suspension IS NULL))",
      );
    if (categoriaId) query.andWhere('sancion.categoria_id = :categoriaId', { categoriaId });
    if (etapa) {
      query.innerJoin('sancion.partido', 'partido').andWhere('partido.etapa = :etapa', { etapa });
    }
    return query.getCount();
  }

  private async obtenerGoleadores(
    campeonatoId: number,
    categoriaId?: number,
    etapa?: string,
  ): Promise<GoleadorReporte[]> {
    const query = this.goles.createQueryBuilder('gol')
      .innerJoinAndSelect('gol.partido', 'partido')
      .leftJoinAndSelect('gol.jugador', 'jugador')
      .leftJoinAndSelect('jugador.equipo', 'equipoActual')
      .leftJoinAndSelect('gol.equipo', 'equipoGol')
      .where('gol.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('gol.activo = true')
      .andWhere("partido.estado = 'jugado'");
    if (categoriaId) query.andWhere('gol.categoria_id = :categoriaId', { categoriaId });
    if (etapa) query.andWhere('partido.etapa = :etapa', { etapa });
    const goles = await query.orderBy('gol.id', 'ASC').getMany();

    const mapa = new Map<number, GoleadorReporte>();
    for (const gol of goles) {
      if (gol.tipo === 'autogol') continue;
      const actual = mapa.get(gol.jugadorId) ?? {
        jugadorId: gol.jugadorId,
        jugadorNombre: gol.jugador?.nombre ?? `Jugador #${gol.jugadorId}`,
        equipoId: gol.equipo?.id ?? gol.equipoId ?? null,
        equipoNombre: gol.equipo?.nombre ?? 'Sin equipo',
        goles: 0,
        penales: 0,
      };
      actual.goles++;
      if (gol.tipo === 'penal') actual.penales++;
      mapa.set(gol.jugadorId, actual);
    }

    const jugadorIds = [...mapa.keys()];
    if (jugadorIds.length) {
      const where: any = {
        campeonatoId,
        jugadorId: In(jugadorIds),
        estado: 'habilitado',
        activo: true,
      };
      if (categoriaId) where.categoriaId = categoriaId;
      const habilitaciones = await this.habilitaciones.find({ where, order: { id: 'ASC' } });
      for (const habilitacion of habilitaciones) {
        const goleador = mapa.get(habilitacion.jugadorId);
        if (goleador && habilitacion.equipo) {
          goleador.equipoId = habilitacion.equipoId;
          goleador.equipoNombre = habilitacion.equipo.nombre;
        }
      }
    }

    return [...mapa.values()]
      .sort((a, b) => b.goles - a.goles || b.penales - a.penales || a.jugadorNombre.localeCompare(b.jugadorNombre, 'es'))
      .slice(0, 10);
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
