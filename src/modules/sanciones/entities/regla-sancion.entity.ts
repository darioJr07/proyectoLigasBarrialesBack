import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { TipoSancion } from './tipo-sancion.entity';

/**
 * Entidad ReglaSancion
 *
 * Define las reglas de negocio de sanciones para una liga/campeonato.
 * Cada liga puede configurar su propia normativa sin modificar el código.
 *
 * CAMPO CLAVE: acumulacionActiva
 *   - false (default) → las tarjetas se registran pero no generan suspensión automática.
 *   - true            → al alcanzar acumulacionCantidad tarjetas, se crea una suspensión
 *                       automática de partidosSuspension partidos.
 *
 * Ejemplo de regla activa:
 *   tipoSancionId = 1 (Amarilla), acumulacionActiva = true,
 *   acumulacionCantidad = 2, partidosSuspension = 1
 *   → "2 amarillas generan 1 partido de suspensión"
 */
@Entity('reglas_sancion')
export class ReglaSancion {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Liga a la que aplica esta regla.
   */
  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  /**
   * Campeonato específico. Si es null, la regla aplica a todos los campeonatos de la liga.
   */
  @Column({ name: 'campeonato_id', type: 'int', nullable: true })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { nullable: true, eager: true })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  /**
   * Tipo de sanción al que aplica esta regla (ej: Amarilla).
   */
  @Column({ name: 'tipo_sancion_id', type: 'int' })
  tipoSancionId: number;

  @ManyToOne(() => TipoSancion, { eager: true })
  @JoinColumn({ name: 'tipo_sancion_id' })
  tipoSancion: TipoSancion;

  /**
   * Descripción textual de la causa según el reglamento.
   * Aquí se escribe el literal exacto. Ej: "Art. 108 lit. A: Reincidir en falta estando amonestado".
   * Nullable → las reglas existentes sin descripción siguen funcionando.
   */
  @Column({ type: 'text', nullable: true })
  descripcion: string;

  /**
   * Si true, el sistema cuenta las tarjetas del jugador y genera suspensión automática.
   * Default false → no afecta comportamiento actual del sistema.
   */
  @Column({ name: 'acumulacion_activa', type: 'boolean', default: false })
  acumulacionActiva: boolean;

  /**
   * Cantidad de tarjetas para activar la suspensión automática.
   * Solo aplica si acumulacionActiva = true.
   * Ejemplo: 2 → "2 amarillas = suspensión"
   */
  @Column({ name: 'acumulacion_cantidad', type: 'int', nullable: true })
  acumulacionCantidad: number;

  /**
   * Partidos de suspensión que se aplican al llegar al límite de acumulación.
   * También se usa para tarjetas rojas directas.
   * Ejemplo: 1 → "1 partido de suspensión"
   */
  @Column({ name: 'partidos_suspension', type: 'int', nullable: true })
  partidosSuspension: number;

  /**
   * Puntos a descontar al equipo al aplicar esta sanción.
   * Útil para sanciones administrativas por alineación indebida, etc.
   */
  @Column({ name: 'puntos_descuento', type: 'int', nullable: true, default: 0 })
  puntosDescuento: number;

  /**
   * Modo en que se aplica el castigo: por partidos (default) o por tiempo.
   * 'partidos' → usa partidosSuspension
   * 'tiempo'   → usa duracionMeses
   */
  @Column({ name: 'modo_castigo', type: 'varchar', length: 10, default: 'partidos' })
  modoCastigo: 'partidos' | 'tiempo';

  /**
   * Duración en meses cuando modoCastigo = 'tiempo'.
   * Ejemplo: 6 → suspensión de 6 meses a partir de la fecha de sanción.
   */
  @Column({ name: 'duracion_meses', type: 'int', nullable: true })
  duracionMeses: number | null;
  /**
   * Monto de multa económica que aplica esta regla por cada sanción.
   * Nullable → reglas sin multa simplemente no tienen valor.
   * Ejemplo: 2.50 → "$ 2.50 por cada tarjeta amarilla"
   */
  @Column({ name: 'monto_multa', type: 'decimal', precision: 10, scale: 2, nullable: true })
  montoMulta: number | null;
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
