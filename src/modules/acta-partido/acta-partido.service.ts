import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActaAlineacion } from './entities/acta-alineacion.entity';
import { ActaInformePartido } from './entities/acta-informe-partido.entity';
import { ActaIncidencia } from './entities/acta-incidencia.entity';
import { GuardarAlineacionDto } from './dto/guardar-alineacion.dto';
import { GuardarInformePartidoDto } from './dto/guardar-informe-partido.dto';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';
import { Partido } from '../partidos/entities/partido.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';

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

    @InjectRepository(ActaInformePartido)
    private readonly informeRepo: Repository<ActaInformePartido>,

    @InjectRepository(ActaIncidencia)
    private readonly incidenciaRepo: Repository<ActaIncidencia>,

    @InjectRepository(Campeonato)
    private readonly campeonatoRepo: Repository<Campeonato>,
  ) {}

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

    const idsSancionados = new Set(sancionesActivas.map((s) => s.jugadorId));

    // Mapear y separar por equipo
    const mapearJugador = (jc: JugadorCampeonato) => ({
      jugadorId: jc.jugadorId,
      jugador: jc.jugador,
      equipoId: jc.equipoId,
      equipo: jc.equipo,
      numeroCancha: jc.numeroCancha,
      estadoSugerido: idsSancionados.has(jc.jugadorId) ? 'suspendido' : 'jugo',
      sancionActiva: sancionesActivas.find((s) => s.jugadorId === jc.jugadorId) ?? null,
    });

    return {
      partido,
      jugadoresLocal: jugadores
        .filter((j) => j.equipoId === partido.equipoLocalId)
        .map(mapearJugador),
      jugadoresVisitante: jugadores
        .filter((j) => j.equipoId === partido.equipoVisitanteId)
        .map(mapearJugador),
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

    // Eliminar alineación previa (operación idempotente: se puede guardar N veces)
    await this.actaRepo.delete({ partidoId });

    if (!dto.jugadores || dto.jugadores.length === 0) {
      return [];
    }

    // Validar que ningún jugador sancionado venga marcado como jugó/expulsado
    const jugadorIdsEnPlanilla = dto.jugadores.map((j) => j.jugadorId);
    const sancionesActivas = await this.sancionRepo.find({
      where: {
        jugadorId: In(jugadorIdsEnPlanilla),
        campeonatoId: partido.campeonatoId,
        suspensionActiva: true,
        activo: true,
      },
    });
    const idsSancionados = new Set(sancionesActivas.map((s) => s.jugadorId));
    const infractores = dto.jugadores.filter(
      (j) => idsSancionados.has(j.jugadorId) && (j.estado === 'jugo' || j.estado === 'expulsado'),
    );
    if (infractores.length > 0) {
      throw new BadRequestException(
        `Los siguientes jugadores tienen suspensión activa y no pueden participar: IDs ${infractores.map((j) => j.jugadorId).join(', ')}`,
      );
    }

    const registros = dto.jugadores.map((j) => {
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

    return await this.actaRepo.save(registros);
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

    return { partido, informe: informe ?? null, incidencias };
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
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden acceder al tribunal.');
    }

    return this.incidenciaRepo.find({
      where: { campeonatoId, estadoResolucion: 'pendiente', activo: true },
      relations: ['jugador', 'equipo'],
      order: { partidoId: 'ASC', id: 'ASC' },
    });
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
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden resolver incidencias.');
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
      sancion.suspensionActiva = (dto.partidosSuspension ?? 0) > 0;
      sancion.fechaSancion = dto.fechaSancion ? new Date(dto.fechaSancion) : new Date();
      sancion.activo = true;

      const sancionGuardada = await this.sancionRepo.save(sancion);
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

  // ── Permisos ──────────────────────────────────────────────────────────────

  private validarAcceso(partido: Partido, usuario: any): void {
    if (usuario.role === 'directivo_liga') {
      if (partido.campeonato?.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos sobre este partido');
      }
    } else if (usuario.role === 'dirigente_equipo') {
      // El dirigente solo puede ver el acta de partidos donde juega su equipo
      if (
        partido.equipoLocalId !== usuario.equipoId &&
        partido.equipoVisitanteId !== usuario.equipoId
      ) {
        throw new ForbiddenException('No tienes permisos para ver este partido');
      }
    }
  }
}
