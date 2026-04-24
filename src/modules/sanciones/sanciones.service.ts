import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoSancion } from './entities/tipo-sancion.entity';
import { ReglaSancion } from './entities/regla-sancion.entity';
import { Sancion } from './entities/sancion.entity';
import { CreateTipoSancionDto } from './dto/create-tipo-sancion.dto';
import { UpdateTipoSancionDto } from './dto/update-tipo-sancion.dto';
import { CreateReglaSancionDto } from './dto/create-regla-sancion.dto';
import { UpdateReglaSancionDto } from './dto/update-regla-sancion.dto';
import { CreateSancionDto } from './dto/create-sancion.dto';
import { UpdateSancionDto } from './dto/update-sancion.dto';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { ActaAlineacion } from '../acta-partido/entities/acta-alineacion.entity';

@Injectable()
export class SancionesService {
  constructor(
    @InjectRepository(TipoSancion)
    private tipoSancionRepo: Repository<TipoSancion>,
    @InjectRepository(ReglaSancion)
    private reglaSancionRepo: Repository<ReglaSancion>,
    @InjectRepository(Sancion)
    private sancionRepo: Repository<Sancion>,
    @InjectRepository(JugadorCampeonato)
    private jugadorCampeonatoRepo: Repository<JugadorCampeonato>,
    @InjectRepository(ActaAlineacion)
    private actaAlineacionRepo: Repository<ActaAlineacion>,
    @InjectRepository(Campeonato)
    private campeonatoRepo: Repository<Campeonato>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // TIPOS DE SANCIÓN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo tipo de sanción en el catálogo de la liga.
   */
  async crearTipoSancion(dto: CreateTipoSancionDto, usuario: any): Promise<TipoSancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden crear tipos de sanción.');
    }
    const tipo = this.tipoSancionRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      aplicaA: dto.aplicaA ?? 'jugador',
      ligaId: dto.ligaId ?? undefined,
      activo: true,
    });
    return this.tipoSancionRepo.save(tipo) as Promise<TipoSancion>;
  }

  /**
   * Lista tipos de sanción. Devuelve los globales (ligaId=null) más los de la liga indicada.
   */
  async listarTiposSancion(ligaId?: number): Promise<TipoSancion[]> {
    const query = this.tipoSancionRepo
      .createQueryBuilder('tipo')
      .where('tipo.activo = :activo', { activo: true })
      .orderBy('tipo.aplicaA', 'ASC')
      .addOrderBy('tipo.nombre', 'ASC');

    if (ligaId) {
      query.andWhere('(tipo.liga_id = :ligaId OR tipo.liga_id IS NULL)', { ligaId });
    } else {
      query.andWhere('tipo.liga_id IS NULL');
    }

    return query.getMany();
  }

  /**
   * Actualiza nombre, descripción, aplicaA o estado activo de un tipo de sanción.
   */
  async actualizarTipoSancion(id: number, dto: UpdateTipoSancionDto, usuario: any): Promise<TipoSancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para editar tipos de sanción.');
    }
    const tipo = await this.tipoSancionRepo.findOne({ where: { id } });
    if (!tipo) throw new NotFoundException(`TipoSancion #${id} no encontrado.`);
    Object.assign(tipo, dto);
    return this.tipoSancionRepo.save(tipo);
  }

  /**
   * Soft delete de un tipo de sanción.
   */
  async desactivarTipoSancion(id: number, usuario: any): Promise<{ message: string }> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para desactivar tipos de sanción.');
    }
    const tipo = await this.tipoSancionRepo.findOne({ where: { id } });
    if (!tipo) throw new NotFoundException(`TipoSancion #${id} no encontrado.`);
    tipo.activo = false;
    await this.tipoSancionRepo.save(tipo);
    return { message: `Tipo de sanción "${tipo.nombre}" desactivado.` };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGLAS DE SANCIÓN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea una regla de sanción para una liga (y opcionalmente campeonato específico).
   */
  async crearReglaSancion(dto: CreateReglaSancionDto, usuario: any): Promise<ReglaSancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden crear reglas de sanción.');
    }
    const regla = this.reglaSancionRepo.create({
      ligaId: dto.ligaId,
      campeonatoId: dto.campeonatoId ?? undefined,
      tipoSancionId: dto.tipoSancionId,
      descripcion: dto.descripcion ?? undefined,
      acumulacionActiva: dto.acumulacionActiva ?? false,
      acumulacionCantidad: dto.acumulacionCantidad ?? undefined,
      partidosSuspension: dto.partidosSuspension ?? undefined,
      puntosDescuento: dto.puntosDescuento ?? 0,
      modoCastigo: dto.modoCastigo ?? 'partidos',
      duracionMeses: dto.duracionMeses ?? null,
      activo: true,
    });
    return this.reglaSancionRepo.save(regla) as Promise<ReglaSancion>;
  }

  /**
   * Lista reglas de sanción. Filtra por liga y opcionalmente por campeonato.
   */
  async listarReglas(ligaId: number, campeonatoId?: number): Promise<ReglaSancion[]> {
    const query = this.reglaSancionRepo
      .createQueryBuilder('regla')
      .leftJoinAndSelect('regla.tipoSancion', 'tipo')
      .where('regla.liga_id = :ligaId', { ligaId })
      .andWhere('regla.activo = :activo', { activo: true });

    if (campeonatoId) {
      query.andWhere('(regla.campeonato_id = :campeonatoId OR regla.campeonato_id IS NULL)', { campeonatoId });
    }

    return query.orderBy('tipo.nombre', 'ASC').getMany();
  }

  /**
   * Actualiza parámetros de acumulación y suspensión de una regla.
   */
  async actualizarReglaSancion(id: number, dto: UpdateReglaSancionDto, usuario: any): Promise<ReglaSancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para editar reglas de sanción.');
    }
    const regla = await this.reglaSancionRepo.findOne({ where: { id } });
    if (!regla) throw new NotFoundException(`ReglaSancion #${id} no encontrada.`);
    Object.assign(regla, dto);
    return this.reglaSancionRepo.save(regla);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SANCIONES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra una sanción.
   *
   * LÓGICA DE ACUMULACIÓN:
   * Si la sanción es para un jugador y existe una regla con acumulacionActiva=true
   * para ese tipo de sanción en la liga/campeonato, el servicio:
   *   1. Cuenta las sanciones del mismo tipo que tiene el jugador en el campeonato.
   *   2. Si llega al límite (acumulacionCantidad), crea automáticamente
   *      una suspensión adicional con partidosSuspension de la regla.
   */
  async registrarSancion(dto: CreateSancionDto, usuario: any): Promise<Sancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden registrar sanciones.');
    }

    // Resolver categoriaId automáticamente si no viene en el DTO
    let categoriaId = dto.categoriaId ?? undefined;
    if (!categoriaId && dto.jugadorId && dto.campeonatoId) {
      const jc = await this.jugadorCampeonatoRepo.findOne({
        where: { jugadorId: dto.jugadorId, campeonatoId: dto.campeonatoId, estado: 'habilitado', activo: true },
        order: { id: 'DESC' },
      });
      if (jc) categoriaId = jc.categoriaId;
    }

    const sancion = this.sancionRepo.create({
      tipoSancionId: dto.tipoSancionId,
      ligaId: dto.ligaId,
      campeonatoId: dto.campeonatoId,
      categoriaId,

      partidoId: dto.partidoId ?? undefined,
      jugadorId: dto.jugadorId ?? undefined,
      equipoId: dto.equipoId ?? undefined,
      reglaSancionId: dto.reglaSancionId ?? undefined,
      descripcion: dto.descripcion ?? undefined,
      partidosSuspension: dto.partidosSuspension ?? 0,
      partidosCumplidos: 0,
      suspensionActiva: dto.suspensionActiva ?? ((dto.partidosSuspension ?? 0) > 0),
      fechaSancion: dto.fechaSancion ? new Date(dto.fechaSancion) as any : new Date() as any,
      fechaInicioSuspension: dto.fechaInicioSuspension ? new Date(dto.fechaInicioSuspension) as any : null,
      fechaFinSuspension: dto.fechaFinSuspension ? new Date(dto.fechaFinSuspension) as any : null,
      activo: true,
    });

    // Si viene reglaSancionId y no se indicaron partidos manualmente, tomarlos de la regla
    if (dto.reglaSancionId && !dto.partidosSuspension) {
      const reglaRef = await this.reglaSancionRepo.findOne({ where: { id: dto.reglaSancionId } });
      if (reglaRef) {
        if (reglaRef.modoCastigo === 'tiempo' && reglaRef.duracionMeses) {
          // Suspensión por tiempo: calcular fechaFin a partir de fechaInicio
          const fechaInicio = sancion.fechaSancion
            ? new Date(sancion.fechaSancion)
            : new Date();
          const fechaFin = new Date(fechaInicio);
          fechaFin.setMonth(fechaFin.getMonth() + reglaRef.duracionMeses);
          sancion.fechaInicioSuspension = fechaInicio as any;
          sancion.fechaFinSuspension    = fechaFin as any;
          sancion.suspensionActiva      = new Date() <= fechaFin;
          sancion.partidosSuspension    = 0;
        } else if (reglaRef.partidosSuspension) {
          sancion.partidosSuspension = reglaRef.partidosSuspension;
          sancion.suspensionActiva   = reglaRef.partidosSuspension > 0;
        }
      }
    }

    const sancionGuardada = await this.sancionRepo.save(sancion) as Sancion;

    // ── Evaluar acumulación automática si aplica ─────────────────────────────
    if (dto.jugadorId && dto.campeonatoId) {
      await this.evaluarAcumulacion(sancionGuardada, usuario);
    }

    return sancionGuardada;
  }

  /**
   * Evalúa si la sanción recién registrada activa la acumulación automática.
   * Si la regla tiene acumulacionActiva=true y el jugador llegó al límite,
   * crea una suspensión automática adicional.
   */
  private async evaluarAcumulacion(sancion: Sancion, usuario: any): Promise<void> {
    // Buscar regla de acumulación para este tipo en la liga/campeonato
    const regla = await this.reglaSancionRepo
      .createQueryBuilder('regla')
      .where('regla.liga_id = :ligaId', { ligaId: sancion.ligaId })
      .andWhere('regla.tipo_sancion_id = :tipoId', { tipoId: sancion.tipoSancionId })
      .andWhere('regla.acumulacion_activa = true')
      .andWhere('regla.activo = true')
      .andWhere('(regla.campeonato_id = :campeonatoId OR regla.campeonato_id IS NULL)',
        { campeonatoId: sancion.campeonatoId })
      .orderBy('regla.campeonato_id', 'DESC') // prioriza la regla específica del campeonato
      .getOne();

    if (!regla || !regla.acumulacionCantidad || !regla.partidosSuspension) return;

    // Contar sanciones activas del mismo tipo para este jugador en el campeonato
    const total = await this.sancionRepo.count({
      where: {
        jugadorId: sancion.jugadorId,
        campeonatoId: sancion.campeonatoId,
        tipoSancionId: sancion.tipoSancionId,
        activo: true,
      },
    });

    // Si llegó exactamente al múltiplo del límite, crear suspensión automática
    if (total > 0 && total % regla.acumulacionCantidad === 0) {
      const suspension = this.sancionRepo.create({
        tipoSancionId: sancion.tipoSancionId,
        ligaId: sancion.ligaId,
        campeonatoId: sancion.campeonatoId,
        categoriaId: sancion.categoriaId,
        jugadorId: sancion.jugadorId,
        equipoId: sancion.equipoId,
        descripcion: `Suspensión automática por acumulación de ${regla.acumulacionCantidad} sanciones`,
        partidosSuspension: regla.partidosSuspension,
        partidosCumplidos: 0,
        suspensionActiva: true,
        fechaSancion: sancion.fechaSancion,
        activo: true,
      });
      await this.sancionRepo.save(suspension);
    }
  }

  /**
   * Lista sanciones con filtros opcionales.
   * El directivo_liga solo ve sanciones de su liga.
   * El dirigente_equipo solo ve sanciones de su equipo.
   */
  async listarSanciones(
    filtros: {
      campeonatoId?: number;
      ligaId?: number;
      jugadorId?: number;
      equipoId?: number;
      tipoSancionId?: number;
      soloActivas?: boolean;
      incluirAnuladas?: boolean;
    },
    usuario: any,
  ): Promise<Sancion[]> {
    const query = this.sancionRepo
      .createQueryBuilder('sancion')
      .leftJoinAndSelect('sancion.tipoSancion', 'tipo')
      .leftJoinAndSelect('sancion.reglaSancion', 'regla')
      .leftJoinAndSelect('sancion.jugador', 'jugador')
      .leftJoinAndSelect('sancion.equipo', 'equipo')
      .leftJoinAndSelect('sancion.campeonato', 'campeonato')
      .leftJoinAndSelect('sancion.categoria', 'categoria')
      // Número de cancha del jugador en ESTE campeonato y equipo (de la calificación)
      .leftJoin(
        'jugador_campeonatos',
        'jc',
        'jc.jugador_id = sancion.jugador_id AND jc.campeonato_id = sancion.campeonato_id AND jc.equipo_id = sancion.equipo_id AND jc.activo = true',
      )
      .addSelect('jc.numero_cancha', 'numeroCanchaCalificacion');

    // Si NO se piden anuladas, filtrar solo las activas (comportamiento por defecto)
    if (!filtros.incluirAnuladas) {
      query.where('sancion.activo = true');
    } else {
      query.where('1=1'); // sin restricción de activo
    }

    // Restricción por rol
    if (usuario.role === 'directivo_liga') {
      query.andWhere('sancion.liga_id = :ligaId', { ligaId: usuario.ligaId });
    } else if (usuario.role === 'dirigente_equipo') {
      query.andWhere('sancion.equipo_id = :equipoId', { equipoId: usuario.equipoId });
    }

    if (filtros.campeonatoId) {
      query.andWhere('sancion.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    }
    if (filtros.ligaId && usuario.role === 'master') {
      query.andWhere('sancion.liga_id = :ligaId', { ligaId: filtros.ligaId });
    }
    if (filtros.jugadorId) {
      query.andWhere('sancion.jugador_id = :jugadorId', { jugadorId: filtros.jugadorId });
    }
    if (filtros.equipoId) {
      query.andWhere('sancion.equipo_id = :equipoId', { equipoId: filtros.equipoId });
    }
    if (filtros.tipoSancionId) {
      query.andWhere('sancion.tipo_sancion_id = :tipoId', { tipoId: filtros.tipoSancionId });
    }
    if (filtros.soloActivas) {
      query.andWhere(
        '(sancion.suspension_activa = true OR ' +
        '(sancion.fecha_fin_suspension IS NOT NULL AND sancion.fecha_fin_suspension >= CURRENT_DATE))',
      );
    }

    const { entities, raw } = await query
      .orderBy('sancion.fecha_sancion', 'DESC')
      .addOrderBy('sancion.creado_en', 'DESC')
      .getRawAndEntities();

    // Mapear numeroCanchaCalificacion desde los raw results (viene del LEFT JOIN a jugador_campeonatos)
    return entities.map((sancion, i) => {
      (sancion as any).numeroCanchaCalificacion = raw[i]?.numeroCanchaCalificacion ?? null;
      return sancion;
    }) as Sancion[];
  }

  /**
   * Devuelve las sanciones de suspensión activas de un jugador.
   * Se usa para mostrar el badge de suspensión al cargar un partido.
   */
  async sancionesActivasJugador(jugadorId: number): Promise<Sancion[]> {
    return this.sancionRepo.find({
      where: { jugadorId, suspensionActiva: true, activo: true },
      order: { creadoEn: 'DESC' },
    });
  }

  /**
   * Actualiza descripción, partidos de suspensión o estado de la sanción.
   */
  async actualizarSancion(id: number, dto: UpdateSancionDto, usuario: any): Promise<Sancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para editar sanciones.');
    }
    const sancion = await this.sancionRepo.findOne({ where: { id } });
    if (!sancion) throw new NotFoundException(`Sancion #${id} no encontrada.`);

    Object.assign(sancion, dto);

    // Si se actualizan partidos cumplidos y ya completó la suspensión, desactivarla
    if (
      sancion.partidosCumplidos >= sancion.partidosSuspension &&
      sancion.partidosSuspension > 0
    ) {
      sancion.suspensionActiva = false;
    }

    return this.sancionRepo.save(sancion);
  }

  /**
   * Apelación / reemplazo de una sanción existente.
   *
   * LÓGICA:
   *   1. Anula la sanción original (activo=false, suspensionActiva=false).
   *   2. Crea una nueva sanción heredando: jugador, equipo, campeonato,
   *      partido, categoría y los partidos ya cumplidos de la original.
   *   3. Si los partidos ya cumplidos >= partidos de la nueva sanción,
   *      la nueva sanción arranca directamente como inactiva (ya cumplida).
   *   4. Vincula origenSancionId a la sanción original para trazabilidad.
   */
  async apelarSancion(id: number, dto: import('./dto/apelar-sancion.dto').ApelarSancionDto, usuario: any): Promise<Sancion> {
    if (!['master', 'directivo_liga', 'tribuna_penas'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para apelar sanciones.');
    }

    const original = await this.sancionRepo.findOne({ where: { id, activo: true } });
    if (!original) throw new NotFoundException(`Sanción #${id} no encontrada o ya fue anulada.`);

    // Anular la sanción original
    original.activo = false;
    original.suspensionActiva = false;
    await this.sancionRepo.save(original);

    const partidosCumplidos = original.partidosCumplidos ?? 0;
    const nuevosPartidosSuspension = dto.partidosSuspension ?? 0;

    // Si ya cumplió igual o más partidos que los de la nueva sanción → ya está libre
    const suspensionActiva =
      dto.fechaFinSuspension
        ? true  // modo tiempo: la fecha controla la vigencia
        : partidosCumplidos < nuevosPartidosSuspension;

    const nueva = this.sancionRepo.create({
      tipoSancionId:         dto.tipoSancionId,
      reglaSancionId:        dto.reglaSancionId ?? undefined,
      ligaId:                original.ligaId,
      campeonatoId:          original.campeonatoId,
      categoriaId:           original.categoriaId ?? undefined,
      partidoId:             original.partidoId ?? undefined,
      jugadorId:             original.jugadorId ?? undefined,
      equipoId:              original.equipoId ?? undefined,
      descripcion:           dto.descripcion ?? undefined,
      partidosSuspension:    nuevosPartidosSuspension,
      partidosCumplidos,
      suspensionActiva,
      fechaSancion:          dto.fechaSancion ? (dto.fechaSancion as any) : (new Date() as any),
      fechaInicioSuspension: dto.fechaInicioSuspension ? (dto.fechaInicioSuspension as any) : null,
      fechaFinSuspension:    dto.fechaFinSuspension ? (dto.fechaFinSuspension as any) : null,
      origenSancionId:       original.id,
      activo:                true,
    });

    return this.sancionRepo.save(nueva) as Promise<Sancion>;
  }

  /**
   * Anula (soft delete) una sanción.
   */
  async anularSancion(id: number, usuario: any): Promise<{ message: string }> {
    if (!['master', 'directivo_liga', 'tribuna_penas'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para anular sanciones.');
    }
    const sancion = await this.sancionRepo.findOne({ where: { id } });
    if (!sancion) throw new NotFoundException(`Sancion #${id} no encontrada.`);
    sancion.activo = false;
    sancion.suspensionActiva = false;
    await this.sancionRepo.save(sancion);
    return { message: `Sanción #${id} anulada correctamente.` };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ARRASTRE DE SANCIONES ENTRE CAMPEONATOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Busca suspensiones activas de un jugador en campeonatos ANTERIORES de la
   * misma liga que aún tienen pendientes (partidos o tiempo).
   * Se usa para alertar al directivo al momento de inscribir al jugador.
   */
  async obtenerSuspensionesArrastradas(
    jugadorId: number,
    ligaId: number,
    nuevoCampeonatoId: number,
  ): Promise<Sancion[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const suspensiones = await this.sancionRepo
      .createQueryBuilder('sancion')
      .leftJoinAndSelect('sancion.tipoSancion', 'tipo')
      .leftJoinAndSelect('sancion.reglaSancion', 'regla')
      .leftJoinAndSelect('sancion.campeonato', 'campeonato')
      .leftJoinAndSelect('sancion.equipo', 'equipo')
      .where('sancion.jugador_id = :jugadorId', { jugadorId })
      .andWhere('sancion.liga_id = :ligaId', { ligaId })
      .andWhere('sancion.campeonato_id != :nuevoCampeonatoId', { nuevoCampeonatoId })
      .andWhere('sancion.suspension_activa = true')
      .andWhere('sancion.activo = true')
      // No debe haber sido ya transferida a este campeonato (evitar doble arrastre)
      .andWhere(
        'NOT EXISTS (' +
        '  SELECT 1 FROM sanciones s2' +
        '  WHERE s2.origen_sancion_id = sancion.id' +
        '    AND s2.campeonato_id = :nuevoCampeonatoId' +
        '    AND s2.activo = true' +
        ')',
        { nuevoCampeonatoId },
      )
      .orderBy('sancion.fecha_sancion', 'ASC')
      .getMany();

    return suspensiones;
  }

  /**
   * Transfiere una suspensión pendiente al nuevo campeonato.
   *
   * Para 'partidos': crea nueva sanción con los partidos que faltan.
   * Para 'tiempo':   crea nueva sanción heredando la misma fechaFin (ya es date-based).
   *
   * La sanción original queda cerrada (suspensionActiva = false).
   */
  async transferirSancion(
    sancionId: number,
    nuevoCampeonatoId: number,
    usuario: any,
  ): Promise<Sancion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden transferir sanciones.');
    }

    const original = await this.sancionRepo.findOne({
      where: { id: sancionId, activo: true, suspensionActiva: true },
      relations: ['campeonato', 'reglaSancion'],
    });
    if (!original) throw new NotFoundException(`Sanción #${sancionId} no encontrada o no está activa.`);

    // Verificar que no se haya transferido ya a este campeonato
    const yaTransferida = await this.sancionRepo.findOne({
      where: {
        origenSancionId: sancionId,
        campeonatoId: nuevoCampeonatoId,
        activo: true,
      },
    });
    if (yaTransferida) {
      throw new BadRequestException('Esta sanción ya fue transferida a ese campeonato.');
    }

    // Obtener datos del nuevo campeonato para ligaId
    const nuevoCampeonato = await this.campeonatoRepo.findOne({ where: { id: nuevoCampeonatoId } });
    if (!nuevoCampeonato) throw new NotFoundException(`Campeonato #${nuevoCampeonatoId} no encontrado.`);

    // Buscar la inscripción del jugador en el nuevo campeonato para el equipoId actual
    const jc = await this.jugadorCampeonatoRepo.findOne({
      where: {
        jugadorId: original.jugadorId!,
        campeonatoId: nuevoCampeonatoId,
        activo: true,
      },
      order: { id: 'DESC' },
    });

    // El jugador DEBE estar inscrito en el nuevo campeonato antes de transferir.
    // Sin habilitación activa, no se conoce el equipo correcto y los partidos
    // cumplidos nunca se contarían (procesarPartidosCumplidos filtra por equipoId).
    if (!jc) {
      throw new BadRequestException(
        'El jugador no tiene una habilitación activa en el campeonato destino. ' +
        'Debe inscribirse primero antes de transferir la sanción.',
      );
    }

    // Calcular partidos pendientes (para modo 'partidos')
    const partidosPendientes =
      (original.partidosSuspension ?? 0) - (original.partidosCumplidos ?? 0);

    const descripcionArrastre =
      `Arrastrada del campeonato "${original.campeonato?.nombre ?? '#' + original.campeonatoId}"`;

    const nueva = this.sancionRepo.create({
      tipoSancionId:        original.tipoSancionId,
      ligaId:               nuevoCampeonato.ligaId,
      campeonatoId:         nuevoCampeonatoId,
      categoriaId:          jc?.categoriaId ?? original.categoriaId,
      jugadorId:            original.jugadorId,
      equipoId:             jc?.equipoId ?? original.equipoId,
      reglaSancionId:       original.reglaSancionId ?? undefined,
      descripcion:          descripcionArrastre,
      // Por partidos
      partidosSuspension:   original.reglaSancion?.modoCastigo === 'tiempo' ? 0 : Math.max(0, partidosPendientes),
      partidosCumplidos:    0,
      // Por tiempo: heredar misma fechaFin
      fechaInicioSuspension: original.reglaSancion?.modoCastigo === 'tiempo'
        ? new Date() as any
        : null,
      fechaFinSuspension:   original.reglaSancion?.modoCastigo === 'tiempo'
        ? original.fechaFinSuspension
        : null,
      suspensionActiva:     true,
      fechaSancion:         new Date() as any,
      origenSancionId:      original.id,
      activo:               true,
    });

    const nuevaGuardada = await this.sancionRepo.save(nueva) as Sancion;

    // Cerrar la sanción original
    original.suspensionActiva = false;
    await this.sancionRepo.save(original);

    return nuevaGuardada;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTOMATIZACIÓN DE PARTIDOS CUMPLIDOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Se llama automáticamente cuando se registra el resultado de un partido.
   *
   * LÓGICA:
   * 1. Busca todas las suspensiones activas (suspensionActiva=true) de los
   *    dos equipos del partido en ese campeonato.
   * 2. A cada una le suma +1 a partidosCumplidos (el equipo jugó un partido
   *    con el jugador impedido de participar).
   * 3. Si partidosCumplidos alcanza o supera partidosSuspension, desactiva
   *    la suspensión automáticamente (suspensionActiva = false).
   *
   * SEGURIDAD: si no hay suspensiones activas, retorna inmediatamente sin
   * hacer ninguna operación en la BD. No lanza excepciones para no afectar
   * el flujo de registro de resultados.
   */
  async procesarPartidosCumplidos(
    campeonatoId: number,
    equipoLocalId: number,
    equipoVisitanteId: number,
    partidoId: number,
  ): Promise<void> {
    // Buscar suspensiones activas de ambos equipos en este campeonato
    const suspensiones = await this.sancionRepo.find({
      where: [
        { campeonatoId, equipoId: equipoLocalId,     suspensionActiva: true, activo: true },
        { campeonatoId, equipoId: equipoVisitanteId, suspensionActiva: true, activo: true },
      ],
    });

    if (suspensiones.length === 0) return;

    // Cargar la planilla del partido para verificar si el jugador realmente jugó
    const planilla = await this.actaAlineacionRepo.find({ where: { partidoId } });
    // Mapa: jugadorId → estado en la planilla
    const estadoEnPlanilla = new Map<number, string>(
      planilla.map((a) => [a.jugadorId, a.estado]),
    );

    // Estados que significan que el jugador SÍ jugó (no cumple partido de suspensión)
    const JUGO = new Set(['jugo', 'expulsado']);

    for (const s of suspensiones) {
      if (!s.jugadorId) continue; // sanciones colectivas no tienen counter individual

      const estadoJugador = estadoEnPlanilla.get(s.jugadorId);

      // Si aparece en la planilla y jugó → NO contar como cumplido
      if (estadoJugador && JUGO.has(estadoJugador)) continue;

      // Si no aparece en planilla, o aparece como suspendido/ausente/lesionado/no_jugo → contar
      s.partidosCumplidos = (s.partidosCumplidos ?? 0) + 1;

      // Levantar la suspensión si el jugador completó todos los partidos
      if (s.partidosSuspension > 0 && s.partidosCumplidos >= s.partidosSuspension) {
        s.suspensionActiva = false;
      }
    }

    // Desactivar también suspensiones por tiempo cuya fecha de fin ya pasó
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    for (const s of suspensiones) {
      if (s.suspensionActiva && s.fechaFinSuspension && new Date(s.fechaFinSuspension) < hoy) {
        s.suspensionActiva = false;
      }
    }

    await this.sancionRepo.save(suspensiones);
  }
}
