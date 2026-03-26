import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Partido } from '../../partidos/entities/partido.entity';
import { Jugador } from '../../jugadores/entities/jugador.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';

/**
 * Entidad Gol
 *
 * Registra cada gol de forma individual, vinculando:
 *   - El partido donde se marcó
 *   - El jugador que lo anotó
 *   - El equipo al que pertenece el jugador EN ESE MOMENTO
 *   - La categoría EN ESE MOMENTO (clave para ascensos/descensos a mitad de campeonato)
 *
 * DISEÑO CLAVE: se guarda categoria_id directamente en el gol (no se deriva del partido)
 * para que los cambios futuros de categoría no alteren el historial de goles.
 *
 * TIPOS DE GOL:
 *   - 'normal'  → gol de juego normal
 *   - 'penal'   → gol de tiro penal
 *   - 'autogol' → gol en contra (se registra al jugador que lo marcó, equipo contrario suma)
 */
@Entity('goles')
export class Gol {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Relación con Partido ─────────────────────────────────────────────────

  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  /**
   * Partido en el que se marcó el gol.
   */
  @ManyToOne(() => Partido, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  // ─── Relación con Jugador ─────────────────────────────────────────────────

  @Column({ name: 'jugador_id', type: 'int' })
  jugadorId: number;

  /**
   * Jugador que anotó el gol (o que hizo el autogol).
   */
  @ManyToOne(() => Jugador, { eager: true })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador;

  // ─── Relación con Equipo ──────────────────────────────────────────────────

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  /**
   * Equipo al que beneficia el gol.
   * NOTA: En autogoles, este es el equipo CONTRARIO al jugador, ya que
   * el gol suma al rival. El service se encarga de asignar el equipo correcto.
   */
  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  // ─── Relación con Campeonato ──────────────────────────────────────────────

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: false })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  // ─── Relación con Categoría ───────────────────────────────────────────────

  @Column({ name: 'categoria_id', type: 'int' })
  categoriaId: number;

  /**
   * Categoría en la que se jugó el partido.
   * Se guarda aquí y no solo en el partido para ser resiliente a
   * cambios de categoría del jugador por ascenso/descenso.
   */
  @ManyToOne(() => Categoria, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  // ─── Datos del gol ────────────────────────────────────────────────────────

  /**
   * Minuto en que se marcó el gol. Opcional, solo informativo.
   */
  @Column({ type: 'int', nullable: true })
  minuto: number | null;

  /**
   * Tipo de gol:
   * - 'normal'  → jugada normal
   * - 'penal'   → tiro penal
   * - 'autogol' → gol en contra
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'normal',
  })
  tipo: 'normal' | 'penal' | 'autogol';

  /**
   * Permite desactivar un gol sin eliminarlo (auditoría).
   */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
