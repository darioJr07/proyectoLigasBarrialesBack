import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Entidad PrestamoFondo
 *
 * Registra cuando la liga toma dinero del fondo colectivo de garantías
 * para cubrir gastos (ej: mejoras en la cancha) y la posterior devolución.
 *
 * Al crear un préstamo (estado: tomado):
 *   → Se crea un MovimientoTesoreria tipo 'ingreso', categoria 'garantia'
 *     en la caja del campeonato activo (el dinero entra a la caja general).
 *
 * Al marcar devuelto (estado: devuelto):
 *   → Se crea un MovimientoTesoreria tipo 'egreso', categoria 'garantia'
 *     (el dinero sale de caja y regresa al fondo de garantías).
 *
 * El fondo disponible se calcula:
 *   Total garantías pagadas - suma de préstamos con estado 'tomado'
 */
@Entity('prestamo_fondo_garantias')
export class PrestamoFondo {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Contexto ────────────────────────────────────────────────────────────

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  // ─── Monto y estado ───────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  /**
   * Descripción del motivo por el que se toma el préstamo.
   * Ej: "Mejora del arco norte", "Pintura de vestuarios"
   */
  @Column({ type: 'text' })
  motivo: string;

  /**
   * Estado del préstamo.
   * tomado   → El dinero fue tomado del fondo y está en caja
   * devuelto → El dinero fue repuesto al fondo desde caja
   */
  @Column({ type: 'varchar', length: 20, default: 'tomado' })
  estado: 'tomado' | 'devuelto';

  /** Campeonato activo al momento de tomar el préstamo (para el movimiento de caja) */
  @Column({ name: 'campeonato_id', type: 'int', nullable: true })
  campeonatoId: number | null;

  /** Fecha en que se tomó el préstamo */
  @Column({ name: 'fecha_toma', type: 'date' })
  fechaToma: Date;

  /** Fecha en que se devolvió el préstamo al fondo */
  @Column({ name: 'fecha_devolucion', type: 'date', nullable: true })
  fechaDevolucion: Date | null;

  // ─── Auditoría ────────────────────────────────────────────────────────────

  @Column({ name: 'registrado_por_id', type: 'int', nullable: true })
  registradoPorId: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
