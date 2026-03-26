import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Partido } from '../../partidos/entities/partido.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Jugador } from '../../jugadores/entities/jugador.entity';

/**
 * Registra cada incidencia disciplinaria ocurrida en un partido.
 * Son los "hechos" que el vocal documenta en el acta.
 *
 * EL TRIBUNAL DE PENAS revisa estas incidencias y decide:
 *   - Sancionar → se crea una Sancion en el módulo de sanciones (sancionId queda registrado).
 *   - Absolver  → el hecho queda en el historial pero sin sanción aplicada.
 *
 * Una incidencia puede ser individual (jugadorId presente) o colectiva del equipo
 * (jugadorId = null). Por eso jugadorId es nullable.
 *
 * estadoResolucion:
 *   pendiente  → el tribunal aún no procesó esta incidencia
 *   sancionado → el tribunal decidió sancionar y creó una Sancion
 *   absuelto   → el tribunal decidió no sancionar
 */
@Entity('acta_incidencia')
export class ActaIncidencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: false })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  /** Snapshot de categoría al momento del partido. */
  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  /** Jugador involucrado. Nullable para incidencias del equipo como colectivo. */
  @Column({ name: 'jugador_id', type: 'int', nullable: true })
  jugadorId: number | null;

  @ManyToOne(() => Jugador, { eager: true, nullable: true })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador | null;

  @Column({ name: 'tipo_incidencia', type: 'varchar', length: 30 })
  tipoIncidencia:
    | 'tarjeta_amarilla'
    | 'tarjeta_roja'
    | 'doble_amarilla'
    | 'expulsion_directa'
    | 'incidencia_grave'
    | 'otro';

  /** Minuto aproximado del partido en que ocurrió (informativo). */
  @Column({ type: 'int', nullable: true })
  minuto: number | null;

  /** Descripción del hecho según el vocal. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ name: 'estado_resolucion', type: 'varchar', length: 20, default: 'pendiente' })
  estadoResolucion: 'pendiente' | 'sancionado' | 'absuelto';

  /** ID de la Sancion creada por el tribunal. Solo se llena cuando estadoResolucion = 'sancionado'. */
  @Column({ name: 'sancion_id', type: 'int', nullable: true })
  sancionId: number | null;

  /** Notas del tribunal al resolver la incidencia. */
  @Column({ name: 'observaciones_tribunal', type: 'varchar', length: 500, nullable: true })
  observacionesTribunal: string | null;

  @Column({ name: 'fecha_resolucion', type: 'date', nullable: true })
  fechaResolucion: Date | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
