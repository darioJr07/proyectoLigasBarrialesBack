import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Entidad GarantiaEquipo
 *
 * Representa la garantía económica que un equipo deposita al ingresar a la liga.
 * La garantía es ÚNICA por equipo por liga (no por campeonato).
 * Validación de unicidad por código: no puede existir otra en estado pendiente/pagada
 * para el mismo liga_id + equipo_id.
 *
 * ESTADOS:
 *   pendiente  → Registrada por el tesorero, equipo aún no ha pagado
 *   pagada     → Equipo pagó, dinero en custodia del fondo de garantías
 *   devuelta   → Equipo se retira de la liga, se devuelve el dinero (crea EGRESO en caja)
 *   ejecutada  → Equipo pierde la garantía por sanción grave (crea INGRESO en caja)
 *
 * Después de ejecutada, el equipo puede crear una NUEVA garantía para continuar en la liga.
 */
@Entity('garantia_equipo')
export class GarantiaEquipo {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Contexto ────────────────────────────────────────────────────────────

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  // ─── Monto y estado ───────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100 })
  monto: number;

  /**
   * Estado actual de la garantía.
   * pendiente | pagada | devuelta | ejecutada
   */
  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: 'pendiente' | 'pagada' | 'devuelta' | 'ejecutada';

  /** Fecha en que el equipo efectuó el pago de la garantía */
  @Column({ name: 'fecha_pago', type: 'date', nullable: true })
  fechaPago: Date | null;

  /** Fecha en que se resolvió (devuelta o ejecutada) */
  @Column({ name: 'fecha_resolucion', type: 'date', nullable: true })
  fechaResolucion: Date | null;

  /**
   * Motivo requerido al devolver o ejecutar la garantía.
   * Ej: "Equipo se retira de la liga" o "Agresión al árbitro en jornada 8"
   */
  @Column({ type: 'text', nullable: true })
  motivo: string | null;

  // ─── Auditoría ────────────────────────────────────────────────────────────

  @Column({ name: 'registrado_por_id', type: 'int', nullable: true })
  registradoPorId: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
