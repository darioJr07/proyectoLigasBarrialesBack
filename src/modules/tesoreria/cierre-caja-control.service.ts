import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CierreCajaTesoreria } from './entities/cierre-caja-tesoreria.entity';

/** Reglas compartidas que protegen los períodos de caja ya conciliados. */
@Injectable()
export class CierreCajaControlService {
  constructor(
    @InjectRepository(CierreCajaTesoreria)
    private readonly cierreRepo: Repository<CierreCajaTesoreria>,
  ) {}

  async obtenerCierreDefinitivo(
    campeonatoId: number,
    manager?: EntityManager,
  ): Promise<CierreCajaTesoreria | null> {
    return this.repo(manager).findOne({
      where: { campeonatoId, tipo: 'cierre_definitivo' },
    });
  }

  async obtenerUltimoCorte(
    campeonatoId: number,
    manager?: EntityManager,
  ): Promise<CierreCajaTesoreria | null> {
    return this.repo(manager).findOne({
      where: { campeonatoId },
      order: { fechaCorte: 'DESC', id: 'DESC' },
    });
  }

  async validarCampeonatoAbierto(
    campeonatoId: number | null | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    if (!campeonatoId) return;
    const definitivo = await this.obtenerCierreDefinitivo(campeonatoId, manager);
    if (definitivo) {
      throw new BadRequestException(
        `La caja de este campeonato quedó cerrada definitivamente el ${definitivo.fechaCorte}. No se permiten nuevas operaciones.`,
      );
    }
  }

  async validarFechaOperacion(
    campeonatoId: number | null | undefined,
    fechaOperacion: Date | string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!campeonatoId) return;
    await this.validarCampeonatoAbierto(campeonatoId, manager);
    const ultimo = await this.obtenerUltimoCorte(campeonatoId, manager);
    if (!ultimo) return;

    const fecha = this.normalizarFecha(fechaOperacion);
    if (fecha <= String(ultimo.fechaCorte).slice(0, 10)) {
      throw new BadRequestException(
        `La fecha ${fecha} pertenece a un período ya conciliado. Use una fecha posterior al último corte (${ultimo.fechaCorte}).`,
      );
    }
  }

  fechaActualEcuador(): string {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  private repo(manager?: EntityManager): Repository<CierreCajaTesoreria> {
    return manager ? manager.getRepository(CierreCajaTesoreria) : this.cierreRepo;
  }

  private normalizarFecha(fecha: Date | string): string {
    if (typeof fecha === 'string') return fecha.slice(0, 10);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha);
  }
}
