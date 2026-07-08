import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigVocalia } from './entities/config-vocalia.entity';
import { CobroPartido } from './entities/cobro-partido.entity';
import { MovimientoTesoreria } from './entities/movimiento-tesoreria.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { GuardarConfigVocaliaDto } from './dto/guardar-config-vocalia.dto';
import { CreateCobroPartidoDto } from './dto/create-cobro-partido.dto';
import { PagarCobroPartidoDto } from './dto/pagar-cobro-partido.dto';
import { CreateMovimientoTesoreriaDto } from './dto/create-movimiento-tesoreria.dto';
import { UpdateMovimientoTesoreriaDto } from './dto/update-movimiento-tesoreria.dto';
import { TrasladarSaldoDto } from './dto/trasladar-saldo.dto';
import { DerramasService } from '../derramas/derramas.service';

/** Valores por defecto del acta de vocalía si la liga no tiene configuración propia */
const CONFIG_VOCALIA_DEFAULTS = [
  { nombre: 'Valor Arbitraje',             monto: 9.00, orden: 1 },
  { nombre: 'Aporte a la Liga',            monto: 2.00, orden: 2 },
  { nombre: 'Valor Premios',               monto: 2.00, orden: 3 },
  { nombre: 'Fondo de Accidentes',         monto: 2.00, orden: 4 },
  { nombre: 'Limpieza y cuidado de baños', monto: 1.00, orden: 5 },
];

@Injectable()
export class TesoreriaService {
  constructor(
    @InjectRepository(ConfigVocalia)
    private configVocaliaRepo: Repository<ConfigVocalia>,
    @InjectRepository(CobroPartido)
    private cobroPartidoRepo: Repository<CobroPartido>,
    @InjectRepository(MovimientoTesoreria)
    private movimientoRepo: Repository<MovimientoTesoreria>,
    @InjectRepository(Campeonato)
    private campeonatoRepo: Repository<Campeonato>,
    private derramasService: DerramasService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG VOCALIA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene la configuración de valores del acta para una liga.
   * Si la liga no tiene configuración guardada, devuelve los valores por defecto.
   */
  async obtenerConfigVocalia(ligaId: number): Promise<ConfigVocalia[]> {
    const config = await this.configVocaliaRepo.find({
      where: { ligaId, activo: true },
      order: { orden: 'ASC' },
    });
    if (config.length > 0) return config;

    // Devolver estructura de defaults sin persistir
    return CONFIG_VOCALIA_DEFAULTS.map((d) =>
      this.configVocaliaRepo.create({ ...d, ligaId, activo: true }),
    );
  }

  /**
   * Guarda o reemplaza la configuración de vocalia de una liga.
   * Elimina la configuración anterior y crea la nueva.
   * Solo master y tesorería pueden hacer esto.
   */
  async guardarConfigVocalia(
    ligaId: number,
    dto: GuardarConfigVocaliaDto,
    usuario: any,
  ): Promise<ConfigVocalia[]> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master, directivo o tesorería pueden configurar los valores de vocalía.');
    }

    // Eliminar configuración anterior de esta liga
    await this.configVocaliaRepo.delete({ ligaId });

    // Crear nueva configuración
    const nuevaConfig = dto.items.map((item) =>
      this.configVocaliaRepo.create({ ...item, ligaId }),
    );
    return this.configVocaliaRepo.save(nuevaConfig);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COBRO PARTIDO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calcula el total sumando todos los montos del cobro.
   */
  private calcularTotal(dto: CreateCobroPartidoDto): number {
    const fijos =
      (dto.montoArbitraje ?? 0) +
      (dto.montoAporteLiga ?? 0) +
      (dto.montoPremios ?? 0) +
      (dto.montoFondoAccidentes ?? 0) +
      (dto.montoLimpieza ?? 0) +
      (dto.montoTarjetas ?? 0);

    const extras = (dto.extrasJson ?? []).reduce(
      (sum, e) => sum + (e.valor ?? 0),
      0,
    );

    return Number((fijos + extras).toFixed(2));
  }

  /**
   * Guarda o actualiza los cobros del acta de vocalía para un partido y equipo.
   * Si ya existe un cobro para ese partido+equipo, lo actualiza (upsert).
   */
  async guardarCobroPartido(
    dto: CreateCobroPartidoDto,
    usuario: any,
  ): Promise<CobroPartido> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para registrar cobros de partido.');
    }

    const total = this.calcularTotal(dto);

    // Verificar si ya existe (upsert manual)
    const existente = await this.cobroPartidoRepo.findOne({
      where: { partidoId: dto.partidoId, equipoId: dto.equipoId },
    });

    if (existente) {
      await this.cobroPartidoRepo.update(existente.id, {
        montoArbitraje:        dto.montoArbitraje,
        montoAporteLiga:       dto.montoAporteLiga,
        montoPremios:          dto.montoPremios,
        montoFondoAccidentes:  dto.montoFondoAccidentes,
        montoLimpieza:         dto.montoLimpieza,
        montoTarjetas:         dto.montoTarjetas,
        extrasJson:            dto.extrasJson ?? null,
        total,
        observaciones:         dto.observaciones ?? null,
      });
      return this.cobroPartidoRepo.findOne({ where: { id: existente.id } }) as Promise<CobroPartido>;
    }

    const nuevo = this.cobroPartidoRepo.create({
      ...dto,
      total,
      estado: 'pendiente',
      creadoPorId: usuario.sub ?? usuario.id,
    });
    return this.cobroPartidoRepo.save(nuevo);
  }

  /**
   * Lista cobros de partido con filtros opcionales.
   */
  async listarCobrosPartido(filtros: {
    ligaId?: number;
    campeonatoId?: number;
    equipoId?: number;
    partidoId?: number;
    jornada?: number;
    estado?: string;
  }): Promise<CobroPartido[]> {
    const query = this.cobroPartidoRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.equipo', 'equipo')
      .leftJoinAndSelect('cp.campeonato', 'campeonato')
      .leftJoinAndSelect('cp.partido', 'partido');

    if (filtros.ligaId)       query.andWhere('cp.liga_id = :ligaId',             { ligaId: filtros.ligaId });
    if (filtros.campeonatoId) query.andWhere('cp.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    if (filtros.equipoId)     query.andWhere('cp.equipo_id = :equipoId',         { equipoId: filtros.equipoId });
    if (filtros.partidoId)    query.andWhere('cp.partido_id = :partidoId',       { partidoId: filtros.partidoId });
    if (filtros.jornada)      query.andWhere('cp.jornada = :jornada',            { jornada: filtros.jornada });
    if (filtros.estado)       query.andWhere('cp.estado = :estado',              { estado: filtros.estado });

    return query.orderBy('cp.creado_en', 'DESC').getMany();
  }

  /**
   * Obtiene los cobros guardados para un partido específico (local y visitante).
   */
  async cobrosDePartido(partidoId: number): Promise<CobroPartido[]> {
    return this.cobroPartidoRepo.find({
      where: { partidoId },
      relations: ['equipo'],
    });
  }

  /**
   * Marca un cobro de partido como pagado.
   */
  async pagarCobroPartido(
    id: number,
    dto: PagarCobroPartidoDto,
    usuario: any,
  ): Promise<CobroPartido> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para registrar pagos.');
    }

    const cobro = await this.cobroPartidoRepo.findOne({ where: { id } });
    if (!cobro) throw new NotFoundException('Cobro no encontrado.');
    if (cobro.estado === 'pagado') throw new BadRequestException('Este cobro ya fue marcado como pagado.');

    const hoy = new Date().toISOString().split('T')[0];
    await this.cobroPartidoRepo.update(id, {
      estado: 'pagado',
      fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(hoy),
      observaciones: dto.observaciones ?? cobro.observaciones,
    });

    // Al cobrar el partido, abonar una cuota en cada derrama por_vocalia activa del equipo.
    // Fire-and-forget: si falla no interrumpe el pago del cobro.
    this.derramasService
      .abonarTodasVocalia(cobro.campeonatoId, cobro.equipoId, cobro.ligaId)
      .catch(() => {});

    return this.cobroPartidoRepo.findOne({ where: { id } }) as Promise<CobroPartido>;
  }

  /**
   * Registra que un equipo no se presentó al partido.
   *
   * Flujo:
   * 1. Marca el cobro como 'no_presentado'.
   * 2. Crea automáticamente una derrama 'inmediato' por el total del cobro,
   *    asignando al equipo en modo 'por_vocalia' para que la deuda se vaya
   *    descontando en partidos posteriores, o el tesorero puede cobrarla
   *    directamente desde /tesoreria/derramas.
   */
  async registrarNoPresentado(
    id: number,
    observaciones: string | undefined,
    usuario: any,
  ): Promise<CobroPartido> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para registrar esta acción.');
    }

    const cobro = await this.cobroPartidoRepo.findOne({ where: { id } });
    if (!cobro) throw new NotFoundException('Cobro no encontrado.');
    if (cobro.estado !== 'pendiente') {
      throw new BadRequestException(`El cobro ya tiene estado '${cobro.estado}' y no puede modificarse.`);
    }

    // 1. Actualizar estado del cobro
    await this.cobroPartidoRepo.update(id, {
      estado: 'no_presentado',
      observaciones: observaciones ?? cobro.observaciones,
    });

    // 2. Crear derrama automática por el monto adeudado (fire-and-forget).
    //    La derrama se crea en modo 'por_vocalia' para que se descuente partido a partido.
    const total = Number(cobro.total);
    if (total > 0) {
      this.derramasService
        .crearDerramaAutomatica({
          campeonatoId:  cobro.campeonatoId,
          ligaId:        cobro.ligaId,
          equipoId:      cobro.equipoId,
          montoUnitario: total,
          descripcion:   `No presentación partido #${cobro.partidoId} – jornada ${cobro.jornada ?? '?'}`,
          creadoPorId:   usuario.sub ?? usuario.id,
        })
        .catch(() => {});
    }

    return this.cobroPartidoRepo.findOne({ where: { id } }) as Promise<CobroPartido>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOVIMIENTO TESORERIA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un movimiento manual de ingreso o egreso.
   */
  async crearMovimiento(
    dto: CreateMovimientoTesoreriaDto,
    usuario: any,
  ): Promise<MovimientoTesoreria> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para registrar movimientos.');
    }

    // Los egresos siempre se crean como pagados
    const estadoFinal = dto.tipo === 'egreso' ? 'pagado' : (dto.estado ?? 'pendiente');

    const movimiento = this.movimientoRepo.create({
      ...dto,
      estado: estadoFinal,
      origenAutomatico: false,
      creadoPorId: usuario.sub ?? usuario.id,
    });
    return this.movimientoRepo.save(movimiento);
  }

  /**
   * Método interno: genera automáticamente el cobro de inscripción
   * cuando un equipo es aprobado en un campeonato.
   * Llamado desde InscripcionesService.
   */
  async generarCobroInscripcion(
    ligaId: number,
    campeonatoId: number,
    equipoId: number,
    monto: number,
    descripcion: string,
    creadoPorId: number,
  ): Promise<MovimientoTesoreria | null> {
    if (monto <= 0) return null; // Si la cuota es 0, no se genera cobro

    // Verificar que no exista ya un cobro de inscripción para este equipo en este campeonato
    const existe = await this.movimientoRepo.findOne({
      where: {
        ligaId,
        campeonatoId,
        equipoId,
        categoria: 'inscripcion',
        origenAutomatico: true,
      },
    });
    if (existe) return existe;

    const movimiento = this.movimientoRepo.create({
      ligaId,
      campeonatoId,
      equipoId,
      tipo: 'ingreso',
      categoria: 'inscripcion',
      descripcion,
      monto,
      estado: 'pendiente',
      origenAutomatico: true,
      creadoPorId,
    });
    return this.movimientoRepo.save(movimiento);
  }

  /**
   * Lista movimientos con filtros opcionales.
   */
  async listarMovimientos(filtros: {
    ligaId?: number;
    campeonatoId?: number;
    equipoId?: number;
    tipo?: string;
    categoria?: string;
    estado?: string;
  }): Promise<MovimientoTesoreria[]> {
    const query = this.movimientoRepo
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.equipo', 'equipo')
      .leftJoinAndSelect('mt.campeonato', 'campeonato')
      .leftJoinAndSelect('mt.liga', 'liga');

    if (filtros.ligaId)       query.andWhere('mt.liga_id = :ligaId',             { ligaId: filtros.ligaId });
    if (filtros.campeonatoId) query.andWhere('mt.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    if (filtros.equipoId)     query.andWhere('mt.equipo_id = :equipoId',         { equipoId: filtros.equipoId });
    if (filtros.tipo)         query.andWhere('mt.tipo = :tipo',                  { tipo: filtros.tipo });
    if (filtros.categoria)    query.andWhere('mt.categoria = :categoria',        { categoria: filtros.categoria });
    if (filtros.estado)       query.andWhere('mt.estado = :estado',              { estado: filtros.estado });

    return query.orderBy('mt.creado_en', 'DESC').getMany();
  }

  /**
   * Actualiza el estado de un movimiento (pagar, anular).
   */
  async actualizarMovimiento(
    id: number,
    dto: UpdateMovimientoTesoreriaDto,
    usuario: any,
  ): Promise<MovimientoTesoreria> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para modificar movimientos.');
    }

    const movimiento = await this.movimientoRepo.findOne({ where: { id } });
    if (!movimiento) throw new NotFoundException('Movimiento no encontrado.');
    if (movimiento.estado === 'anulado') {
      throw new BadRequestException('Este movimiento ya fue anulado y no puede modificarse.');
    }
    // Los registros generados automáticamente por el sistema (inscripciones, traslados, etc.)
    // solo pueden ser anulados por el rol master para evitar inconsistencias contables.
    if (dto.estado === 'anulado' && movimiento.origenAutomatico && usuario.role !== 'master') {
      throw new ForbiddenException(
        'Los registros generados automáticamente por el sistema solo pueden ser anulados por un administrador master.',
      );
    }

    const cambios: Partial<MovimientoTesoreria> = {};
    if (dto.estado)       cambios.estado       = dto.estado;
    if (dto.descripcion)  cambios.descripcion  = dto.descripcion;
    if (dto.comprobante)  cambios.comprobante  = dto.comprobante;
    if (dto.fechaPago)    cambios.fechaPago    = new Date(dto.fechaPago);
    if (dto.estado === 'pagado' && !dto.fechaPago) {
      cambios.fechaPago = new Date();
    }

    await this.movimientoRepo.update(id, cambios);
    return this.movimientoRepo.findOne({ where: { id } }) as Promise<MovimientoTesoreria>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESUMEN DE CAJA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera el resumen consolidado de caja para un campeonato.
   * Suma cobros de partido (ingresos automáticos) + movimientos (manuales).
   */
  async resumenCaja(campeonatoId: number, ligaId: number): Promise<{
    totalCobrosPartidoPagados: number;
    totalCobrosPartidoPendientes: number;
    totalIngresosManualesPagados: number;
    totalIngresosManualesPendientes: number;
    totalEgresos: number;
    saldo: number;
    resumenPorEquipo: Array<{
      equipo: string;
      cobrosPartido: number;
      ingresosManuales: number;
      pendienteTotal: number;
    }>;
  }> {
    // ── Cobros de partido (excluir no_presentado: no son ingresos reales) ──
    const cobrosPartido = await this.cobroPartidoRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.equipo', 'equipo')
      .where('cp.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere("cp.estado != 'no_presentado'")
      .getMany();

    const totalCobrosPartidoPagados    = cobrosPartido.filter(c => c.estado === 'pagado').reduce((s, c) => s + Number(c.total), 0);
    const totalCobrosPartidoPendientes = cobrosPartido.filter(c => c.estado === 'pendiente').reduce((s, c) => s + Number(c.total), 0);

    // ── Movimientos generales (no anulados) ──────────────────────────────
    const movimientos = await this.movimientoRepo.find({
      where: { campeonatoId },
      relations: ['equipo'],
    });
    const movimientosActivos = movimientos.filter(m => m.estado !== 'anulado');

    const totalIngresosManualesPagados    = movimientosActivos.filter(m => m.tipo === 'ingreso' && m.estado === 'pagado').reduce((s, m) => s + Number(m.monto), 0);
    const totalIngresosManualesPendientes = movimientosActivos.filter(m => m.tipo === 'ingreso' && m.estado === 'pendiente').reduce((s, m) => s + Number(m.monto), 0);
    const totalEgresos                    = movimientosActivos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0);

    const totalIngresosReales = totalCobrosPartidoPagados + totalIngresosManualesPagados;
    const saldo = Number((totalIngresosReales - totalEgresos).toFixed(2));

    // ── Resumen por equipo ───────────────────────────────────────────────
    const equipoMap = new Map<number, { equipo: string; cobrosPartido: number; ingresosManuales: number; pendienteTotal: number }>();

    for (const c of cobrosPartido) {
      const key = c.equipoId;
      if (!equipoMap.has(key)) {
        equipoMap.set(key, { equipo: c.equipo?.nombre ?? `Equipo #${key}`, cobrosPartido: 0, ingresosManuales: 0, pendienteTotal: 0 });
      }
      const entry = equipoMap.get(key)!;
      if (c.estado === 'pagado')    entry.cobrosPartido += Number(c.total);
      if (c.estado === 'pendiente') entry.pendienteTotal += Number(c.total);
    }

    for (const m of movimientosActivos.filter(mv => mv.tipo === 'ingreso' && mv.equipoId)) {
      const key = m.equipoId!;
      if (!equipoMap.has(key)) {
        equipoMap.set(key, { equipo: m.equipo?.nombre ?? `Equipo #${key}`, cobrosPartido: 0, ingresosManuales: 0, pendienteTotal: 0 });
      }
      const entry = equipoMap.get(key)!;
      if (m.estado === 'pagado')    entry.ingresosManuales += Number(m.monto);
      if (m.estado === 'pendiente') entry.pendienteTotal   += Number(m.monto);
    }

    return {
      totalCobrosPartidoPagados:         Number(totalCobrosPartidoPagados.toFixed(2)),
      totalCobrosPartidoPendientes:      Number(totalCobrosPartidoPendientes.toFixed(2)),
      totalIngresosManualesPagados:      Number(totalIngresosManualesPagados.toFixed(2)),
      totalIngresosManualesPendientes:   Number(totalIngresosManualesPendientes.toFixed(2)),
      totalEgresos:                      Number(totalEgresos.toFixed(2)),
      saldo,
      resumenPorEquipo: Array.from(equipoMap.values()),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIBRO DE CAJA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todas las transacciones (cobros de partido + movimientos manuales)
   * unificadas y ordenadas por fecha descendente, para el libro de caja.
   */
  async getLibroCaja(filtros: {
    ligaId?: number;
    campeonatoId?: number;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<Array<{
    id: number;
    fecha: Date;
    concepto: string;
    equipo: string | null;
    tipo: 'ingreso' | 'egreso';
    origen: 'vocalia' | 'manual';
    monto: number;
    estado: string;
    referencia: string;
  }>> {
    // ── Cobros de partido ────────────────────────────────────────────────
    const qCobros = this.cobroPartidoRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.equipo', 'equipo')
      // Excluir cobros de equipos que no se presentaron: no son ingresos reales
      .andWhere("cp.estado != 'no_presentado'");
    if (filtros.ligaId)       qCobros.andWhere('cp.liga_id = :ligaId',             { ligaId: filtros.ligaId });
    if (filtros.campeonatoId) qCobros.andWhere('cp.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    if (filtros.fechaDesde)   qCobros.andWhere('cp.creado_en >= :fechaDesde',      { fechaDesde: filtros.fechaDesde });
    if (filtros.fechaHasta)   qCobros.andWhere('cp.creado_en <= :fechaHasta',      { fechaHasta: filtros.fechaHasta });
    const cobros = await qCobros.getMany();

    // ── Movimientos manuales ─────────────────────────────────────────────
    const qMovs = this.movimientoRepo
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.equipo', 'equipo');
    if (filtros.ligaId)       qMovs.andWhere('mt.liga_id = :ligaId',             { ligaId: filtros.ligaId });
    if (filtros.campeonatoId) qMovs.andWhere('mt.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    if (filtros.fechaDesde)   qMovs.andWhere('mt.creado_en >= :fechaDesde',      { fechaDesde: filtros.fechaDesde });
    if (filtros.fechaHasta)   qMovs.andWhere('mt.creado_en <= :fechaHasta',      { fechaHasta: filtros.fechaHasta });
    const movimientos = await qMovs.getMany();

    // ── Unificar y ordenar ───────────────────────────────────────────────
    const entradasCobros = cobros.map((c) => ({
      id:         c.id,
      fecha:      c.fechaPago ?? c.creadoEn,
      concepto:   `Cobro Partido${c.jornada ? ' J' + c.jornada : ''}`,
      equipo:     c.equipo?.nombre ?? null,
      tipo:       'ingreso' as const,
      origen:     'vocalia' as const,
      monto:      Number(c.total),
      estado:     c.estado ?? 'pendiente',
      referencia: `Partido #${c.partidoId}`,
    }));

    const entradasMovs = movimientos.map((m) => ({
      id:         m.id,
      fecha:      m.fechaPago ?? m.creadoEn,
      concepto:   m.descripcion ?? m.categoria,
      equipo:     m.equipo?.nombre ?? null,
      tipo:       m.tipo as 'ingreso' | 'egreso',
      origen:     'manual' as const,
      monto:      Number(m.monto),
      estado:     m.estado,
      referencia: `Movimiento #${m.id}`,
    }));

    return [...entradasCobros, ...entradasMovs].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRASLADO DE SALDO ENTRE CAMPEONATOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Traslada el saldo neto de un campeonato finalizado al siguiente campeonato.
   *
   * Reglas:
   *  1. El campeonato origen debe estar en estado 'finalizado'
   *  2. El saldo neto debe ser mayor a 0
   *  3. No puede haberse trasladado ya (se verifica buscando un movimiento previo)
   *
   * Crea un MovimientoTesoreria de tipo 'ingreso' / categoria 'otro' / estado 'pagado'
   * en el campeonato destino, con la descripción 'Saldo trasladado del campeonato X'.
   */
  async trasladarSaldo(
    dto: TrasladarSaldoDto,
    usuario: any,
  ): Promise<{ mensaje: string; monto: number; movimientoId: number }> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para trasladar el saldo.');
    }

    // 1. Validar que el campeonato origen existe y está finalizado
    const origen = await this.campeonatoRepo.findOne({
      where: { id: dto.campeonatoOrigenId },
    });
    if (!origen) throw new NotFoundException('Campeonato origen no encontrado.');
    if (origen.estado !== 'finalizado') {
      throw new BadRequestException(
        'Solo se puede trasladar el saldo de un campeonato finalizado.',
      );
    }

    // 2. Validar que el campeonato destino existe
    const destino = await this.campeonatoRepo.findOne({
      where: { id: dto.campeonatoDestinoId },
    });
    if (!destino) throw new NotFoundException('Campeonato destino no encontrado.');
    if (dto.campeonatoOrigenId === dto.campeonatoDestinoId) {
      throw new BadRequestException('El campeonato origen y destino no pueden ser el mismo.');
    }

    // 3. Calcular el saldo real del campeonato origen
    const resumen = await this.resumenCaja(dto.campeonatoOrigenId, origen.ligaId);
    if (resumen.saldo <= 0) {
      throw new BadRequestException(
        `El campeonato origen no tiene saldo positivo para trasladar (saldo: $${resumen.saldo}).`,
      );
    }

    // 4. Verificar que no se haya trasladado ya este saldo
    const descripcionEsperada = `Saldo trasladado del campeonato: ${origen.nombre}`;
    const yaExiste = await this.movimientoRepo.findOne({
      where: {
        campeonatoId: dto.campeonatoDestinoId,
        descripcion: descripcionEsperada,
        origenAutomatico: true,
      },
    });
    if (yaExiste) {
      throw new BadRequestException(
        'El saldo de este campeonato ya fue trasladado anteriormente.',
      );
    }

    // 5. Crear el movimiento en el campeonato destino
    const movimiento = this.movimientoRepo.create({
      ligaId:           origen.ligaId,
      campeonatoId:     dto.campeonatoDestinoId,
      tipo:             'ingreso',
      categoria:        'otro',
      descripcion:      descripcionEsperada,
      monto:            resumen.saldo,
      estado:           'pagado',
      origenAutomatico: true,
      creadoPorId:      usuario.sub ?? usuario.id,
    });
    const guardado = await this.movimientoRepo.save(movimiento);

    return {
      mensaje: `Saldo de $${resumen.saldo} trasladado correctamente al campeonato "${destino.nombre}".`,
      monto:   resumen.saldo,
      movimientoId: guardado.id,
    };
  }
}
