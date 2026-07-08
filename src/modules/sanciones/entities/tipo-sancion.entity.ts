import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';

/**
 * Entidad TipoSancion
 *
 * Catálogo parametrizable de tipos de sanción por liga.
 * Cada liga puede tener sus propios tipos además de los globales (ligaId null).
 *
 * CAMPO CLAVE: aplicaA
 *   - 'jugador'   → Tarjeta amarilla, roja, suspensión individual
 *   - 'equipo'    → Multa, pérdida de puntos, suspensión de cancha
 *   - 'directivo' → Expulsión de banco, suspensión de tribuna
 *   - 'barra'     → Suspensión de público
 */
@Entity('tipos_sancion')
export class TipoSancion {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Nombre descriptivo del tipo de sanción.
   * Ejemplos: 'Amarilla', 'Roja', 'Multa', 'Expulsión de banco'
   */
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  /**
   * Descripción adicional del tipo de sanción.
   */
  @Column({ type: 'text', nullable: true })
  descripcion: string;

  /**
   * A quién aplica esta sanción.
   * Valores posibles: 'jugador', 'equipo', 'directivo', 'barra'
   */
  @Column({ type: 'varchar', length: 20, default: 'jugador' })
  aplicaA: string;

  /**
   * Liga propietaria del tipo.
   * Si es null, el tipo es global (disponible para todas las ligas).
   */
  @Column({ name: 'liga_id', type: 'int', nullable: true })
  ligaId: number;

  @ManyToOne(() => Liga, { nullable: true, eager: true })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  /**
   * Monto de multa económica asociado a este tipo de sanción (opcional).
   * Se usa como valor por defecto al crear reglas de sanción.
   */
  @Column({ name: 'monto_multa', type: 'decimal', precision: 10, scale: 2, nullable: true })
  montoMulta: number | null;

  /**
   * Soft delete: false = desactivado (no aparece en selectores).
   */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
