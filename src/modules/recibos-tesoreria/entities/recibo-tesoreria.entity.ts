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
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

export type OrigenReciboTesoreria =
  | 'cobro_partido'
  | 'movimiento'
  | 'derrama'
  | 'garantia';

@Entity('recibos_tesoreria')
@Index('uq_recibos_tesoreria_secuencia', ['ligaId', 'anio', 'secuencial'], { unique: true })
@Index('idx_recibos_tesoreria_origen', ['origen', 'origenId'])
export class ReciboTesoreria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'campeonato_id', type: 'int', nullable: true })
  campeonatoId: number | null;

  @ManyToOne(() => Campeonato, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato | null;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ type: 'varchar', length: 30 })
  numero: string;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'int' })
  secuencial: number;

  @Column({ type: 'varchar', length: 30 })
  origen: OrigenReciboTesoreria;

  @Column({ name: 'origen_id', type: 'int' })
  origenId: number;

  @Column({ name: 'movimiento_id', type: 'int', nullable: true })
  movimientoId: number | null;

  @Column({ type: 'varchar', length: 500 })
  concepto: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ name: 'fecha_pago', type: 'date' })
  fechaPago: Date;

  @Column({ type: 'varchar', length: 20, default: 'emitido' })
  estado: 'emitido' | 'anulado';

  @Column({ name: 'emitido_por_id', type: 'int', nullable: true })
  emitidoPorId: number | null;

  @ManyToOne(() => Usuario, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'emitido_por_id' })
  emitidoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
