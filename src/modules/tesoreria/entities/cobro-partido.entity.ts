import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Partido } from '../../partidos/entities/partido.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Liga } from '../../ligas/entities/liga.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Entidad CobroPartido
 *
 * Registra los cobros de vocalía por partido y por equipo.
 * Se generan desde el acta digital cuando el vocal guarda los valores.
 *
 * Hay UN registro por equipo por partido: uno para el equipo local
 * y otro para el equipo visitante. El UNIQUE constraint lo garantiza.
 *
 * Estado:
 *   pendiente → el equipo aún no ha entregado el dinero al tesorero
 *   pagado    → el tesorero confirmó el pago
 *
 * extras_json guarda las filas libres de "OTROS" del acta:
 *   [{detalle: "Balón", valor: 3.00}, {detalle: "Papelería", valor: 1.50}]
 */
@Entity('cobro_partido')
@Index('uq_cobro_partido_equipo', ['partidoId', 'equipoId'], { unique: true })
export class CobroPartido {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Contexto del partido ────────────────────────────────────────────────

  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ type: 'int', nullable: true })
  jornada: number | null;

  // ─── Valores fijos del acta de vocalía ───────────────────────────────────

  @Column({ name: 'monto_arbitraje', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoArbitraje: number;

  @Column({ name: 'monto_aporte_liga', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoAporteLiga: number;

  @Column({ name: 'monto_premios', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoPremios: number;

  @Column({ name: 'monto_fondo_accidentes', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoFondoAccidentes: number;

  @Column({ name: 'monto_limpieza', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoLimpieza: number;

  // ─── Valores variables ────────────────────────────────────────────────────

  /** Monto total por tarjetas amarillas y rojas del partido */
  @Column({ name: 'monto_tarjetas', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoTarjetas: number;

  /**
   * Extras libres del vocal. Array JSON con detalle y valor.
   * Ejemplo: [{detalle: "Balón de repuesto", valor: 3.00}]
   */
  @Column({ name: 'extras_json', type: 'jsonb', nullable: true })
  extrasJson: Array<{ detalle: string; valor: number }> | null;

  // ─── Total y estado ───────────────────────────────────────────────────────

  /** Suma de todos los montos. Se calcula en el service al guardar. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  /**
   * pendiente      → cobro generado, aún sin cobrar
   * pagado         → el tesorero confirmó el pago presencial
   * no_presentado  → el equipo no se presentó; la deuda pasa a una derrama automática
   */
  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: 'pendiente' | 'pagado' | 'no_presentado';

  @Column({ name: 'fecha_pago', type: 'date', nullable: true })
  fechaPago: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  // ─── Auditoría ────────────────────────────────────────────────────────────

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPorId: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
