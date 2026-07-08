import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Derrama } from './entities/derrama.entity';
import { DerramaEquipo } from './entities/derrama-equipo.entity';
import { MovimientoTesoreria } from '../tesoreria/entities/movimiento-tesoreria.entity';
import { CreateDerramaDto } from './dto/create-derrama.dto';
import {
  AsignarEquiposDto,
  ActualizarDerramaEquipoDto,
  PagarDerramaEquipoDto,
} from './dto/derrama-equipo.dto';

const ROLES_PERMITIDOS = ['master', 'directivo_liga', 'tesoreria'];

@Injectable()
export class DerramasService {
  constructor(
    @InjectRepository(Derrama)
    private derramaRepo: Repository<Derrama>,
    @InjectRepository(DerramaEquipo)
    private derramaEquipoRepo: Repository<DerramaEquipo>,
    @InjectRepository(MovimientoTesoreria)
    private movimientoRepo: Repository<MovimientoTesoreria>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // DERRAMAS — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea una nueva derrama para un campeonato.
   * Solo master, directivo_liga y tesorería pueden crear.
   */
  async crear(dto: CreateDerramaDto, usuario: any): Promise<Derrama> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para crear derramas.');
    }
    const derrama = this.derramaRepo.create({
      ligaId:        dto.ligaId,
      campeonatoId:  dto.campeonatoId,
      descripcion:   dto.descripcion,
      tipo:          dto.tipo,
      montoUnitario: dto.montoUnitario,
      estado:        'activa',
      creadoPor:     usuario.id ?? null,
    });
    return this.derramaRepo.save(derrama);
  }

  /**
   * Lista todas las derramas de un campeonato, incluyendo
   * el resumen de estado de pago por equipo.
   */
  async listarPorCampeonato(campeonatoId: number): Promise<any[]> {
    const derramas = await this.derramaRepo.find({
      where: { campeonatoId },
      order: { creadoEn: 'DESC' },
    });

    // Para cada derrama, cargamos los equipos y calculamos totales
    const resultado = await Promise.all(
      derramas.map(async (d) => {
        const equipos = await this.derramaEquipoRepo.find({
          where: { derramaId: d.id },
        });
        const totalAsignado = equipos.reduce((s, e) => s + Number(e.montoTotal), 0);
        const totalAbonado  = equipos.reduce((s, e) => s + Number(e.montoAbonado), 0);
        return {
          ...d,
          equipos,
          totalAsignado,
          totalAbonado,
          totalPendiente: totalAsignado - totalAbonado,
        };
      }),
    );
    return resultado;
  }

  /**
   * Obtiene el detalle completo de una derrama: datos + estado por equipo.
   */
  async obtenerDetalle(id: number): Promise<any> {
    const derrama = await this.derramaRepo.findOne({ where: { id } });
    if (!derrama) throw new NotFoundException(`Derrama #${id} no encontrada.`);

    const equipos = await this.derramaEquipoRepo.find({
      where: { derramaId: id },
    });
    return { ...derrama, equipos };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASIGNACIÓN DE EQUIPOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Asigna (o actualiza) los equipos que participan en una derrama.
   * Usa upsert: si el equipo ya existía, actualiza cantidad y modo_pago.
   * Recalcula monto_total = cantidad × montoUnitario.
   *
   * Nota didáctica: usamos upsert para que sea idempotente. Si se llama
   * dos veces con los mismos datos, el resultado es el mismo.
   */
  async asignarEquipos(id: number, dto: AsignarEquiposDto, usuario: any): Promise<DerramaEquipo[]> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para asignar equipos a derramas.');
    }
    const derrama = await this.derramaRepo.findOne({ where: { id } });
    if (!derrama) throw new NotFoundException(`Derrama #${id} no encontrada.`);
    if (derrama.estado === 'cerrada') {
      throw new BadRequestException('No se pueden modificar equipos de una derrama cerrada.');
    }

    // Upsert real: buscar el registro existente para reutilizar su PK.
    // Sin el id, TypeORM siempre hace INSERT aunque (derramaId, equipoId) ya exista.
    const registros = await Promise.all(
      dto.equipos.map(async (e) => {
        const montoTotal = Number((e.cantidad * Number(derrama.montoUnitario)).toFixed(2));
        const existente  = await this.derramaEquipoRepo.findOne({
          where: { derramaId: id, equipoId: e.equipoId },
        });
        return this.derramaEquipoRepo.create({
          ...(existente ? { id: existente.id } : {}),
          derramaId:          id,
          equipoId:           e.equipoId,
          campeonatoOrigenId: derrama.campeonatoId,
          cantidad:           e.cantidad,
          montoTotal,
          modoPago:           e.modoPago,
          // Preservar estado y montoAbonado si ya existe; si es nuevo, inicializar
          estado:             existente?.estado ?? 'pendiente',
          montoAbonado:       existente?.montoAbonado ?? 0,
        });
      }),
    );

    return this.derramaEquipoRepo.save(registros);
  }

  /**
   * Actualiza cantidad o modo de pago de un equipo individual.
   * No se permite si el equipo ya pagó.
   */
  async actualizarEquipo(
    derramaId: number,
    equipoId: number,
    dto: ActualizarDerramaEquipoDto,
    usuario: any,
  ): Promise<DerramaEquipo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos.');
    }
    const reg = await this.derramaEquipoRepo.findOne({
      where: { derramaId, equipoId },
    });
    if (!reg) throw new NotFoundException('Asignación no encontrada.');
    if (reg.estado === 'pagado') {
      throw new BadRequestException('No se puede modificar un equipo que ya pagó.');
    }

    if (dto.cantidad !== undefined) {
      const derrama = await this.derramaRepo.findOne({ where: { id: derramaId } });
      reg.cantidad   = dto.cantidad;
      reg.montoTotal = Number((dto.cantidad * Number(derrama!.montoUnitario)).toFixed(2));
    }
    if (dto.modoPago      !== undefined) reg.modoPago      = dto.modoPago;
    if (dto.observaciones !== undefined) reg.observaciones = dto.observaciones;

    return this.derramaEquipoRepo.save(reg);
  }

  /**
   * Divide la deuda pendiente de un equipo en N cuotas de vocalía.
   *
   * Lógica:
   *   saldoPendiente = montoTotal - montoAbonado
   *   nuevaDeudaTotal = saldoPendiente (no se altera el total ya abonado)
   *   montoUnitario (de la Derrama) = saldoPendiente / N  (redondeado a 2 decimales)
   *   cantidad (del DerramaEquipo)  = N
   *   montoTotal (del DerramaEquipo) = montoAbonado + saldoPendiente (sin cambios)
   *
   * Solo se modifica el montoUnitario de la Derrama si la derrama tiene un solo equipo
   * asignado (caso típico de "no presentación"). Si tiene varios equipos, se lanza error
   * para evitar afectar las cuotas de los demás.
   *
   * El tesorero también puede dividir solo el DerramaEquipo sin tocar la Derrama
   * pasando el flag `soloEquipo=true`, en cuyo caso se actualiza el montoUnitario
   * únicamente en el registro del equipo (campo libre observaciones indica la cuota).
   */
  async dividirEnCuotas(
    derramaId: number,
    equipoId:  number,
    numeroCuotas: number,
    usuario: any,
  ): Promise<DerramaEquipo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos.');
    }
    if (numeroCuotas < 2 || numeroCuotas > 50 || !Number.isInteger(numeroCuotas)) {
      throw new BadRequestException('El número de cuotas debe ser un entero entre 2 y 50.');
    }

    const reg = await this.derramaEquipoRepo.findOne({
      where: { derramaId, equipoId },
      relations: ['derrama'],
    });
    if (!reg) throw new NotFoundException('Asignación no encontrada.');
    if (reg.estado === 'pagado') throw new BadRequestException('El equipo ya pagó esta derrama.');
    if (reg.modoPago !== 'por_vocalia') {
      throw new BadRequestException('Solo se pueden dividir en cuotas las derramas en modo "por vocalía".');
    }

    const saldo = Number(reg.montoTotal) - Number(reg.montoAbonado);
    if (saldo <= 0) throw new BadRequestException('No hay saldo pendiente para dividir.');

    // Calcular la cuota: saldo / N, redondeado a 2 decimales
    const cuota = Number((saldo / numeroCuotas).toFixed(2));

    // Actualizar montoUnitario en la Derrama (afecta a cuánto descuenta abonarVocalia por llamada)
    await this.derramaRepo.update(derramaId, { montoUnitario: cuota });

    // Actualizar cantidad del equipo al nuevo número de cuotas
    reg.cantidad = numeroCuotas;
    // montoTotal se mantiene: montoAbonado + saldo (no cambia la deuda total)
    return this.derramaEquipoRepo.save(reg);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un pago directo (inmediato o parcial) sobre la deuda de un equipo.
   * Crea un MovimientoTesoreria tipo 'ingreso' / categoría 'derrama' para que
   * el pago quede reflejado en el libro de caja.
   */
  async registrarPago(
    derramaId: number,
    equipoId: number,
    dto: PagarDerramaEquipoDto,
    usuario: any,
  ): Promise<DerramaEquipo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para registrar pagos.');
    }

    const reg = await this.derramaEquipoRepo.findOne({
      where: { derramaId, equipoId },
      relations: ['derrama'],
    });
    if (!reg) throw new NotFoundException('Asignación no encontrada.');
    if (reg.estado === 'pagado') {
      throw new BadRequestException('Este equipo ya canceló su parte de la derrama.');
    }
    if (reg.modoPago === 'por_vocalia') {
      throw new BadRequestException(
        'Esta derrama se cobra automáticamente mediante las vocalías de partido. No se permiten pagos manuales para evitar duplicados en el libro de caja.',
      );
    }

    const nuevoAbonado = Number(reg.montoAbonado) + Number(dto.monto);
    if (nuevoAbonado > Number(reg.montoTotal)) {
      throw new BadRequestException(
        `El pago ($${dto.monto}) supera el saldo pendiente ($${(Number(reg.montoTotal) - Number(reg.montoAbonado)).toFixed(2)}).`,
      );
    }

    reg.montoAbonado = Number(nuevoAbonado.toFixed(2));
    reg.estado = nuevoAbonado >= Number(reg.montoTotal) ? 'pagado' : 'parcial';
    await this.derramaEquipoRepo.save(reg);

    // Registrar en el libro de caja
    const movimiento = this.movimientoRepo.create({
      ligaId:           reg.derrama.ligaId,
      campeonatoId:     dto.campeonatoId ?? reg.derrama.campeonatoId,
      equipoId,
      tipo:             'ingreso',
      categoria:        'derrama',
      descripcion:      `Derrama: ${reg.derrama.descripcion}`,
      monto:            Number(dto.monto),
      estado:           'pagado',
      origenAutomatico: false,
    });
    await this.movimientoRepo.save(movimiento);

    return reg;
  }

  /**
   * Abona la cuota de vocalía de una derrama desde el acta de partido.
   * Se llama desde TesoreriaService al guardar el cobro del partido.
   * Monto = montoUnitario de la derrama (1 cuota).
   */
  async abonarVocalia(
    derramaId: number,
    equipoId: number,
    campeonatoId: number,
    ligaId: number,
    crearMovimiento = true,
  ): Promise<void> {
    const reg = await this.derramaEquipoRepo.findOne({
      where: { derramaId, equipoId },
      relations: ['derrama'],
    });
    if (!reg || reg.estado === 'pagado' || reg.modoPago !== 'por_vocalia') return;

    const cuota = Number(reg.derrama.montoUnitario);
    const nuevo  = Math.min(Number(reg.montoAbonado) + cuota, Number(reg.montoTotal));
    reg.montoAbonado = Number(nuevo.toFixed(2));
    reg.estado = reg.montoAbonado >= Number(reg.montoTotal) ? 'pagado' : 'parcial';
    await this.derramaEquipoRepo.save(reg);

    // Registrar en caja solo si el pago NO proviene de un cobro de partido.
    // Cuando viene de pagarCobroPartido, el cobro_partido ya figura en el libro de caja
    // con el total completo (incluyendo extras de derramas), evitando duplicar el ingreso.
    if (crearMovimiento) {
      const movimiento = this.movimientoRepo.create({
        ligaId,
        campeonatoId,
        equipoId,
        tipo:             'ingreso',
        categoria:        'derrama',
        descripcion:      `Cuota vocalía — ${reg.derrama.descripcion}`,
        monto:            cuota,
        estado:           'pagado',
        origenAutomatico: true,
      });
      await this.movimientoRepo.save(movimiento);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CIERRE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cierra una derrama y marca como 'arrastrado' todos los equipos con deuda.
   * Se llama manualmente o desde CampeonatosService al finalizar el campeonato.
   */
  async cerrar(id: number, usuario: any): Promise<Derrama> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para cerrar derramas.');
    }
    const derrama = await this.derramaRepo.findOne({ where: { id } });
    if (!derrama) throw new NotFoundException(`Derrama #${id} no encontrada.`);

    derrama.estado = 'cerrada';
    await this.derramaRepo.save(derrama);

    // Marcar como arrastrado los equipos con saldo pendiente
    await this.derramaEquipoRepo
      .createQueryBuilder()
      .update(DerramaEquipo)
      .set({ estado: 'arrastrado' })
      .where('derrama_id = :id AND estado IN (:...estados)', {
        id,
        estados: ['pendiente', 'parcial'],
      })
      .execute();

    return derrama;
  }

  /**
   * Cierra automáticamente todas las derramas activas de un campeonato.
   * Llamado desde CampeonatosService al cambiar estado → 'finalizado'.
   */
  async cerrarPorCampeonato(campeonatoId: number): Promise<void> {
    const activas = await this.derramaRepo.find({
      where: { campeonatoId, estado: 'activa' },
    });
    for (const d of activas) {
      d.estado = 'cerrada';
      await this.derramaRepo.save(d);
      await this.derramaEquipoRepo
        .createQueryBuilder()
        .update(DerramaEquipo)
        .set({ estado: 'arrastrado' })
        .where('derrama_id = :id AND estado IN (:...estados)', {
          id: d.id,
          estados: ['pendiente', 'parcial'],
        })
        .execute();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEUDAS CONSOLIDADAS (usada también por TesoreriaService)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve todas las derramas con saldo pendiente de un equipo en una liga.
   * Incluye derramas de campeonatos anteriores (estado 'arrastrado').
   */
  async deudasDerramaEquipo(ligaId: number, equipoId: number): Promise<any[]> {
    const registros = await this.derramaEquipoRepo
      .createQueryBuilder('de')
      .innerJoinAndSelect('de.derrama', 'd')
      .innerJoinAndSelect('de.equipo', 'eq')
      .leftJoinAndSelect('de.campeonatoOrigen', 'co')
      .where('d.liga_id = :ligaId', { ligaId })
      .andWhere('de.equipo_id = :equipoId', { equipoId })
      .andWhere("de.estado IN ('pendiente','parcial','arrastrado')")
      .orderBy('de.creado_en', 'ASC')
      .getMany();

    return registros.map((r) => ({
      derramaEquipoId:  r.id,
      derramaId:        r.derramaId,
      descripcion:      r.derrama.descripcion,
      campeonatoOrigen: r.campeonatoOrigen?.nombre ?? 'Desconocido',
      montoTotal:       Number(r.montoTotal),
      montoAbonado:     Number(r.montoAbonado),
      saldoPendiente:   Number(r.montoTotal) - Number(r.montoAbonado),
      estado:           r.estado,
      modoPago:         r.modoPago,
    }));
  }

  /**
   * Abona una cuota (montoUnitario) en TODAS las derramas por_vocalia activas de un equipo.
   * Llamado desde TesoreriaService cuando un cobro de partido es marcado como 'pagado'.
   * Así el pago del acta queda reflejado automáticamente en el módulo de Derramas.
   */
  async abonarTodasVocalia(
    campeonatoId: number,
    equipoId: number,
    ligaId: number,
  ): Promise<void> {
    const activas = await this.derramasVocaliaActivas(campeonatoId, equipoId);
    for (const d of activas) {
      // crearMovimiento=false: el cobro de partido ya representa ese ingreso en el libro de caja
      await this.abonarVocalia(d.derramaId, equipoId, campeonatoId, ligaId, false);
    }
  }

  /**
   * Devuelve las derramas 'por_vocalia' pendientes de un equipo en el campeonato activo.
   * Usada en acta-imprimir para pre-rellenar extras automáticamente.
   */
  async derramasVocaliaActivas(campeonatoId: number, equipoId: number): Promise<any[]> {
    const registros = await this.derramaEquipoRepo
      .createQueryBuilder('de')
      .innerJoinAndSelect('de.derrama', 'd')
      .where('d.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('de.equipo_id = :equipoId', { equipoId })
      .andWhere("de.modo_pago = 'por_vocalia'")
      .andWhere("de.estado IN ('pendiente','parcial')")
      .andWhere("d.estado = 'activa'")
      // Ante datos duplicados preexistentes: tomar solo el registro más reciente por derrama
      .orderBy('de.id', 'DESC')
      .getMany();

    // Deduplicar por derramaId: puede haber filas duplicadas si asignarEquipos se llamó
    // antes de este fix y generó más de un registro para el mismo (derramaId, equipoId).
    const vistos = new Set<number>();
    const sinDuplicados = registros.filter((r) => {
      if (vistos.has(r.derramaId)) return false;
      vistos.add(r.derramaId);
      return true;
    });

    return sinDuplicados.map((r) => ({
      derramaEquipoId: r.id,
      derramaId:       r.derramaId,
      descripcion:     r.derrama.descripcion,
      montoUnitario:   Number(r.derrama.montoUnitario),
      saldoPendiente:  Number(r.montoTotal) - Number(r.montoAbonado),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREACIÓN AUTOMÁTICA DESDE SISTEMA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea una derrama automáticamente cuando un equipo no se presenta a un partido.
   *
   * - La derrama tiene tipo 'monetaria', estado 'activa', montoUnitario = total del cobro.
   * - Se asigna el equipo en modo 'por_vocalia' (cantidad=1) para que la deuda se
   *   vaya descontando en sus próximas vocalías, o el tesorero puede registrar
   *   pago directo desde /tesoreria/derramas.
   * - Si ya existe una derrama con la misma descripción para ese equipo/campeonato,
   *   no se duplica (idempotente).
   */
  async crearDerramaAutomatica(params: {
    campeonatoId:  number;
    ligaId:        number;
    equipoId:      number;
    montoUnitario: number;
    descripcion:   string;
    creadoPorId:   number;
  }): Promise<void> {
    // Idempotencia: si ya existe una derrama automática con la misma descripción, no crear otra
    const yaExiste = await this.derramaRepo.findOne({
      where: {
        campeonatoId: params.campeonatoId,
        descripcion:  params.descripcion,
      },
    });
    if (yaExiste) {
      // Solo verificar que el equipo esté asignado
      const equipoExiste = await this.derramaEquipoRepo.findOne({
        where: { derramaId: yaExiste.id, equipoId: params.equipoId },
      });
      if (!equipoExiste) {
        const montoTotal = Number(params.montoUnitario.toFixed(2));
        await this.derramaEquipoRepo.save(
          this.derramaEquipoRepo.create({
            derramaId:          yaExiste.id,
            equipoId:           params.equipoId,
            campeonatoOrigenId: params.campeonatoId,
            cantidad:           1,
            montoTotal,
            modoPago:           'por_vocalia',
            estado:             'pendiente',
            montoAbonado:       0,
          }),
        );
      }
      return;
    }

    // Crear la derrama
    const derrama = await this.derramaRepo.save(
      this.derramaRepo.create({
        ligaId:        params.ligaId,
        campeonatoId:  params.campeonatoId,
        descripcion:   params.descripcion,
        tipo:          'monetaria',
        montoUnitario: params.montoUnitario,
        estado:        'activa',
        creadoPor:     params.creadoPorId,
      }),
    );

    // Asignar el equipo en modo por_vocalia
    const montoTotal = Number(params.montoUnitario.toFixed(2));
    await this.derramaEquipoRepo.save(
      this.derramaEquipoRepo.create({
        derramaId:          derrama.id,
        equipoId:           params.equipoId,
        campeonatoOrigenId: params.campeonatoId,
        cantidad:           1,
        montoTotal,
        modoPago:           'por_vocalia',
        estado:             'pendiente',
        montoAbonado:       0,
      }),
    );
  }
}
