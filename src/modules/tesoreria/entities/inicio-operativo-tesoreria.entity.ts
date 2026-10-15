import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Define desde cuándo un campeonato usa el control operativo de Tesorería.
 * Los registros previos se preservan como historial y no participan en caja.
 */
@Entity('inicio_operativo_tesoreria')
@Index('uq_inicio_operativo_tesoreria_campeonato', ['campeonatoId'], { unique: true })
export class InicioOperativoTesoreria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  /** Primer día cuyos registros se incluyen en los cálculos operativos. */
  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  /** Dinero físico existente en la Liga al comenzar el control. */
  @Column({ name: 'saldo_inicial', type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldoInicial: number;

  /** caja_nueva | manual | traslado */
  @Column({ name: 'origen_saldo', type: 'varchar', length: 20, default: 'manual' })
  origenSaldo: 'caja_nueva' | 'manual' | 'traslado';

  /** Campeonato que aportó el saldo cuando origenSaldo es traslado. */
  @Column({ name: 'campeonato_origen_id', type: 'int', nullable: true })
  campeonatoOrigenId: number | null;

  @ManyToOne(() => Campeonato, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campeonato_origen_id' })
  campeonatoOrigen: Campeonato | null;

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPorId: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
