import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TipoSancion } from './tipo-sancion.entity';
import { ReglaSancion } from './regla-sancion.entity';
import { Liga } from '../../ligas/entities/liga.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Partido } from '../../partidos/entities/partido.entity';
import { Jugador } from '../../jugadores/entities/jugador.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';

/**
 * Entidad Sancion
 *
 * Registro individual de una sanción aplicada a un jugador, equipo,
 * directivo o barra durante un campeonato.
 *
 * DISEÑO CLAVE:
 *   - jugadorId es nullable → permite sanciones a equipos/barras/directivos sin jugador.
 *   - equipoId es nullable  → permite sanciones individuales de jugador sin equipo específico.
 *   - partidoId es nullable → permite sanciones fuera de partido (disciplinarias, etc.).
 *   - categoriaId se guarda como snapshot histórico (igual que en Gol).
 *
 * CONTROL DE SUSPENSIÓN:
 *   - suspensionActiva = true indica que el jugador no puede participar.
 *   - partidosCumplidos se incrementa cada vez que el jugador no participa por la sanción.
 *   - Cuando partidosCumplidos >= partidosSuspension → suspensionActiva = false automáticamente.
 */
@Entity('sanciones')
export class Sancion {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Tipo de sanción ─────────────────────────────────────────────────────

  @Column({ name: 'tipo_sancion_id', type: 'int' })
  tipoSancionId: number;

  @ManyToOne(() => TipoSancion, { eager: true })
  @JoinColumn({ name: 'tipo_sancion_id' })
  tipoSancion: TipoSancion;

  /**
   * Regla específica del reglamento que justifica esta sanción.
   * Nullable → permite sanciones manuales sin una regla predefinida.
   */
  @Column({ name: 'regla_sancion_id', type: 'int', nullable: true })
  reglaSancionId: number;

  @ManyToOne(() => ReglaSancion, { nullable: true, eager: true })
  @JoinColumn({ name: 'regla_sancion_id' })
  reglaSancion: ReglaSancion;

  // ─── Contexto (liga / campeonato / categoría) ────────────────────────────

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: false })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: true })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  /**
   * Snapshot de categoría al momento de la sanción.
   * Se guarda para mantener el historial aun si el jugador cambia de categoría.
   */
  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number;

  @ManyToOne(() => Categoria, { nullable: true, eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  // ─── Partido (opcional) ──────────────────────────────────────────────────

  /**
   * Partido donde ocurrió la sanción. Nullable para sanciones fuera de partido.
   */
  @Column({ name: 'partido_id', type: 'int', nullable: true })
  partidoId: number;

  @ManyToOne(() => Partido, { nullable: true, eager: true })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  // ─── Afectado (jugador y/o equipo) ──────────────────────────────────────

  /**
   * Jugador sancionado. Nullable para sanciones colectivas (equipo, barra).
   */
  @Column({ name: 'jugador_id', type: 'int', nullable: true })
  jugadorId: number;

  @ManyToOne(() => Jugador, { nullable: true, eager: true })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador;

  /**
   * Equipo sancionado. Puede combinarse con jugadorId para sanciones individuales.
   */
  @Column({ name: 'equipo_id', type: 'int', nullable: true })
  equipoId: number;

  @ManyToOne(() => Equipo, { nullable: true, eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  // ─── Detalles de la sanción ──────────────────────────────────────────────

  /**
   * Motivo o descripción de la sanción.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string;

  /**
   * Partidos de suspensión asignados.
   * Puede venir de la regla automática o ser asignado manualmente.
   */
  @Column({ name: 'partidos_suspension', type: 'int', nullable: true, default: 0 })
  partidosSuspension: number;

  /**
   * Partidos ya cumplidos de la suspensión.
   * Se incrementa cada fecha que el jugador no puede participar.
   */
  @Column({ name: 'partidos_cumplidos', type: 'int', default: 0 })
  partidosCumplidos: number;

  /**
   * Indica si la suspensión sigue activa.
   * Se pone en false cuando partidosCumplidos >= partidosSuspension,
   * o cuando el directivo la levanta manualmente.
   */
  @Column({ name: 'suspension_activa', type: 'boolean', default: false })
  suspensionActiva: boolean;

  /**
   * Fecha en que se registró la sanción (puede ser distinta a la del partido).
   */
  @Column({ name: 'fecha_sancion', type: 'date', nullable: true })
  fechaSancion: Date;

  /** Fecha de inicio de la suspensión cuando modoCastigo = 'tiempo'. */
  @Column({ name: 'fecha_inicio_suspension', type: 'date', nullable: true })
  fechaInicioSuspension: Date | null;

  /** Fecha de vencimiento de la suspensión cuando modoCastigo = 'tiempo'. */
  @Column({ name: 'fecha_fin_suspension', type: 'date', nullable: true })
  fechaFinSuspension: Date | null;

  /**
   * Si esta sanción fue arrastrada de un campeonato anterior,
   * aquí se guarda el ID de la sanción original (auditoría).
   */
  @Column({ name: 'origen_sancion_id', type: 'int', nullable: true })
  origenSancionId: number | null;

  /**
   * Snapshot del monto de multa al momento de crear la sanción.
   * Se copia desde regla_sancion.monto_multa para preservar el historial
   * aunque el monto de la regla cambie después.
   * Nullable → sanciones sin componente económico no tienen valor.
   */
  @Column({ name: 'monto_multa', type: 'decimal', precision: 10, scale: 2, nullable: true })
  montoMulta: number | null;

  /**
   * Estado del cobro de la multa.
   * 'sin_multa' → sanción sin componente económico
   * 'aprobada'  → el tribunal aprobó el cobro (se cobrará en la próxima vocalía)
   */
  @Column({ name: 'estado_cobro', type: 'varchar', length: 20, default: 'sin_multa' })
  estadoCobro: 'aprobada' | 'sin_multa';

  /**
   * Indica si la multa ya fue cobrada en vocalía.
   * Se pone en true cuando el vocal guarda el cobro-partido de ese equipo.
   */
  @Column({ name: 'cobrada', type: 'boolean', default: false })
  cobrada: boolean;

  /**
   * Soft delete: false = anulada/eliminada del sistema.
   */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
