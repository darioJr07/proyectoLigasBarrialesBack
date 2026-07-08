import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GarantiaEquipo } from './entities/garantia-equipo.entity';
import { PrestamoFondo } from './entities/prestamo-fondo.entity';
import { MovimientoTesoreria } from '../tesoreria/entities/movimiento-tesoreria.entity';
import { CreateGarantiaDto } from './dto/create-garantia.dto';
import { AccionGarantiaDto } from './dto/accion-garantia.dto';
import { CreatePrestamoFondoDto } from './dto/create-prestamo-fondo.dto';

const ROLES_PERMITIDOS = ['master', 'directivo_liga', 'tesoreria'];

@Injectable()
export class GarantiasService {
  constructor(
    @InjectRepository(GarantiaEquipo)
    private garantiaRepo: Repository<GarantiaEquipo>,
    @InjectRepository(PrestamoFondo)
    private prestamoRepo: Repository<PrestamoFondo>,
    @InjectRepository(MovimientoTesoreria)
    private movimientoRepo: Repository<MovimientoTesoreria>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // GARANTÍAS INDIVIDUALES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra una nueva garantía para un equipo en la liga.
   * Solo se permite crear si no existe otra garantía activa (pendiente o pagada)
   * para el mismo equipo en la misma liga.
   */
  async crearGarantia(dto: CreateGarantiaDto, usuario: any): Promise<GarantiaEquipo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para gestionar garantías.');
    }

    // Validar que no exista garantía activa para este equipo en esta liga
    const activa = await this.garantiaRepo.findOne({
      where: [
        { ligaId: dto.ligaId, equipoId: dto.equipoId, estado: 'pendiente' },
        { ligaId: dto.ligaId, equipoId: dto.equipoId, estado: 'pagada' },
      ],
    });
    if (activa) {
      throw new BadRequestException(
        `Este equipo ya tiene una garantía ${activa.estado} en esta liga. ` +
        `Debe resolverla antes de registrar una nueva.`,
      );
    }

    const garantia = this.garantiaRepo.create({
      ligaId: dto.ligaId,
      equipoId: dto.equipoId,
      monto: dto.monto ?? 100,
      estado: 'pendiente',
      registradoPorId: usuario.id,
    });

    return this.garantiaRepo.save(garantia);
  }

  /**
   * Lista todas las garantías de una liga.
   * Incluye historial completo (ejecutadas y devueltas).
   */
  async listarGarantias(ligaId: number): Promise<GarantiaEquipo[]> {
    return this.garantiaRepo.find({
      where: { ligaId },
      order: { creadoEn: 'DESC' },
    });
  }

  /**
   * Marca una garantía como pagada (pendiente → pagada).
   */
  async marcarPagada(id: number, usuario: any): Promise<GarantiaEquipo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para gestionar garantías.');
    }

    const garantia = await this.garantiaRepo.findOneBy({ id });
    if (!garantia) throw new NotFoundException('Garantía no encontrada.');
    if (garantia.estado !== 'pendiente') {
      throw new BadRequestException(`La garantía está en estado '${garantia.estado}', solo se puede pagar si está pendiente.`);
    }

    garantia.estado = 'pagada';
    garantia.fechaPago = new Date();
    return this.garantiaRepo.save(garantia);
  }

  /**
   * Devuelve o ejecuta una garantía pagada.
   *
   * devolver → garantía devuelta al equipo (EGRESO en caja)
   * ejecutar → garantía cobrada por sanción (INGRESO en caja)
   *
   * En ambos casos se crea un MovimientoTesoreria automático.
   */
  async resolverGarantia(id: number, dto: AccionGarantiaDto, usuario: any): Promise<GarantiaEquipo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para gestionar garantías.');
    }

    const garantia = await this.garantiaRepo.findOneBy({ id });
    if (!garantia) throw new NotFoundException('Garantía no encontrada.');
    if (garantia.estado !== 'pagada') {
      throw new BadRequestException(`Solo se puede resolver una garantía pagada. Estado actual: '${garantia.estado}'.`);
    }
    if (!dto.motivo || dto.motivo.trim() === '') {
      throw new BadRequestException('El motivo es obligatorio al devolver o ejecutar una garantía.');
    }

    const nuevoEstado = dto.accion === 'ejecutar' ? 'ejecutada' : 'devuelta';
    const tipoMovimiento = dto.accion === 'ejecutar' ? 'ingreso' : 'egreso';
    const descripcion = dto.accion === 'ejecutar'
      ? `Garantía ejecutada: ${garantia.equipo?.nombre ?? 'equipo'} — ${dto.motivo}`
      : `Garantía devuelta: ${garantia.equipo?.nombre ?? 'equipo'} — ${dto.motivo}`;

    // Crear movimiento en tesorería
    const movimiento = this.movimientoRepo.create({
      ligaId: garantia.ligaId,
      campeonatoId: dto.campeonatoId ?? null,
      equipoId: garantia.equipoId,
      tipo: tipoMovimiento,
      categoria: 'garantia',
      descripcion,
      monto: Number(garantia.monto),
      estado: 'pagado',
      origenAutomatico: true,
      creadoPorId: usuario.id,
    });
    await this.movimientoRepo.save(movimiento);

    // Actualizar garantía
    garantia.estado = nuevoEstado;
    garantia.fechaResolucion = new Date();
    garantia.motivo = dto.motivo;
    return this.garantiaRepo.save(garantia);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESUMEN DEL FONDO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calcula el estado actual del fondo de garantías de una liga.
   */
  async resumenFondo(ligaId: number): Promise<{
    totalCustodiado: number;
    prestamosActivos: number;
    garantiasEjecutadas: number;
    fondoDisponible: number;
  }> {
    const garantiasPagadas = await this.garantiaRepo.find({
      where: { ligaId, estado: 'pagada' },
    });
    const totalCustodiado = garantiasPagadas.reduce((s, g) => s + Number(g.monto), 0);

    const prestamos = await this.prestamoRepo.find({
      where: { ligaId, estado: 'tomado' },
    });
    const prestamosActivos = prestamos.reduce((s, p) => s + Number(p.monto), 0);

    const ejecutadas = await this.garantiaRepo.find({
      where: { ligaId, estado: 'ejecutada' },
    });
    const garantiasEjecutadas = ejecutadas.reduce((s, g) => s + Number(g.monto), 0);

    return {
      totalCustodiado,
      prestamosActivos,
      garantiasEjecutadas,
      fondoDisponible: totalCustodiado - prestamosActivos,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRÉSTAMOS DEL FONDO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un préstamo del fondo colectivo de garantías.
   * Crea un INGRESO en movimientos_tesoreria (dinero entra a caja general).
   */
  async crearPrestamo(dto: CreatePrestamoFondoDto, usuario: any): Promise<PrestamoFondo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para gestionar préstamos del fondo.');
    }

    // Verificar que hay saldo disponible
    const resumen = await this.resumenFondo(dto.ligaId);
    if (dto.monto > resumen.fondoDisponible) {
      throw new BadRequestException(
        `Fondos insuficientes. Disponible: $${resumen.fondoDisponible.toFixed(2)}, ` +
        `solicitado: $${dto.monto.toFixed(2)}.`,
      );
    }

    // Crear movimiento de ingreso en caja
    const movimiento = this.movimientoRepo.create({
      ligaId: dto.ligaId,
      campeonatoId: dto.campeonatoId ?? null,
      tipo: 'ingreso',
      categoria: 'garantia',
      descripcion: `Préstamo del fondo de garantías: ${dto.motivo}`,
      monto: dto.monto,
      estado: 'pagado',
      origenAutomatico: true,
      creadoPorId: usuario.id,
    });
    await this.movimientoRepo.save(movimiento);

    // Registrar préstamo
    const prestamo = this.prestamoRepo.create({
      ligaId: dto.ligaId,
      monto: dto.monto,
      motivo: dto.motivo,
      estado: 'tomado',
      campeonatoId: dto.campeonatoId ?? null,
      fechaToma: new Date(),
      registradoPorId: usuario.id,
    });

    return this.prestamoRepo.save(prestamo);
  }

  /**
   * Lista todos los préstamos del fondo de una liga.
   */
  async listarPrestamos(ligaId: number): Promise<PrestamoFondo[]> {
    return this.prestamoRepo.find({
      where: { ligaId },
      order: { creadoEn: 'DESC' },
    });
  }

  /**
   * Marca un préstamo como devuelto.
   * Crea un EGRESO en movimientos_tesoreria (dinero sale de caja y vuelve al fondo).
   */
  async devolverPrestamo(id: number, campeonatoId: number | null, usuario: any): Promise<PrestamoFondo> {
    if (!ROLES_PERMITIDOS.includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para gestionar préstamos del fondo.');
    }

    const prestamo = await this.prestamoRepo.findOneBy({ id });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    if (prestamo.estado !== 'tomado') {
      throw new BadRequestException('Este préstamo ya fue devuelto.');
    }

    // Crear movimiento de egreso en caja (dinero sale de caja, regresa al fondo)
    const movimiento = this.movimientoRepo.create({
      ligaId: prestamo.ligaId,
      campeonatoId: campeonatoId ?? null,
      tipo: 'egreso',
      categoria: 'garantia',
      descripcion: `Devolución al fondo de garantías: ${prestamo.motivo}`,
      monto: Number(prestamo.monto),
      estado: 'pagado',
      origenAutomatico: true,
      creadoPorId: usuario.id,
    });
    await this.movimientoRepo.save(movimiento);

    // Actualizar préstamo
    prestamo.estado = 'devuelto';
    prestamo.fechaDevolucion = new Date();
    return this.prestamoRepo.save(prestamo);
  }
}
