import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigVocalia } from './entities/config-vocalia.entity';
import { CobroPartido } from './entities/cobro-partido.entity';
import { MovimientoTesoreria } from './entities/movimiento-tesoreria.entity';
import { InicioOperativoTesoreria } from './entities/inicio-operativo-tesoreria.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { DerramaEquipo } from '../derramas/entities/derrama-equipo.entity';
import { GarantiaEquipo } from '../garantias/entities/garantia-equipo.entity';
import { GuardarConfigVocaliaDto } from './dto/guardar-config-vocalia.dto';
import { CreateCobroPartidoDto } from './dto/create-cobro-partido.dto';
import { PagarCobroPartidoDto } from './dto/pagar-cobro-partido.dto';
import { CreateMovimientoTesoreriaDto } from './dto/create-movimiento-tesoreria.dto';
import { UpdateMovimientoTesoreriaDto } from './dto/update-movimiento-tesoreria.dto';
import { TrasladarSaldoDto } from './dto/trasladar-saldo.dto';
import { IniciarOperacionTesoreriaDto } from './dto/iniciar-operacion-tesoreria.dto';
import { DerramasService } from '../derramas/derramas.service';
import { RecibosTesoreriaService } from '../recibos-tesoreria/recibos-tesoreria.service';
import { CierreCajaTesoreria } from './entities/cierre-caja-tesoreria.entity';
import { CreateCierreCajaTesoreriaDto } from './dto/create-cierre-caja-tesoreria.dto';
import { CierreCajaControlService } from './cierre-caja-control.service';

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
    @InjectRepository(InicioOperativoTesoreria)
    private inicioOperativoRepo: Repository<InicioOperativoTesoreria>,
    @InjectRepository(Campeonato)
    private campeonatoRepo: Repository<Campeonato>,
    @InjectRepository(DerramaEquipo)
    private derramaEquipoRepo: Repository<DerramaEquipo>,
    @InjectRepository(GarantiaEquipo)
    private garantiaRepo: Repository<GarantiaEquipo>,
    @InjectRepository(CierreCajaTesoreria)
    private cierreCajaRepo: Repository<CierreCajaTesoreria>,
    private derramasService: DerramasService,
    private dataSource: DataSource,
    private recibosService: RecibosTesoreriaService,
    private cierreControl: CierreCajaControlService,
  ) {}

  private validarAccesoLiga(ligaId: number, usuario: any): void {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario?.role)) {
      throw new ForbiddenException('No tiene permisos para gestionar tesorería.');
    }
    if (usuario.role !== 'master' && Number(usuario.ligaId) !== Number(ligaId)) {
      throw new ForbiddenException('No tiene permisos para gestionar la tesorería de esta liga.');
    }
  }

  private async validarCampeonatoDeLiga(campeonatoId: number, ligaId: number): Promise<Campeonato> {
    const campeonato = await this.campeonatoRepo.findOne({ where: { id: campeonatoId } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    if (Number(campeonato.ligaId) !== Number(ligaId)) {
      throw new BadRequestException('El campeonato no pertenece a la liga indicada.');
    }
    return campeonato;
  }

  private aplicarLigaDelUsuario<T extends { ligaId?: number }>(filtros: T, usuario: any): T {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario?.role)) {
      throw new ForbiddenException('No tiene permisos para consultar tesorería.');
    }
    if (usuario.role === 'master') return filtros;

    const ligaUsuario = Number(usuario.ligaId);
    if (!ligaUsuario) throw new ForbiddenException('El usuario no tiene una liga asignada.');
    if (filtros.ligaId && Number(filtros.ligaId) !== ligaUsuario) {
      throw new ForbiddenException('No tiene permisos para consultar otra liga.');
    }
    return { ...filtros, ligaId: ligaUsuario };
  }

  private async obtenerInicioOperativo(campeonatoId: number): Promise<InicioOperativoTesoreria | null> {
    return this.inicioOperativoRepo.findOne({ where: { campeonatoId } });
  }

  private esRegistroHistorico(fechaCreacion: Date, inicio: InicioOperativoTesoreria | null): boolean {
    if (!inicio) return false;
    return fechaCreacion.getTime() < new Date(`${inicio.fechaInicio}T00:00:00`).getTime();
  }

  /**
   * Consulta la configuración de inicio de caja. Sin esta configuración el
   * campeonato conserva su historial, pero todavía no opera en Tesorería.
   */
  async consultarInicioOperativo(
    campeonatoId: number,
    ligaId: number,
    usuario: any,
  ): Promise<InicioOperativoTesoreria | null> {
    this.validarAccesoLiga(ligaId, usuario);
    await this.validarCampeonatoDeLiga(campeonatoId, ligaId);
    return this.obtenerInicioOperativo(campeonatoId);
  }

  /**
   * Activa una única vez el control de caja de un campeonato. Los cobros y
   * movimientos creados antes de la fecha indicada quedan como historial.
   */
  async iniciarOperacion(
    dto: IniciarOperacionTesoreriaDto,
    usuario: any,
  ): Promise<InicioOperativoTesoreria> {
    this.validarAccesoLiga(dto.ligaId, usuario);
    await this.validarCampeonatoDeLiga(dto.campeonatoId, dto.ligaId);

    const existente = await this.obtenerInicioOperativo(dto.campeonatoId);
    if (existente) {
      throw new BadRequestException(
        'Este campeonato ya tiene un inicio operativo configurado. No puede reemplazarse para proteger la caja registrada.',
      );
    }

    const origenSaldo = dto.origenSaldo ?? (Number(dto.saldoInicial) > 0 ? 'manual' : 'caja_nueva');
    let campeonatoOrigenId: number | null = null;
    let trasladoPendiente: { monto: number; descripcion: string } | null = null;

    if (origenSaldo === 'caja_nueva' && Number(dto.saldoInicial) !== 0) {
      throw new BadRequestException('Una caja nueva debe iniciar con saldo $0,00.');
    }

    if (origenSaldo === 'traslado') {
      if (Number(dto.saldoInicial) !== 0) {
        throw new BadRequestException('El saldo inicial debe ser $0,00 cuando proviene de un traslado.');
      }
      if (!dto.campeonatoOrigenId || dto.campeonatoOrigenId === dto.campeonatoId) {
        throw new BadRequestException('Seleccione un campeonato anterior distinto como origen del traslado.');
      }

      const origen = await this.campeonatoRepo.findOne({ where: { id: dto.campeonatoOrigenId } });
      if (!origen) throw new NotFoundException('Campeonato origen no encontrado.');
      if (Number(origen.ligaId) !== Number(dto.ligaId)) {
        throw new BadRequestException('El campeonato origen debe pertenecer a la misma liga.');
      }
      if (origen.estado !== 'finalizado') {
        throw new BadRequestException('Solo se puede recibir saldo de un campeonato finalizado.');
      }

      const cierreFinal = await this.cierreControl.obtenerCierreDefinitivo(origen.id);
      if (!cierreFinal) {
        throw new BadRequestException(
          'El campeonato origen debe tener un cierre definitivo de caja antes de trasladar su saldo.',
        );
      }
      const saldoFinalContado = Number(cierreFinal.saldoContado);
      if (saldoFinalContado <= 0) {
        throw new BadRequestException('El cierre definitivo no tiene saldo contado positivo para trasladar.');
      }

      const descripcion = `Saldo trasladado del campeonato: ${origen.nombre}`;
      const trasladoExistente = await this.movimientoRepo.findOne({
        where: { ligaId: dto.ligaId, descripcion, origenAutomatico: true },
      });
      if (trasladoExistente) {
        throw new BadRequestException('El saldo de este campeonato ya fue trasladado anteriormente.');
      }

      campeonatoOrigenId = origen.id;
      trasladoPendiente = { monto: saldoFinalContado, descripcion };
    }

    const inicio = this.inicioOperativoRepo.create({
      ligaId: dto.ligaId,
      campeonatoId: dto.campeonatoId,
      fechaInicio: dto.fechaInicio,
      saldoInicial: origenSaldo === 'traslado' ? 0 : Number(dto.saldoInicial),
      origenSaldo,
      campeonatoOrigenId,
      creadoPorId: usuario.sub ?? usuario.id,
    });
    const inicioGuardado = await this.inicioOperativoRepo.save(inicio);

    if (trasladoPendiente) {
      const movimiento = this.movimientoRepo.create({
        ligaId: dto.ligaId,
        campeonatoId: dto.campeonatoId,
        tipo: 'ingreso',
        categoria: 'traslado_saldo',
        descripcion: trasladoPendiente.descripcion,
        monto: trasladoPendiente.monto,
        estado: 'pagado',
        fechaPago: new Date(),
        origenAutomatico: true,
        creadoPorId: usuario.sub ?? usuario.id,
      });
      await this.movimientoRepo.save(movimiento);
    }

    return inicioGuardado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG VOCALIA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene la configuración de valores del acta para una liga.
   * Si la liga no tiene configuración guardada, devuelve los valores por defecto.
   */
  async obtenerConfigVocalia(ligaId: number, usuario: any): Promise<ConfigVocalia[]> {
    this.validarAccesoLiga(ligaId, usuario);
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
    this.validarAccesoLiga(ligaId, usuario);
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

    this.validarAccesoLiga(dto.ligaId, usuario);
    await this.validarCampeonatoDeLiga(dto.campeonatoId, dto.ligaId);
    await this.cierreControl.validarCampeonatoAbierto(dto.campeonatoId);

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
    incluirHistorial?: boolean;
  }, usuario: any): Promise<Array<CobroPartido & { esHistorico?: boolean }>> {
    filtros = this.aplicarLigaDelUsuario(filtros, usuario);
    const iniciosOperativos = filtros.ligaId
      ? await this.inicioOperativoRepo.find({ where: { ligaId: filtros.ligaId } })
      : [];
    const inicioPorCampeonato = new Map(iniciosOperativos.map((inicio) => [inicio.campeonatoId, inicio]));
    const inicioOperativo = filtros.campeonatoId
      ? inicioPorCampeonato.get(filtros.campeonatoId) ?? null
      : null;
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
    if (inicioOperativo && !filtros.incluirHistorial) {
      query.andWhere('cp.creado_en >= :fechaInicio', { fechaInicio: inicioOperativo.fechaInicio });
    } else if (!filtros.campeonatoId && !filtros.incluirHistorial) {
      query.andWhere(`NOT EXISTS (
        SELECT 1 FROM inicio_operativo_tesoreria iot
        WHERE iot.campeonato_id = cp.campeonato_id
          AND cp.creado_en < iot.fecha_inicio
      )`);
    }

    const cobros = await query.orderBy('cp.creado_en', 'DESC').getMany();
    return cobros.map((cobro) => ({
      ...cobro,
      esHistorico: this.esRegistroHistorico(
        cobro.creadoEn,
        inicioPorCampeonato.get(cobro.campeonatoId) ?? null,
      ),
    }));
  }

  /**
   * Obtiene los cobros guardados para un partido específico (local y visitante).
   */
  async cobrosDePartido(partidoId: number, usuario: any): Promise<CobroPartido[]> {
    const cobros = await this.cobroPartidoRepo.find({
      where: { partidoId },
      relations: ['equipo'],
    });
    for (const cobro of cobros) this.validarAccesoLiga(cobro.ligaId, usuario);
    return cobros;
  }

  /**
   * Marca un cobro de partido como pagado.
   */
  async pagarCobroPartido(
    id: number,
    dto: PagarCobroPartidoDto,
    usuario: any,
  ): Promise<CobroPartido & { recibo: unknown }> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para registrar pagos.');
    }

    const resultado = await this.dataSource.transaction(async (manager) => {
      const cobroRepo = manager.getRepository(CobroPartido);
      await manager.query('SELECT id FROM cobro_partido WHERE id = $1 FOR UPDATE', [id]);
      const cobro = await cobroRepo.findOne({ where: { id } });
      if (!cobro) throw new NotFoundException('Cobro no encontrado.');
      this.validarAccesoLiga(cobro.ligaId, usuario);

      const fechaPago = dto.fechaPago
        ? new Date(`${dto.fechaPago}T00:00:00`)
        : new Date();
      await this.cierreControl.validarFechaOperacion(
        cobro.campeonatoId,
        dto.fechaPago ?? new Date(),
        manager,
      );

      const inicio = await manager.getRepository(InicioOperativoTesoreria).findOne({
        where: { campeonatoId: cobro.campeonatoId },
      });
      if (this.esRegistroHistorico(cobro.creadoEn, inicio)) {
        throw new BadRequestException('Este cobro pertenece al historial anterior al inicio operativo y no puede cobrarse.');
      }
      if (cobro.estado === 'pagado') {
        throw new BadRequestException('Este cobro ya fue marcado como pagado.');
      }

      cobro.estado = 'pagado';
      cobro.fechaPago = fechaPago;
      cobro.observaciones = dto.observaciones ?? cobro.observaciones;
      const actualizado = await cobroRepo.save(cobro);
      const recibo = await this.recibosService.emitir({
        ligaId: cobro.ligaId,
        campeonatoId: cobro.campeonatoId,
        equipoId: cobro.equipoId,
        origen: 'cobro_partido',
        origenId: cobro.id,
        concepto: `Vocalía del partido #${cobro.partidoId}${cobro.jornada ? ` · Jornada ${cobro.jornada}` : ''}`,
        monto: Number(cobro.total),
        fechaPago,
        emitidoPorId: usuario.sub ?? usuario.id,
      }, manager);

      return Object.assign(actualizado, { recibo });
    });

    // Al cobrar el partido, abonar una cuota en cada derrama por_vocalia activa del equipo.
    // Fire-and-forget: si falla no interrumpe el pago del cobro.
    this.derramasService
      .abonarTodasVocalia(resultado.campeonatoId, resultado.equipoId, resultado.ligaId)
      .catch(() => {});

    return resultado;
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
    this.validarAccesoLiga(cobro.ligaId, usuario);
    await this.cierreControl.validarCampeonatoAbierto(cobro.campeonatoId);
    if (this.esRegistroHistorico(cobro.creadoEn, await this.obtenerInicioOperativo(cobro.campeonatoId))) {
      throw new BadRequestException('Este cobro pertenece al historial anterior al inicio operativo y no puede modificarse.');
    }
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
  ): Promise<MovimientoTesoreria & { recibo?: unknown }> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para registrar movimientos.');
    }

    this.validarAccesoLiga(dto.ligaId, usuario);
    if (dto.campeonatoId) {
      await this.validarCampeonatoDeLiga(dto.campeonatoId, dto.ligaId);
    }

    // Los egresos siempre se crean como pagados
    const estadoFinal = dto.tipo === 'egreso' ? 'pagado' : (dto.estado ?? 'pendiente');

    return this.dataSource.transaction(async (manager) => {
      if (dto.campeonatoId) {
        const fechaOperacion = dto.fechaPago ?? new Date();
        if (estadoFinal === 'pagado') {
          await this.cierreControl.validarFechaOperacion(dto.campeonatoId, fechaOperacion, manager);
        } else {
          await this.cierreControl.validarCampeonatoAbierto(dto.campeonatoId, manager);
        }
      }
      const movimientoRepo = manager.getRepository(MovimientoTesoreria);
      const movimiento = movimientoRepo.create({
        ...dto,
        fechaPago: dto.fechaPago ? new Date(`${dto.fechaPago}T00:00:00`) : null,
        fechaVencimiento: dto.fechaVencimiento
          ? new Date(`${dto.fechaVencimiento}T00:00:00`)
          : null,
        estado: estadoFinal,
        origenAutomatico: false,
        creadoPorId: usuario.sub ?? usuario.id,
      });
      if (estadoFinal === 'pagado' && !movimiento.fechaPago) movimiento.fechaPago = new Date();
      const guardado = await movimientoRepo.save(movimiento);

      if (estadoFinal !== 'pagado' || dto.tipo !== 'ingreso' || !dto.equipoId) {
        return guardado;
      }

      const recibo = await this.recibosService.emitir({
        ligaId: dto.ligaId,
        campeonatoId: dto.campeonatoId ?? null,
        equipoId: dto.equipoId,
        origen: 'movimiento',
        origenId: guardado.id,
        movimientoId: guardado.id,
        concepto: dto.descripcion || `Ingreso de tesorería · ${dto.categoria ?? 'otro'}`,
        monto: Number(dto.monto),
        fechaPago: guardado.fechaPago ?? new Date(),
        emitidoPorId: usuario.sub ?? usuario.id,
      }, manager);

      return Object.assign(guardado, { recibo });
    });
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
    await this.cierreControl.validarCampeonatoAbierto(campeonatoId);

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
  }, usuario: any): Promise<Array<MovimientoTesoreria & { recibo?: unknown }>> {
    filtros = this.aplicarLigaDelUsuario(filtros, usuario);
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

    const movimientos = await query.orderBy('mt.creado_en', 'DESC').getMany();
    const recibos = await this.recibosService.listarPorMovimientos(
      movimientos.map((movimiento) => movimiento.id),
    );
    const reciboPorMovimiento = new Map(
      recibos
        .filter((recibo) => recibo.movimientoId)
        .map((recibo) => [recibo.movimientoId, recibo]),
    );

    return movimientos.map((movimiento) => {
      const recibo = reciboPorMovimiento.get(movimiento.id);
      return recibo ? Object.assign(movimiento, { recibo }) : movimiento;
    });
  }

  /**
   * Actualiza el estado de un movimiento (pagar, anular).
   */
  async actualizarMovimiento(
    id: number,
    dto: UpdateMovimientoTesoreriaDto,
    usuario: any,
  ): Promise<MovimientoTesoreria & { recibo?: unknown }> {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario.role)) {
      throw new ForbiddenException('No tiene permisos para modificar movimientos.');
    }

    return this.dataSource.transaction(async (manager) => {
      const movimientoRepo = manager.getRepository(MovimientoTesoreria);
      await manager.query('SELECT id FROM movimiento_tesoreria WHERE id = $1 FOR UPDATE', [id]);
      const movimiento = await movimientoRepo.findOne({ where: { id } });
      if (!movimiento) throw new NotFoundException('Movimiento no encontrado.');
      this.validarAccesoLiga(movimiento.ligaId, usuario);
      if (movimiento.campeonatoId) {
        if (dto.estado === 'pagado') {
          const fechaOperacion = dto.fechaPago ?? new Date();
          await this.cierreControl.validarFechaOperacion(
            movimiento.campeonatoId,
            fechaOperacion,
            manager,
          );
        } else {
          await this.cierreControl.validarCampeonatoAbierto(movimiento.campeonatoId, manager);
        }
      }
      if (movimiento.estado === 'anulado') {
        throw new BadRequestException('Este movimiento ya fue anulado y no puede modificarse.');
      }
      if (dto.estado === 'anulado' && movimiento.estado === 'pagado') {
        throw new BadRequestException(
          'Un movimiento pagado no puede anularse. Debe realizarse un reverso contable controlado.',
        );
      }
      if (dto.estado === 'pagado' && movimiento.estado === 'pagado') {
        throw new BadRequestException('Este movimiento ya fue marcado como pagado.');
      }
      // Los registros generados automáticamente por el sistema (inscripciones, traslados, etc.)
      // solo pueden ser anulados por el rol master para evitar inconsistencias contables.
      if (dto.estado === 'anulado' && movimiento.origenAutomatico && usuario.role !== 'master') {
        throw new ForbiddenException(
          'Los registros generados automáticamente por el sistema solo pueden ser anulados por un administrador master.',
        );
      }

      if (dto.estado) movimiento.estado = dto.estado;
      if (dto.descripcion) movimiento.descripcion = dto.descripcion;
      if (dto.comprobante) movimiento.comprobante = dto.comprobante;
      if (dto.fechaPago) movimiento.fechaPago = new Date(`${dto.fechaPago}T00:00:00`);
      if (dto.estado === 'pagado' && !dto.fechaPago) movimiento.fechaPago = new Date();

      const actualizado = await movimientoRepo.save(movimiento);
      if (dto.estado === 'anulado') {
        await this.recibosService.anularPorMovimiento(movimiento.id, manager);
      }
      if (dto.estado !== 'pagado' || movimiento.tipo !== 'ingreso' || !movimiento.equipoId) {
        return actualizado;
      }

      const recibo = await this.recibosService.emitir({
        ligaId: movimiento.ligaId,
        campeonatoId: movimiento.campeonatoId,
        equipoId: movimiento.equipoId,
        origen: 'movimiento',
        origenId: movimiento.id,
        movimientoId: movimiento.id,
        concepto: movimiento.descripcion || `Ingreso de tesorería · ${movimiento.categoria}`,
        monto: Number(movimiento.monto),
        fechaPago: movimiento.fechaPago ?? new Date(),
        emitidoPorId: usuario.sub ?? usuario.id,
      }, manager);

      return Object.assign(actualizado, { recibo });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUENTA CONSOLIDADA POR EQUIPO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reúne las obligaciones pendientes de los módulos financieros sin copiar
   * datos a una tabla adicional. Los cobros y movimientos anteriores al inicio
   * operativo se excluyen; las derramas arrastradas permanecen porque son una
   * deuda trasladada expresamente y las garantías son obligaciones de la liga.
   */
  async deudasConsolidadas(
    ligaId: number,
    equipoId: number | undefined,
    usuario: any,
  ): Promise<{
    items: any[];
    resumenEquipos: any[];
    totalPendiente: number;
  }> {
    this.validarAccesoLiga(ligaId, usuario);

    const cobrosQuery = this.cobroPartidoRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.equipo', 'equipo')
      .leftJoinAndSelect('cp.campeonato', 'campeonato')
      .where('cp.liga_id = :ligaId', { ligaId })
      .andWhere("cp.estado = 'pendiente'")
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM inicio_operativo_tesoreria iot
        WHERE iot.campeonato_id = cp.campeonato_id
          AND cp.creado_en < iot.fecha_inicio
      )`);

    const movimientosQuery = this.movimientoRepo
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.equipo', 'equipo')
      .leftJoinAndSelect('mt.campeonato', 'campeonato')
      .where('mt.liga_id = :ligaId', { ligaId })
      .andWhere('mt.equipo_id IS NOT NULL')
      .andWhere("mt.tipo = 'ingreso'")
      .andWhere("mt.estado = 'pendiente'")
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM inicio_operativo_tesoreria iot
        WHERE iot.campeonato_id = mt.campeonato_id
          AND mt.creado_en < iot.fecha_inicio
      )`);

    const derramasQuery = this.derramaEquipoRepo
      .createQueryBuilder('de')
      .innerJoinAndSelect('de.derrama', 'derrama')
      .leftJoinAndSelect('derrama.campeonato', 'campeonato')
      .innerJoinAndSelect('de.equipo', 'equipo')
      .leftJoinAndSelect('de.campeonatoOrigen', 'campeonatoOrigen')
      .where('derrama.liga_id = :ligaId', { ligaId })
      .andWhere("de.estado IN ('pendiente', 'parcial', 'arrastrado')")
      .andWhere('de.monto_total > de.monto_abonado');

    const garantiasQuery = this.garantiaRepo
      .createQueryBuilder('garantia')
      .innerJoinAndSelect('garantia.equipo', 'equipo')
      .where('garantia.liga_id = :ligaId', { ligaId })
      .andWhere("garantia.estado = 'pendiente'");

    if (equipoId) {
      cobrosQuery.andWhere('cp.equipo_id = :equipoId', { equipoId });
      movimientosQuery.andWhere('mt.equipo_id = :equipoId', { equipoId });
      derramasQuery.andWhere('de.equipo_id = :equipoId', { equipoId });
      garantiasQuery.andWhere('garantia.equipo_id = :equipoId', { equipoId });
    }

    const [cobros, movimientos, derramasSinDepurar, garantias] = await Promise.all([
      cobrosQuery.getMany(),
      movimientosQuery.getMany(),
      derramasQuery.orderBy('de.id', 'DESC').getMany(),
      garantiasQuery.getMany(),
    ]);

    // Protege el consolidado frente a filas históricas duplicadas anteriores
    // al upsert de derrama_equipo. Se conserva el registro más reciente.
    const derramasPorClave = new Map<string, DerramaEquipo>();
    for (const deuda of derramasSinDepurar) {
      const clave = `${deuda.derramaId}:${deuda.equipoId}`;
      if (!derramasPorClave.has(clave)) derramasPorClave.set(clave, deuda);
    }
    const derramas = [...derramasPorClave.values()];

    const items = [
      ...cobros.map((cobro) => ({
        clave: `cobro_partido-${cobro.id}`,
        origen: 'cobro_partido',
        origenId: cobro.id,
        equipoId: cobro.equipoId,
        equipo: cobro.equipo?.nombre ?? 'Equipo',
        campeonatoId: cobro.campeonatoId,
        campeonato: cobro.campeonato?.nombre ?? 'Sin campeonato',
        concepto: `Vocalía partido #${cobro.partidoId}${cobro.jornada ? ` · Jornada ${cobro.jornada}` : ''}`,
        fecha: cobro.creadoEn,
        montoTotal: Number(cobro.total),
        montoAbonado: 0,
        saldoPendiente: Number(cobro.total),
        estado: cobro.estado,
        modoPago: 'directo',
        accion: 'pagar',
      })),
      ...movimientos.map((movimiento) => ({
        clave: `movimiento-${movimiento.id}`,
        origen: 'movimiento',
        origenId: movimiento.id,
        equipoId: Number(movimiento.equipoId),
        equipo: movimiento.equipo?.nombre ?? 'Equipo',
        campeonatoId: movimiento.campeonatoId,
        campeonato: movimiento.campeonato?.nombre ?? 'General de la liga',
        concepto: movimiento.descripcion || `Movimiento: ${movimiento.categoria}`,
        fecha: movimiento.creadoEn,
        montoTotal: Number(movimiento.monto),
        montoAbonado: 0,
        saldoPendiente: Number(movimiento.monto),
        estado: movimiento.estado,
        modoPago: 'directo',
        accion: 'pagar',
        categoria: movimiento.categoria,
      })),
      ...derramas.map((deuda) => {
        const saldoPendiente = Number(deuda.montoTotal) - Number(deuda.montoAbonado);
        const permitePagoDirecto = deuda.estado === 'arrastrado'
          || (deuda.modoPago === 'inmediato' && deuda.derrama.estado === 'activa');
        return {
          clave: `derrama-${deuda.id}`,
          origen: 'derrama',
          origenId: deuda.id,
          derramaId: deuda.derramaId,
          equipoId: deuda.equipoId,
          equipo: deuda.equipo?.nombre ?? 'Equipo',
          campeonatoId: deuda.campeonatoOrigenId ?? deuda.derrama.campeonatoId,
          campeonato: deuda.campeonatoOrigen?.nombre
            ?? deuda.derrama.campeonato?.nombre
            ?? 'Sin campeonato',
          concepto: deuda.derrama.descripcion,
          fecha: deuda.creadoEn,
          montoTotal: Number(deuda.montoTotal),
          montoAbonado: Number(deuda.montoAbonado),
          saldoPendiente,
          estado: deuda.estado,
          modoPago: deuda.modoPago,
          accion: permitePagoDirecto ? 'pagar' : 'automatico',
        };
      }),
      ...garantias.map((garantia) => ({
        clave: `garantia-${garantia.id}`,
        origen: 'garantia',
        origenId: garantia.id,
        equipoId: garantia.equipoId,
        equipo: garantia.equipo?.nombre ?? 'Equipo',
        campeonatoId: null,
        campeonato: 'General de la liga',
        concepto: 'Garantía del equipo',
        fecha: garantia.creadoEn,
        montoTotal: Number(garantia.monto),
        montoAbonado: 0,
        saldoPendiente: Number(garantia.monto),
        estado: garantia.estado,
        modoPago: 'directo',
        accion: 'pagar',
      })),
    ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const resumenPorEquipo = new Map<number, any>();
    for (const item of items) {
      const actual = resumenPorEquipo.get(item.equipoId) ?? {
        equipoId: item.equipoId,
        equipo: item.equipo,
        cantidadObligaciones: 0,
        cobrosPartido: 0,
        movimientos: 0,
        derramas: 0,
        garantias: 0,
        totalPendiente: 0,
      };
      actual.cantidadObligaciones += 1;
      actual.totalPendiente += item.saldoPendiente;
      if (item.origen === 'cobro_partido') actual.cobrosPartido += item.saldoPendiente;
      if (item.origen === 'movimiento') actual.movimientos += item.saldoPendiente;
      if (item.origen === 'derrama') actual.derramas += item.saldoPendiente;
      if (item.origen === 'garantia') actual.garantias += item.saldoPendiente;
      resumenPorEquipo.set(item.equipoId, actual);
    }

    const resumenEquipos = [...resumenPorEquipo.values()]
      .map((r) => ({
        ...r,
        cobrosPartido: Number(r.cobrosPartido.toFixed(2)),
        movimientos: Number(r.movimientos.toFixed(2)),
        derramas: Number(r.derramas.toFixed(2)),
        garantias: Number(r.garantias.toFixed(2)),
        totalPendiente: Number(r.totalPendiente.toFixed(2)),
      }))
      .sort((a, b) => a.equipo.localeCompare(b.equipo, 'es'));

    return {
      items,
      resumenEquipos,
      totalPendiente: Number(
        items.reduce((total, item) => total + item.saldoPendiente, 0).toFixed(2),
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESUMEN DE CAJA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera el resumen consolidado de caja para un campeonato.
   * Suma cobros de partido (ingresos automáticos) + movimientos (manuales).
   */
  async resumenCaja(campeonatoId: number, ligaId: number, usuario: any): Promise<{
    inicioOperativo: {
      fechaInicio: string;
      saldoInicial: number;
      origenSaldo: 'caja_nueva' | 'manual' | 'traslado';
      campeonatoOrigenId: number | null;
    } | null;
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
    this.validarAccesoLiga(ligaId, usuario);
    await this.validarCampeonatoDeLiga(campeonatoId, ligaId);
    const inicioOperativo = await this.obtenerInicioOperativo(campeonatoId);

    const cobrosPartido = this.cobroPartidoRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.equipo', 'equipo')
      .where('cp.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere("cp.estado != 'no_presentado'");
    if (inicioOperativo) {
      cobrosPartido.andWhere('cp.creado_en >= :fechaInicio', { fechaInicio: inicioOperativo.fechaInicio });
    }
    const cobrosOperativos = await cobrosPartido.getMany();

    const totalCobrosPartidoPagados    = cobrosOperativos.filter(c => c.estado === 'pagado').reduce((s, c) => s + Number(c.total), 0);
    const totalCobrosPartidoPendientes = cobrosOperativos.filter(c => c.estado === 'pendiente').reduce((s, c) => s + Number(c.total), 0);

    // ── Movimientos generales (no anulados) ──────────────────────────────
    const movimientoQuery = this.movimientoRepo
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.equipo', 'equipo')
      .where('mt.campeonato_id = :campeonatoId', { campeonatoId });
    if (inicioOperativo) {
      movimientoQuery.andWhere(
        '(mt.creado_en >= :fechaInicio OR mt.categoria = :categoriaTraslado)',
        { fechaInicio: inicioOperativo.fechaInicio, categoriaTraslado: 'traslado_saldo' },
      );
    }
    const movimientos = await movimientoQuery.getMany();
    const movimientosActivos = movimientos.filter(m => m.estado !== 'anulado');

    const totalIngresosManualesPagados    = movimientosActivos.filter(m => m.tipo === 'ingreso' && m.estado === 'pagado').reduce((s, m) => s + Number(m.monto), 0);
    const totalIngresosManualesPendientes = movimientosActivos.filter(m => m.tipo === 'ingreso' && m.estado === 'pendiente').reduce((s, m) => s + Number(m.monto), 0);
    const totalEgresos                    = movimientosActivos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0);

    const totalIngresosReales = totalCobrosPartidoPagados + totalIngresosManualesPagados;
    const saldoInicial = inicioOperativo ? Number(inicioOperativo.saldoInicial) : 0;
    const saldo = Number((saldoInicial + totalIngresosReales - totalEgresos).toFixed(2));

    // ── Resumen por equipo ───────────────────────────────────────────────
    const equipoMap = new Map<number, { equipo: string; cobrosPartido: number; ingresosManuales: number; pendienteTotal: number }>();

    for (const c of cobrosOperativos) {
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
      inicioOperativo: inicioOperativo
        ? {
            fechaInicio: inicioOperativo.fechaInicio,
            saldoInicial,
            origenSaldo: inicioOperativo.origenSaldo,
            campeonatoOrigenId: inicioOperativo.campeonatoOrigenId,
          }
        : null,
      totalCobrosPartidoPagados:         Number(totalCobrosPartidoPagados.toFixed(2)),
      totalCobrosPartidoPendientes:      Number(totalCobrosPartidoPendientes.toFixed(2)),
      totalIngresosManualesPagados:      Number(totalIngresosManualesPagados.toFixed(2)),
      totalIngresosManualesPendientes:   Number(totalIngresosManualesPendientes.toFixed(2)),
      totalEgresos:                      Number(totalEgresos.toFixed(2)),
      saldo,
      resumenPorEquipo: Array.from(equipoMap.values()).sort((a, b) =>
        a.equipo.localeCompare(b.equipo, 'es'),
      ),
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
  }, usuario: any): Promise<Array<{
    id: number;
    fecha: Date;
    concepto: string;
    equipo: string | null;
    tipo: 'ingreso' | 'egreso';
    origen: 'vocalia' | 'manual' | 'saldo_inicial';
    monto: number;
    estado: string;
    referencia: string;
  }>> {
    // ── Cobros de partido ────────────────────────────────────────────────
    filtros = this.aplicarLigaDelUsuario(filtros, usuario);
    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    const inicioOperativo = filtros.campeonatoId
      ? await this.obtenerInicioOperativo(filtros.campeonatoId)
      : null;

    const qCobros = this.cobroPartidoRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.equipo', 'equipo')
      // Excluir cobros de equipos que no se presentaron: no son ingresos reales
      .andWhere("cp.estado != 'no_presentado'");
    if (filtros.ligaId)       qCobros.andWhere('cp.liga_id = :ligaId',             { ligaId: filtros.ligaId });
    if (filtros.campeonatoId) qCobros.andWhere('cp.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    if (filtros.fechaDesde)   qCobros.andWhere('COALESCE(cp.fecha_pago, cp.creado_en::date) >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    if (filtros.fechaHasta)   qCobros.andWhere('COALESCE(cp.fecha_pago, cp.creado_en::date) <= :fechaHasta', { fechaHasta: filtros.fechaHasta });
    if (inicioOperativo)      qCobros.andWhere('cp.creado_en >= :fechaInicio',     { fechaInicio: inicioOperativo.fechaInicio });
    const cobros = await qCobros.getMany();

    // ── Movimientos manuales ─────────────────────────────────────────────
    const qMovs = this.movimientoRepo
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.equipo', 'equipo');
    if (filtros.ligaId)       qMovs.andWhere('mt.liga_id = :ligaId',             { ligaId: filtros.ligaId });
    if (filtros.campeonatoId) qMovs.andWhere('mt.campeonato_id = :campeonatoId', { campeonatoId: filtros.campeonatoId });
    if (filtros.fechaDesde)   qMovs.andWhere('COALESCE(mt.fecha_pago, mt.creado_en::date) >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    if (filtros.fechaHasta)   qMovs.andWhere('COALESCE(mt.fecha_pago, mt.creado_en::date) <= :fechaHasta', { fechaHasta: filtros.fechaHasta });
    if (inicioOperativo)      qMovs.andWhere(
      '(mt.creado_en >= :fechaInicio OR mt.categoria = :categoriaTraslado)',
      { fechaInicio: inicioOperativo.fechaInicio, categoriaTraslado: 'traslado_saldo' },
    );
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

    const saldoInicialEnRango = inicioOperativo
      && (!filtros.fechaDesde || inicioOperativo.fechaInicio >= filtros.fechaDesde)
      && (!filtros.fechaHasta || inicioOperativo.fechaInicio <= filtros.fechaHasta);
    const entradaSaldoInicial = saldoInicialEnRango
      ? [{
          id:         -inicioOperativo.id,
          fecha:      new Date(`${inicioOperativo.fechaInicio}T00:00:00`),
          concepto:   'Saldo inicial de caja',
          equipo:     null,
          tipo:       'ingreso' as const,
          origen:     'saldo_inicial' as const,
          monto:      Number(inicioOperativo.saldoInicial),
          estado:     'pagado',
          referencia: 'Inicio operativo',
        }]
      : [];

    return [...entradaSaldoInicial, ...entradasCobros, ...entradasMovs].sort(
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
  async listarCierresCaja(
    ligaId: number,
    campeonatoId: number,
    usuario: any,
  ): Promise<CierreCajaTesoreria[]> {
    this.validarAccesoLiga(ligaId, usuario);
    await this.validarCampeonatoDeLiga(campeonatoId, ligaId);
    const cierres = await this.cierreCajaRepo.find({
      where: { ligaId, campeonatoId },
      order: { fechaCorte: 'DESC', id: 'DESC' },
    });
    return cierres.map((cierre) => this.limpiarCierreCaja(cierre));
  }

  async previsualizarCierreCaja(
    ligaId: number,
    campeonatoId: number,
    fechaCorte: string,
    usuario: any,
  ): Promise<{
    fechaDesde: string;
    fechaCorte: string;
    cierreAnteriorId: number | null;
    saldoBase: number;
    totalIngresos: number;
    totalEgresos: number;
    saldoEsperado: number;
  }> {
    this.validarAccesoLiga(ligaId, usuario);
    await this.validarCampeonatoDeLiga(campeonatoId, ligaId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte ?? '')) {
      throw new BadRequestException('La fecha de corte no es valida.');
    }
    const fechaInterpretada = new Date(`${fechaCorte}T00:00:00Z`);
    if (Number.isNaN(fechaInterpretada.getTime()) || fechaInterpretada.toISOString().slice(0, 10) !== fechaCorte) {
      throw new BadRequestException('La fecha de corte no es valida.');
    }
    if (fechaCorte > this.fechaActualEcuador()) {
      throw new BadRequestException('La fecha de corte no puede ser futura.');
    }

    const inicio = await this.obtenerInicioOperativo(campeonatoId);
    if (!inicio) {
      throw new BadRequestException(
        'Primero debe configurar el inicio operativo de Tesoreria para este campeonato.',
      );
    }

    const cierreFinal = await this.cierreCajaRepo.findOne({
      where: { campeonatoId, tipo: 'cierre_definitivo' },
    });
    if (cierreFinal) {
      throw new BadRequestException(
        `Este campeonato ya tiene un cierre definitivo con fecha ${cierreFinal.fechaCorte}.`,
      );
    }

    const ultimo = await this.cierreCajaRepo.findOne({
      where: { campeonatoId },
      order: { fechaCorte: 'DESC', id: 'DESC' },
    });
    const fechaInicio = String(inicio.fechaInicio).slice(0, 10);
    const fechaDesde = ultimo ? this.sumarUnDia(String(ultimo.fechaCorte)) : fechaInicio;
    if (fechaCorte < fechaDesde) {
      throw new BadRequestException(
        ultimo
          ? `La fecha debe ser posterior al ultimo corte (${ultimo.fechaCorte}).`
          : `La fecha no puede ser anterior al inicio operativo (${fechaInicio}).`,
      );
    }

    const entradas = await this.getLibroCaja(
      { ligaId, campeonatoId, fechaDesde, fechaHasta: fechaCorte },
      usuario,
    );
    const saldoBase = ultimo ? Number(ultimo.saldoContado) : Number(inicio.saldoInicial);
    const totalIngresos = entradas
      .filter((item) => item.origen !== 'saldo_inicial' && item.tipo === 'ingreso' && item.estado === 'pagado')
      .reduce((total, item) => total + Number(item.monto), 0);
    const totalEgresos = entradas
      .filter((item) => item.tipo === 'egreso' && item.estado === 'pagado')
      .reduce((total, item) => total + Number(item.monto), 0);

    return {
      fechaDesde,
      fechaCorte,
      cierreAnteriorId: ultimo?.id ?? null,
      saldoBase: this.redondearDinero(saldoBase),
      totalIngresos: this.redondearDinero(totalIngresos),
      totalEgresos: this.redondearDinero(totalEgresos),
      saldoEsperado: this.redondearDinero(saldoBase + totalIngresos - totalEgresos),
    };
  }

  async crearCierreCaja(
    dto: CreateCierreCajaTesoreriaDto,
    usuario: any,
  ): Promise<CierreCajaTesoreria> {
    this.validarAccesoLiga(dto.ligaId, usuario);
    const campeonato = await this.validarCampeonatoDeLiga(dto.campeonatoId, dto.ligaId);
    if (dto.tipo === 'cierre_definitivo' && campeonato.estado !== 'finalizado') {
      throw new BadRequestException(
        'El cierre definitivo solo puede registrarse cuando el campeonato este finalizado.',
      );
    }

    const calculo = await this.previsualizarCierreCaja(
      dto.ligaId,
      dto.campeonatoId,
      dto.fechaCorte,
      usuario,
    );
    const saldoContado = this.redondearDinero(Number(dto.saldoContado));
    const diferencia = this.redondearDinero(saldoContado - calculo.saldoEsperado);
    const observaciones = dto.observaciones?.trim() || null;
    if (Math.abs(diferencia) >= 0.01 && !observaciones) {
      throw new BadRequestException(
        'Debe indicar una observacion cuando existe diferencia entre el saldo esperado y el contado.',
      );
    }

    const id = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [73102, dto.campeonatoId]);
      const repo = manager.getRepository(CierreCajaTesoreria);
      const cierreFinal = await repo.findOne({
        where: { campeonatoId: dto.campeonatoId, tipo: 'cierre_definitivo' },
      });
      if (cierreFinal) {
        throw new BadRequestException('Este campeonato ya tiene un cierre definitivo.');
      }
      const ultimo = await repo.findOne({
        where: { campeonatoId: dto.campeonatoId },
        order: { fechaCorte: 'DESC', id: 'DESC' },
      });
      if ((ultimo?.id ?? null) !== calculo.cierreAnteriorId) {
        throw new BadRequestException(
          'Se registro otro corte mientras realizaba la operacion. Vuelva a calcular los valores.',
        );
      }

      const guardado = await repo.save(repo.create({
        ligaId: dto.ligaId,
        campeonatoId: dto.campeonatoId,
        tipo: dto.tipo,
        fechaDesde: calculo.fechaDesde,
        fechaCorte: calculo.fechaCorte,
        cierreAnteriorId: calculo.cierreAnteriorId,
        saldoBase: calculo.saldoBase,
        totalIngresos: calculo.totalIngresos,
        totalEgresos: calculo.totalEgresos,
        saldoEsperado: calculo.saldoEsperado,
        saldoContado,
        diferencia,
        observaciones,
        creadoPorId: usuario.sub ?? usuario.id,
      }));
      return guardado.id;
    });

    const cierre = await this.cierreCajaRepo.findOneOrFail({ where: { id } });
    return this.limpiarCierreCaja(cierre);
  }

  private sumarUnDia(fecha: string): string {
    const valor = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`);
    valor.setUTCDate(valor.getUTCDate() + 1);
    return valor.toISOString().slice(0, 10);
  }

  private redondearDinero(valor: number): number {
    return Number(Number(valor).toFixed(2));
  }

  private fechaActualEcuador(): string {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  private limpiarCierreCaja(cierre: CierreCajaTesoreria): CierreCajaTesoreria {
    if (cierre.creadoPor) delete (cierre.creadoPor as any).password;
    return cierre;
  }

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
    this.validarAccesoLiga(origen.ligaId, usuario);
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
    if (Number(destino.ligaId) !== Number(origen.ligaId)) {
      throw new BadRequestException('El traslado de saldo solo se permite entre campeonatos de la misma liga.');
    }

    const inicioDestino = await this.obtenerInicioOperativo(destino.id);
    if (
      !inicioDestino ||
      inicioDestino.origenSaldo !== 'traslado' ||
      Number(inicioDestino.campeonatoOrigenId) !== Number(origen.id)
    ) {
      throw new BadRequestException(
        'Para trasladar el saldo, primero inicia el campeonato destino con la opción “Traslado de campeonato anterior”.',
      );
    }

    // 3. El monto trasladable es el efectivo contado en el cierre definitivo.
    const cierreFinal = await this.cierreControl.obtenerCierreDefinitivo(origen.id);
    if (!cierreFinal) {
      throw new BadRequestException(
        'El campeonato origen debe tener un cierre definitivo de caja antes de trasladar su saldo.',
      );
    }
    const saldoFinalContado = Number(cierreFinal.saldoContado);
    if (saldoFinalContado <= 0) {
      throw new BadRequestException(
        `El cierre definitivo no tiene saldo contado positivo para trasladar (saldo: $${saldoFinalContado}).`,
      );
    }
    await this.cierreControl.validarFechaOperacion(destino.id, new Date());

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
      categoria:        'traslado_saldo',
      descripcion:      descripcionEsperada,
      monto:            saldoFinalContado,
      estado:           'pagado',
      fechaPago:        new Date(),
      origenAutomatico: true,
      creadoPorId:      usuario.sub ?? usuario.id,
    });
    const guardado = await this.movimientoRepo.save(movimiento);

    return {
      mensaje: `Saldo contado de $${saldoFinalContado} trasladado correctamente al campeonato "${destino.nombre}".`,
      monto:   saldoFinalContado,
      movimientoId: guardado.id,
    };
  }
}
