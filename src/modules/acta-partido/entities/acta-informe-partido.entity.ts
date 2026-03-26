import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Partido } from '../../partidos/entities/partido.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';

/**
 * Registro general del informe del acta por partido.
 *
 * Contenido: observaciones del vocal, datos del árbitro, y estado del proceso.
 *
 * Ciclo de vida del estado:
 *   borrador         →  el vocal está llenando el informe
 *   enviado_tribunal →  el vocal lo envió; el tribunal puede procesar los hechos
 *   resuelto         →  el tribunal procesó todas las incidencias del partido
 *
 * Un partido puede tener a lo sumo UN informe (partido_id tiene índice único).
 */
@Entity('acta_informe_partido')
export class ActaInformePartido {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: false })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: false })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'observaciones_vocal', type: 'varchar', length: 2000, nullable: true })
  observacionesVocal: string | null;

  @Column({ name: 'nombre_arbitro', type: 'varchar', length: 200, nullable: true })
  nombreArbitro: string | null;

  @Column({ name: 'observaciones_arbitro', type: 'varchar', length: 2000, nullable: true })
  observacionesArbitro: string | null;

  /**
   * Nombre del vocal responsable del partido.
   * Puede ser el nombre de un equipo, un jugador o un directivo según el caso.
   */
  @Column({ name: 'vocal_nombre', type: 'varchar', length: 200, nullable: true })
  vocalNombre: string | null;

  /**
   * Equipo al que pertenece el vocal (opcional).
   * Se usa para trazabilidad y posibles sanciones.
   */
  @Column({ name: 'vocal_equipo_id', type: 'int', nullable: true })
  vocalEquipoId: number | null;

  @ManyToOne(() => Equipo, { eager: true, nullable: true })
  @JoinColumn({ name: 'vocal_equipo_id' })
  vocalEquipo: Equipo | null;

  @Column({ type: 'varchar', length: 30, default: 'borrador' })
  estado: 'borrador' | 'enviado_tribunal' | 'resuelto';

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
