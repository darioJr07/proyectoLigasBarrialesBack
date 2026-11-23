import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActaAlineacion } from './entities/acta-alineacion.entity';
import { ActaAlineacionHistorial } from './entities/acta-alineacion-historial.entity';
import { ActaInformePartido } from './entities/acta-informe-partido.entity';
import { ActaIncidencia } from './entities/acta-incidencia.entity';
import { GuardarAlineacionDto } from './dto/guardar-alineacion.dto';
import { GuardarInformePartidoDto } from './dto/guardar-informe-partido.dto';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';
import { Partido } from '../partidos/entities/partido.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { SancionPartidoExcluido } from '../sanciones/entities/sancion-partido-excluido.entity';
import { VocaliaPartido } from '../partidos/entities/vocalia-partido.entity';
import { CambiosDorsalService } from '../jugador-campeonatos/cambios-dorsal.service';
import { ActaAlineacionJugadorDto } from './dto/acta-alineacion-jugador.dto';

@Injectable()
export class ActaPartidoService {
  constructor(
    @InjectRepository(ActaAlineacion)
    private readonly actaRepo: Repository<ActaAlineacion>,

    @InjectRepository(Partido)
    private readonly partidoRepo: Repository<Partido>,

    @InjectRepository(JugadorCampeonato)
    private readonly jugadorCampeonatoRepo: Repository<JugadorCampeonato>,

    @InjectRepository(Sancion)
    private readonly sancionRepo: Repository<Sancion>,
    @InjectRepository(SancionPartidoExcluido)
    private readonly sancionPartidoExcluidoRepo: Repository<SancionPartidoExcluido>,

    @InjectRepository(ActaInformePartido)
    private readonly informeRepo: Repository<ActaInformePartido>,

    @InjectRepository(ActaIncidencia)
    private readonly incidenciaRepo: Repository<ActaIncidencia>,

    @InjectRepository(Campeonato)
    private readonly campeonatoRepo: Repository<Campeonato>,
    @InjectRepository(VocaliaPartido)
    private readonly vocaliaRepo: Repository<VocaliaPartido>,
    private readonly cambiosDorsalService: CambiosDorsalService,
  ) {}

  private sancionTemporalVigente(sancion: Sancion): boolean {
    if (!sancion.fechaFinSuspension) return true;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(`${String(sancion.fechaFinSuspension).slice(0, 10)}T00:00:00`);
    return fin >= hoy;
  }

  /**
   * Retorna los jugadores habilitados de ambos equipos para un partido,
   * pre-sugiriendo el estado 'suspendido' en aquellos que tengan sanción activa.
   *
   * Este endpoint se llama cuando el vocal abre el acta y quiere pre-cargar
   * el listado de jugadores antes de editar manualmente lo que corresponda.
   */
  async obtenerJugadoresDisponibles(partidoId: number, usuario: any) {
    const partido = await this.partidoRepo.findOne({ where: { id: partidoId } });
    if (!partido) throw new NotFoundException('Partido no encontrado');

    this.validarAcceso(partido, usuario);

    // Traer todos los jugadores habilitados de ambos equipos en esa categoría
    const jugadores = await this.jugadorCampeonatoRepo.find({
      where: [
        {
          campeonatoId: partido.campeonatoId,
          categoriaId: partido.categoriaId,
          equipoId: partido.equipoLocalId,
          estado: 'habilitado',
          activo: true,
        },
        {
          campeonatoId: partido.campeonatoId,
          categoriaId: partido.categoriaId,
          equipoId: partido.equipoVisitanteId,
          estado: 'habilitado',
          activo: true,
        },
      ],
      relations: ['jugador'],
      order: { equipoId: 'ASC', numeroCancha: 'ASC' },
    });

    if (jugadores.length === 0) {
      return { partido, jugadoresLocal: [], jugadoresVisitante: [] };
    }

    // Identificar cuáles tienen sanción activa (suspensión) para pre-marcarlos
    const jugadorIds = jugadores.map((j) => j.jugadorId);
    const sancionesActivas = await this.sancionRepo.find({
      where: {
        jugadorId: In(jugadorIds),
        campeonatoId: partido.campeonatoId,
        suspensionActiva: true,
        activo: true,
      },
    });

    const exclusiones = sancionesActivas.length
      ? await this.sancionPartidoExcluidoRepo.find({ where: { partidoId, sancionId: In(sancionesActivas.map((s) => s.id)) } })
      : [];
    const sancionesVigentes = sancionesActivas.filter(
      (s) => this.sancionTemporalVigente(s) && !exclusiones.some((e) => e.sancionId === s.id),
    );

    const idsSancionados = new Set(sancionesVigentes.map((s) => s.jugadorId));
    const numerosEfectivos = await this.cambiosDorsalService.resolverNumerosParaContexto(
      jugadores,
      partido.etapa,
      partido.jornada,
    );

    // Mapear y separar por equipo
    const mapearJugador = (jc: JugadorCampeonato) => ({
      jugadorId: jc.jugadorId,
      jugador: jc.jugador,
      equipoId: jc.equipoId,
      equipo: jc.equipo,
      numeroCancha: numerosEfectivos.get(jc.id) ?? jc.numeroCancha,
      estadoSugerido: idsSancionados.has(jc.jugadorId) ? 'suspendido' : 'jugo',
      sancionActiva: sancionesVigentes.find((s) => s.jugadorId === jc.jugadorId) ?? null,
    });

    return {
      partido,
      jugadoresLocal: jugadores
        .filter((j) => j.equipoId === partido.equipoLocalId)
        .map(mapearJugador)
        .sort((a, b) => a.numeroCancha - b.numeroCancha),
      jugadoresVisitante: jugadores
        .filter((j) => j.equipoId === partido.equipoVisitanteId)
        .map(mapearJugador)
        .sort((a, b) => a.numeroCancha - b.numeroCancha),
    };
  }

  /**
   * Guarda (o reemplaza) la alineación completa de un partido.
   * Si ya existía una alineación previa, se elimina y se crea desde cero.
   * Esto permite editar el acta las veces que se necesite.
   */
  async guardarAlineacion(
    partidoId: number,
    dto: GuardarAlineacionDto,
    usuario: any,
  ): Promise<ActaAlineacion[]> {
    const partido = await this.partidoRepo.findOne({ where: { id: partidoId } });
    if (!partido) throw new NotFoundException('Partido no encontrado');

    this.validarAcceso(partido, usuario);

    this.validarPermisoEdicion(usuario);

    const anteriores = await this.actaRepo.find({
      where: { partidoId, activo: true },
      order: { equipoId: 'ASC', id: 'ASC' },
    });
    const jugadores = dto.jugadores ?? [];

    if (partido.estado === 'jugado' && dto.permitirCorreccion !== true) {
      throw new BadRequestException(
        'La plantilla está cerrada porque el partido ya fue jugado. Desbloquee la corrección de forma explícita antes de guardarla.',
      );
    }

    const motivoCorreccion = dto.motivoCorreccion?.trim() ?? '';
    if (partido.estado === 'jugado' && motivoCorreccion.length < 5) {
      throw new BadRequestException(
        'Debe indicar un motivo de al menos 5 caracteres para corregir la plantilla de un partido jugado.',
      );
    }

    if (jugadores.length > 0) {
      await this.validarJugadoresAlineacion(partido, jugadores, anteriores);
    }

    // Validar que ningún jugador sancionado venga marcado como jugó/expulsado
    const jugadorIdsEnPlanilla = jugadores.map((j) => j.jugadorId);
    const sancionesActivas = jugadorIdsEnPlanilla.length
      ? await this.sancionRepo.find({
          where: {
            jugadorId: In(jugadorIdsEnPlanilla),
            campeonatoId: partido.campeonatoId,
            suspensionActiva: true,
            activo: true,
          },
        })
      : [];
    // Una sanción creada después de este partido no debe bloquear la edición de
    // su planilla histórica: queda registrada como exclusión al crear la sanción.
    const exclusiones = sancionesActivas.length
      ? await this.sancionPartidoExcluidoRepo.find({
          where: { partidoId, sancionId: In(sancionesActivas.map((s) => s.id)) },
        })
      : [];
    const idsSancionados = new Set(
      sancionesActivas
        .filter((s) => this.sancionTemporalVigente(s) && !exclusiones.some((e) => e.sancionId === s.id))
        .map((s) => s.jugadorId),
    );
    const infractores = jugadores.filter(
      (j) => idsSancionados.has(j.jugadorId) && (j.estado === 'jugo' || j.estado === 'expulsado'),
    );
    if (infractores.length > 0) {
      throw new BadRequestException(
        `Los siguientes jugadores tienen suspensión activa y no pueden participar: IDs ${infractores.map((j) => j.jugadorId).join(', ')}`,
      );
    }

    const registros = jugadores.map((j) => {
      const r = new ActaAlineacion();
      r.partidoId = partidoId;
      r.campeonatoId = partido.campeonatoId;
      r.equipoId = j.equipoId;
      r.jugadorId = j.jugadorId;
      r.estado = (j.estado as ActaAlineacion['estado']) ?? 'jugo';
      r.numeroCancha = j.numeroCancha ?? null;
      r.observaciones = j.observaciones ?? null;
      return r;
    });

    // El reemplazo y su auditoría forman una sola operación: si algo falla,
    // la alineación anterior no se pierde.
    return this.actaRepo.manager.transaction(async (manager) => {
      const actaRepo = manager.getRepository(ActaAlineacion);
      await actaRepo.delete({ partidoId });
      const guardados = registros.length > 0 ? await actaRepo.save(registros) : [];

      if (partido.estado === 'jugado') {
        const historialRepo = manager.getRepository(ActaAlineacionHistorial);
        await historialRepo.save(historialRepo.create({
          partidoId,
          campeonatoId: partido.campeonatoId,
          usuarioId: usuario.userId ?? usuario.id ?? usuario.sub ?? null,
          motivo: motivoCorreccion,
          alineacionAnterior: this.crearSnapshotAlineacion(anteriores),
          alineacionNueva: this.crearSnapshotAlineacion(guardados),
        }));
      }

      return guardados;
    });
  }

  private async validarJugadoresAlineacion(
    partido: Partido,
    jugadores: ActaAlineacionJugadorDto[],
    anteriores: ActaAlineacion[],
  ): Promise<void> {
    const ids = jugadores.map((jugador) => jugador.jugadorId);
    const duplicados = [...new Set(ids.filter((id, indice) => ids.indexOf(id) !== indice))];
    if (duplicados.length > 0) {
      throw new BadRequestException(
        `La plantilla contiene jugadores duplicados: IDs ${duplicados.join(', ')}.`,
      );
    }

    const equiposPermitidos = new Set([partido.equipoLocalId, partido.equipoVisitanteId]);
    const equiposInvalidos = jugadores.filter((jugador) => !equiposPermitidos.has(jugador.equipoId));
    if (equiposInvalidos.length > 0) {
      throw new BadRequestException(
        `Hay jugadores asociados a equipos que no participan en el partido: IDs ${equiposInvalidos.map((j) => j.jugadorId).join(', ')}.`,
      );
    }

    const habilitaciones = await this.jugadorCampeonatoRepo.find({
      where: {
        campeonatoId: partido.campeonatoId,
        categoriaId: partido.categoriaId,
        jugadorId: In(ids),
        equipoId: In([...equiposPermitidos]),
      },
    });

    const invalidos = jugadores.filter((jugador) => {
      const habilitadoActual = habilitaciones.some(
        (registro) =>
          registro.jugadorId === jugador.jugadorId &&
          registro.equipoId === jugador.equipoId &&
          registro.estado === 'habilitado' &&
          registro.activo,
      );
      const yaConstabaEnPlanilla = anteriores.some(
        (registro) =>
          registro.jugadorId === jugador.jugadorId && registro.equipoId === jugador.equipoId,
      );
      return !habilitadoActual && !yaConstabaEnPlanilla;
    });

    if (invalidos.length > 0) {
      throw new BadRequestException(
        `Los siguientes jugadores no tienen una habilitación vigente para el equipo, campeonato y categoría del partido: IDs ${invalidos.map((j) => j.jugadorId).join(', ')}.`,
      );
    }
  }

  private crearSnapshotAlineacion(
    registros: Array<{
      jugadorId: number;
      equipoId: number;
      estado?: string;
      numeroCancha?: number | null;
      observaciones?: string | null;
      activo?: boolean;
    }>,
  ): Record<string, unknown>[] {
    return registros.map((registro) => ({
      jugadorId: registro.jugadorId,
      equipoId: registro.equipoId,
      estado: registro.estado ?? 'jugo',
      numeroCancha: registro.numeroCancha ?? null,
      observaciones: registro.observaciones ?? null,
      activo: registro.activo ?? true,
    }));
  }

  /**
   * Retorna la alineación ya guardada de un partido, separada por equipos.
   */
  async obtenerAlineacion(partidoId: number, usuario: any) {
    const partido = await this.partidoRepo.findOne({ where: { id: partidoId } });
    if (!partido) throw new NotFoundException('Partido no encontrado');

    this.validarAcceso(partido, usuario);

    const registros = await this.actaRepo.find({
      where: { partidoId, activo: true },
      relations: ['jugador'],
      order: { equipoId: 'ASC', id: 'ASC' },
    });

    return {
      partido,
      jugadoresLocal: registros.filter((r) => r.equipoId === partido.equipoLocalId),
      jugadoresVisitante: registros.filter((r) => r.equipoId === partido.equipoVisitanteId),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INFORME DEL VOCAL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna el informe del partido con sus incidencias.
   * Si aún no existe informe, devuelve null para que el frontend sepa que está vacío.
   */
  async obtenerInforme(partidoId: number, usuario: any) {
    const partido = await this.partidoRepo.findOne({ where: { id: partidoId } });
    if (!partido) throw new NotFoundException('Partido no encontrado');
    this.validarAcceso(partido, usuario);

    const informe = await this.informeRepo.findOne({ where: { partidoId } });
    const incidencias = await this.incidenciaRepo.find({
      where: { partidoId, activo: true },
      order: { id: 'ASC' },
    });

    const vocaliaProgramada = await this.vocaliaRepo.findOne({
      where: { partidoId, estado: 'confirmada' },
    });

    return { partido, informe: informe ?? null, incidencias, vocaliaProgramada: vocaliaProgramada ?? null };
  }

  /**
   * El vocal guarda (o actualiza) el informe general del partido y la lista
   * de incidencias disciplinarias que observó.
   *
   * ESTRATEGIA: Solo se reemplazan las incidencias aún 'pendiente'.
   * Las que el tribunal ya resolvió (sancionado/absuelto) NO se tocan.
   *
   * Si enviarATribunal=true, el estado pasa de 'borrador' a 'enviado_tribunal'
   * (transición unidireccional, no puede volver a borrador).
   */
  async guardarInforme(
    partidoId: number,
    dto: GuardarInformePartidoDto,
    usuario: any,
  ) {
    const partido = await this.partidoRepo.findOne({ where: { id: partidoId } });
    if (!partido) throw new NotFoundException('Partido no encontrado');
    this.validarAcceso(partido, usuario);
    this.validarPermisoEdicion(usuario);

    // Upsert del informe general (uno por partido)
    let informe = await this.informeRepo.findOne({ where: { partidoId } });
    if (!informe) {
      informe = new ActaInformePartido();
      informe.partidoId = partidoId;
      informe.campeonatoId = partido.campeonatoId;
      informe.estado = 'borrador';
    }

    if (dto.observacionesVocal !== undefined) {
      informe.observacionesVocal = dto.observacionesVocal ?? null;
    }
    if (dto.nombreArbitro !== undefined) {
      informe.nombreArbitro = dto.nombreArbitro ?? null;
    }
    if (dto.observacionesArbitro !== undefined) {
      informe.observacionesArbitro = dto.observacionesArbitro ?? null;
    }
    if (dto.vocalNombre !== undefined) {
      informe.vocalNombre = dto.vocalNombre ?? null;
    }
    if (dto.vocalEquipoId !== undefined) {
      informe.vocalEquipoId = dto.vocalEquipoId ?? null;
    }
    if (dto.enviarATribunal && informe.estado === 'borrador') {
      informe.estado = 'enviado_tribunal';
    }

    await this.informeRepo.save(informe);

    // Reemplazar solo las incidencias 'pendiente' — no tocar las ya resueltas por el tribunal
    await this.incidenciaRepo.delete({ partidoId, estadoResolucion: 'pendiente' });

    const registros = (dto.incidencias ?? []).map((item) => {
      const r = new ActaIncidencia();
      r.partidoId = partidoId;
      r.campeonatoId = partido.campeonatoId;
      r.categoriaId = partido.categoriaId ?? null;
      r.equipoId = item.equipoId;
      r.jugadorId = item.jugadorId ?? null;
      r.tipoIncidencia = item.tipoIncidencia as ActaIncidencia['tipoIncidencia'];
      r.minuto = item.minuto ?? null;
      r.descripcion = item.descripcion ?? null;
      r.estadoResolucion = 'pendiente';
      return r;
    });

    const incidencias = registros.length > 0
      ? await this.incidenciaRepo.save(registros)
      : [];

    return { informe, incidencias };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIBUNAL DE PENAS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lista todas las incidencias pendientes de resolución para un campeonato.
   * Es la vista del Tribunal de Penas: ve todo lo que tiene que procesar.
   */
  async listarIncidenciasPendientes(campeonatoId: number, usuario: any) {
    if (!['master', 'directivo_liga', 'tribuna_penas'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master, directivo_liga o tribuna_penas pueden acceder al tribunal.');
    }

    const incidencias = await this.incidenciaRepo.find({
      where: { campeonatoId, estadoResolucion: 'pendiente', activo: true },
      relations: ['jugador', 'equipo', 'partido', 'partido.equipoLocal', 'partido.equipoVisitante'],
      order: { partidoId: 'ASC', id: 'ASC' },
    });

    // El dorsal procede de la inscripción activa del mismo campeonato, equipo y
    // categoría de la incidencia; nunca del perfil general del jugador.
    const jugadorIds = [...new Set(incidencias.map((i) => i.jugadorId).filter((id): id is number => id != null))];
    if (jugadorIds.length === 0) return incidencias;

    const inscripciones = await this.jugadorCampeonatoRepo.find({
      where: { campeonatoId, jugadorId: In(jugadorIds), activo: true },
      order: { fechaInscripcion: 'DESC' },
    });
    const inscripcionPorClave = new Map<string, JugadorCampeonato>();
    for (const inscripcion of inscripciones) {
      const clave = `${inscripcion.jugadorId}-${inscripcion.equipoId}-${inscripcion.categoriaId}`;
      if (!inscripcionPorClave.has(clave)) inscripcionPorClave.set(clave, inscripcion);
    }

    return Promise.all(incidencias.map(async incidencia => {
      if (!incidencia.jugadorId || !incidencia.categoriaId) {
        return { ...incidencia, numeroCancha: null };
      }
      const inscripcion = inscripcionPorClave.get(
        `${incidencia.jugadorId}-${incidencia.equipoId}-${incidencia.categoriaId}`,
      );
      if (!inscripcion) return { ...incidencia, numeroCancha: null };
      const partido = incidencia.partido;
      if (!partido) return { ...incidencia, numeroCancha: inscripcion.numeroCancha };
      const numeros = await this.cambiosDorsalService.resolverNumerosParaContexto(
        [inscripcion],
        partido.etapa,
        partido.jornada,
      );
      return {
        ...incidencia,
        numeroCancha: numeros.get(inscripcion.id) ?? inscripcion.numeroCancha,
      };
    }));
  }

  /**
   * El Tribunal de Penas resuelve una incidencia:
   *   - 'sancionar' → crea una Sancion en el módulo de sanciones
   *   - 'absolver'  → cierra la incidencia sin crear sanción
   *
   * Si todas las incidencias del partido quedan resueltas, el informe
   * pasa automáticamente al estado 'resuelto'.
   */
  async resolverIncidencia(
    incidenciaId: number,
    dto: ResolverIncidenciaDto,
    usuario: any,
  ): Promise<ActaIncidencia> {
    if (!['master', 'directivo_liga', 'tribuna_penas'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master, directivo_liga o tribuna_penas pueden resolver incidencias.');
    }

    const incidencia = await this.incidenciaRepo.findOne({
      where: { id: incidenciaId, activo: true },
    });
    if (!incidencia) throw new NotFoundException(`Incidencia #${incidenciaId} no encontrada.`);
    if (incidencia.estadoResolucion !== 'pendiente') {
      throw new BadRequestException('Esta incidencia ya fue resuelta.');
    }

    if (dto.decision === 'sancionar') {
      if (!dto.tipoSancionId) {
        throw new BadRequestException('Se requiere tipoSancionId para aplicar una sanción.');
      }

      // Obtener ligaId del campeonato para la sanción
      const campeonato = await this.campeonatoRepo.findOne({
        where: { id: incidencia.campeonatoId },
      });
      if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');

      const sancion = new Sancion();
      sancion.tipoSancionId = dto.tipoSancionId;
      sancion.ligaId = campeonato.ligaId;
      sancion.campeonatoId = incidencia.campeonatoId;
      if (incidencia.categoriaId) sancion.categoriaId = incidencia.categoriaId;
      sancion.partidoId = incidencia.partidoId;
      if (incidencia.jugadorId) sancion.jugadorId = incidencia.jugadorId;
      sancion.equipoId = incidencia.equipoId;
      if (dto.reglaSancionId) sancion.reglaSancionId = dto.reglaSancionId;
      if (dto.descripcion) sancion.descripcion = dto.descripcion;
      sancion.partidosSuspension = dto.partidosSuspension ?? 0;
      sancion.partidosCumplidos = 0;
      // Solo las incidencias colectivas pueden afectar los puntos de un equipo.
      sancion.puntosDescuentoAplicado = incidencia.jugadorId
        ? 0
        : Math.max(0, Number(dto.puntosDescuentoAplicado ?? 0));
      sancion.suspensionActiva = (dto.partidosSuspension ?? 0) > 0 || !!(dto.fechaFinSuspension);
      sancion.fechaSancion = dto.fechaSancion ? new Date(dto.fechaSancion) : new Date();
      if (dto.fechaInicioSuspension) sancion.fechaInicioSuspension = new Date(dto.fechaInicioSuspension) as any;
      if (dto.fechaFinSuspension)    sancion.fechaFinSuspension    = new Date(dto.fechaFinSuspension) as any;
      sancion.activo = true;

      // Multa económica aprobada por el tribunal
      if (dto.montoMulta != null && Number(dto.montoMulta) > 0) {
        sancion.montoMulta  = Number(dto.montoMulta);
        sancion.estadoCobro = 'aprobada';
      } else {
        sancion.montoMulta  = null;
        sancion.estadoCobro = 'sin_multa';
      }
      sancion.cobrada = false;

      const sancionGuardada = await this.sancionRepo.save(sancion);
      await this.excluirPartidosYaJugados(sancionGuardada);
      incidencia.sancionId = sancionGuardada.id;
      incidencia.estadoResolucion = 'sancionado';
    } else {
      incidencia.estadoResolucion = 'absuelto';
    }

    incidencia.observacionesTribunal = dto.observacionesTribunal ?? null;
    incidencia.fechaResolucion = new Date();
    const resuelta = await this.incidenciaRepo.save(incidencia);

    // Si no quedan incidencias pendientes en el partido → informe pasa a 'resuelto'
    const pendientes = await this.incidenciaRepo.count({
      where: { partidoId: incidencia.partidoId, estadoResolucion: 'pendiente', activo: true },
    });
    if (pendientes === 0) {
      await this.informeRepo.update({ partidoId: incidencia.partidoId }, { estado: 'resuelto' });
    }

    return resuelta;
  }

  private async excluirPartidosYaJugados(sancion: Sancion): Promise<void> {
    if (!sancion.jugadorId || !sancion.equipoId || !sancion.campeonatoId || !sancion.suspensionActiva) return;
    const partidos = await this.partidoRepo.find({
      where: [
        { campeonatoId: sancion.campeonatoId, equipoLocalId: sancion.equipoId, estado: 'jugado', activo: true },
        { campeonatoId: sancion.campeonatoId, equipoVisitanteId: sancion.equipoId, estado: 'jugado', activo: true },
      ],
    });
    const partidoIds = new Set(partidos.map((partido) => partido.id));
    if (sancion.partidoId) partidoIds.add(sancion.partidoId);
    if (partidoIds.size) await this.sancionPartidoExcluidoRepo.save([...partidoIds].map((partidoId) => this.sancionPartidoExcluidoRepo.create({ sancionId: sancion.id, partidoId })));
  }

  // ── Permisos ──────────────────────────────────────────────────────────────

  private validarAcceso(partido: Partido, usuario: any): void {
    if (usuario.role === 'master') return;

    if (['directivo_liga', 'tribuna_penas', 'tesoreria'].includes(usuario.role)) {
      if (Number(partido.campeonato?.ligaId) !== Number(usuario.ligaId)) {
        throw new ForbiddenException('No tienes permisos sobre este partido');
      }
      return;
    }

    if (usuario.role === 'dirigente_equipo') {
      // El dirigente solo puede ver el acta de partidos donde juega su equipo
      if (
        Number(partido.equipoLocalId) !== Number(usuario.equipoId) &&
        Number(partido.equipoVisitanteId) !== Number(usuario.equipoId)
      ) {
        throw new ForbiddenException('No tienes permisos para ver este partido');
      }
      return;
    }

    throw new ForbiddenException('No tienes permisos para acceder al acta de este partido');
  }

  private validarPermisoEdicion(usuario: any): void {
    if (!['master', 'directivo_liga'].includes(usuario?.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden modificar el acta del partido.');
    }
  }
}
