import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

export type TipoCierreCaja = 'conciliacion' | 'cierre_definitivo';

/**
 * Fotografia inmutable de un corte de caja. Las conciliaciones pueden repetirse,
 * pero solo puede existir un cierre definitivo por campeonato.
 */
@Entity('cierres_caja_tesoreria')
@Index('uq_cierre_caja_fecha', ['campeonatoId', 'fechaCorte'], { unique: true })
@Index('uq_cierre_caja_definitivo', ['campeonatoId'], {
  unique: true,
  where: `"tipo" = 'cierre_definitivo'`,
})
export class CierreCajaTesoreria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ type: 'varchar', length: 25 })
  tipo: TipoCierreCaja;

  @Column({ name: 'fecha_desde', type: 'date' })
  fechaDesde: string;

  @Column({ name: 'fecha_corte', type: 'date' })
  fechaCorte: string;

  @Column({ name: 'cierre_anterior_id', type: 'int', nullable: true })
  cierreAnteriorId: number | null;

  @ManyToOne(() => CierreCajaTesoreria, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cierre_anterior_id' })
  cierreAnterior: CierreCajaTesoreria | null;

  @Column({ name: 'saldo_base', type: 'decimal', precision: 12, scale: 2 })
  saldoBase: number;

  @Column({ name: 'total_ingresos', type: 'decimal', precision: 12, scale: 2 })
  totalIngresos: number;

  @Column({ name: 'total_egresos', type: 'decimal', precision: 12, scale: 2 })
  totalEgresos: number;

  @Column({ name: 'saldo_esperado', type: 'decimal', precision: 12, scale: 2 })
  saldoEsperado: number;

  @Column({ name: 'saldo_contado', type: 'decimal', precision: 12, scale: 2 })
  saldoContado: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  diferencia: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  observaciones: string | null;

  @Column({ name: 'creado_por_id', type: 'int', nullable: true })
  creadoPorId: number | null;

  @ManyToOne(() => Usuario, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
