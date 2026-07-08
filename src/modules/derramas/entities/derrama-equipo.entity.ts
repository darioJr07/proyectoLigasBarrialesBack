import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Derrama } from './derrama.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';

/**
 * Entidad DerramaEquipo
 *
 * Un registro por equipo por derrama.
 *
 * MODO DE PAGO:
 *   inmediato   → el equipo paga ese momento; el tesorero lo registra directamente
 *   por_vocalia → en cada acta de partido se cobra 1 unidad × monto_unitario
 *                 hasta cancelar el total
 *
 * ESTADOS:
 *   pendiente  → no ha pagado nada
 *   parcial    → ha abonado algo pero no el total (monto_abonado < monto_total)
 *   pagado     → cancelado completamente
 *   arrastrado → el campeonato cerró con deuda pendiente; pasa al siguiente campeonato
 */
@Entity('derrama_equipo')
export class DerramaEquipo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'derrama_id', type: 'int' })
  derramaId: number;

  @ManyToOne(() => Derrama, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'derrama_id' })
  derrama: Derrama;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  /** Campeonato en que se originó la deuda (útil cuando se arrastra a siguiente temporada) */
  @Column({ name: 'campeonato_origen_id', type: 'int', nullable: true })
  campeonatoOrigenId: number | null;

  @ManyToOne(() => Campeonato, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campeonato_origen_id' })
  campeonatoOrigen: Campeonato | null;

  /** Número de unidades que el equipo tomó (siempre 1 para tipo 'monetaria') */
  @Column({ type: 'int', default: 1 })
  cantidad: number;

  /** cantidad × monto_unitario de la derrama */
  @Column({ name: 'monto_total', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoTotal: number;

  /** Suma de todos los pagos registrados hasta ahora */
  @Column({ name: 'monto_abonado', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoAbonado: number;

  /** 'inmediato' | 'por_vocalia' */
  @Column({ name: 'modo_pago', type: 'varchar', length: 20, default: 'por_vocalia' })
  modoPago: 'inmediato' | 'por_vocalia';

  /** 'pendiente' | 'parcial' | 'pagado' | 'arrastrado' */
  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: 'pendiente' | 'parcial' | 'pagado' | 'arrastrado';

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  // ─── Campo calculado (no persistido) ─────────────────────────────────────
  /** Saldo pendiente = montoTotal - montoAbonado */
  get saldoPendiente(): number {
    return Number(this.montoTotal) - Number(this.montoAbonado);
  }
}
