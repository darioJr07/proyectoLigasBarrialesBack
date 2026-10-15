import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  OrigenReciboTesoreria,
  ReciboTesoreria,
} from './entities/recibo-tesoreria.entity';

export interface EmitirReciboTesoreria {
  ligaId: number;
  campeonatoId?: number | null;
  equipoId: number;
  origen: OrigenReciboTesoreria;
  origenId: number;
  movimientoId?: number | null;
  concepto: string;
  monto: number;
  fechaPago: Date | string;
  emitidoPorId?: number | null;
}

@Injectable()
export class RecibosTesoreriaService {
  constructor(private readonly dataSource: DataSource) {}

  private validarAccesoLiga(ligaId: number, usuario: any): void {
    if (!['master', 'directivo_liga', 'tesoreria'].includes(usuario?.role)) {
      throw new ForbiddenException('No tiene permisos para consultar recibos de tesorería.');
    }
    if (usuario.role !== 'master' && Number(usuario.ligaId) !== Number(ligaId)) {
      throw new ForbiddenException('No tiene permisos para consultar recibos de otra liga.');
    }
  }

  async emitir(
    datos: EmitirReciboTesoreria,
    manager?: EntityManager,
  ): Promise<ReciboTesoreria> {
    if (!manager) {
      return this.dataSource.transaction((transactionManager) =>
        this.emitir(datos, transactionManager),
      );
    }

    const fechaPago = datos.fechaPago instanceof Date
      ? datos.fechaPago
      : new Date(`${datos.fechaPago}T00:00:00`);
    const anio = fechaPago.getFullYear();

    // Bloqueo por liga y año: dos pagos simultáneos no pueden recibir el mismo número.
    await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [datos.ligaId, anio]);

    const ultimo = await manager
      .getRepository(ReciboTesoreria)
      .createQueryBuilder('recibo')
      .select('COALESCE(MAX(recibo.secuencial), 0)', 'maximo')
      .where('recibo.liga_id = :ligaId', { ligaId: datos.ligaId })
      .andWhere('recibo.anio = :anio', { anio })
      .getRawOne<{ maximo: string }>();

    const secuencial = Number(ultimo?.maximo ?? 0) + 1;
    const numero = `REC-${anio}-${secuencial.toString().padStart(6, '0')}`;
    const repo = manager.getRepository(ReciboTesoreria);
    const recibo = repo.create({
      ...datos,
      campeonatoId: datos.campeonatoId ?? null,
      movimientoId: datos.movimientoId ?? null,
      fechaPago,
      anio,
      secuencial,
      numero,
      estado: 'emitido',
      emitidoPorId: datos.emitidoPorId ?? null,
    });
    const guardado = await repo.save(recibo);
    return repo.findOneOrFail({ where: { id: guardado.id } });
  }

  async listar(
    ligaId: number,
    equipoId: number | undefined,
    campeonatoId: number | undefined,
    usuario: any,
  ): Promise<ReciboTesoreria[]> {
    this.validarAccesoLiga(ligaId, usuario);
    const query = this.dataSource
      .getRepository(ReciboTesoreria)
      .createQueryBuilder('recibo')
      .leftJoinAndSelect('recibo.liga', 'liga')
      .leftJoinAndSelect('recibo.campeonato', 'campeonato')
      .leftJoinAndSelect('recibo.equipo', 'equipo')
      .leftJoinAndSelect('recibo.emitidoPor', 'emitidoPor')
      .where('recibo.liga_id = :ligaId', { ligaId });

    if (equipoId) query.andWhere('recibo.equipo_id = :equipoId', { equipoId });
    if (campeonatoId) {
      query.andWhere('recibo.campeonato_id = :campeonatoId', { campeonatoId });
    }

    return query
      .orderBy('recibo.fecha_pago', 'DESC')
      .addOrderBy('recibo.id', 'DESC')
      .getMany();
  }

  async obtener(id: number, usuario: any): Promise<ReciboTesoreria> {
    const recibo = await this.dataSource.getRepository(ReciboTesoreria).findOne({
      where: { id },
    });
    if (!recibo) throw new NotFoundException('Recibo no encontrado.');
    this.validarAccesoLiga(recibo.ligaId, usuario);
    return recibo;
  }

  async listarPorMovimientos(movimientoIds: number[]): Promise<ReciboTesoreria[]> {
    if (movimientoIds.length === 0) return [];
    return this.dataSource
      .getRepository(ReciboTesoreria)
      .createQueryBuilder('recibo')
      .leftJoinAndSelect('recibo.liga', 'liga')
      .leftJoinAndSelect('recibo.campeonato', 'campeonato')
      .leftJoinAndSelect('recibo.equipo', 'equipo')
      .leftJoinAndSelect('recibo.emitidoPor', 'emitidoPor')
      .where('recibo.movimiento_id IN (:...movimientoIds)', { movimientoIds })
      .orderBy('recibo.id', 'DESC')
      .getMany();
  }

  async anularPorMovimiento(
    movimientoId: number,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(ReciboTesoreria)
      .createQueryBuilder()
      .update(ReciboTesoreria)
      .set({ estado: 'anulado' })
      .where("estado = 'emitido'")
      .andWhere(
        '(movimiento_id = :movimientoId OR (origen = :origen AND origen_id = :movimientoId))',
        { movimientoId, origen: 'movimiento' },
      )
      .execute();
  }
}
