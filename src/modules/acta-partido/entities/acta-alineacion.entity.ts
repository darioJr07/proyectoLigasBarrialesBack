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
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';

/**
 * Registra la participación (o no) de cada jugador en un partido específico.
 * Es la versión digital de la planilla de alineación del acta de vocalía.
 *
 * Estados posibles:
 *  - jugo        → participó normalmente en el partido
 *  - no_jugo     → no fue convocado / no apareció
 *  - suspendido  → tenía sanción activa, no podía jugar
 *  - ausente     → justificó su ausencia
 *  - lesionado   → no jugó por lesión
 *  - expulsado   → fue expulsado durante el partido (jugó al menos un tramo)
 */
@Entity('acta_alineacion')
export class ActaAlineacion {
  @PrimaryGeneratedColumn()
  id: number;

  /** Partido al que pertenece este registro */
  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: false })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  /** Campeonato (guardado directamente para consultas más eficientes) */
  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: false })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  /** Equipo al que pertenece el jugador en este partido */
  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  /** Jugador registrado en la planilla */
  @Column({ name: 'jugador_id', type: 'int' })
  jugadorId: number;

  @ManyToOne(() => Jugador, { eager: true })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador;

  /** Estado del jugador en este partido */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'jugo',
  })
  estado: 'jugo' | 'no_jugo' | 'suspendido' | 'ausente' | 'lesionado' | 'expulsado';

  /** Número de camiseta con el que jugó (puede diferir del número habitual) */
  @Column({ name: 'numero_cancha', type: 'int', nullable: true })
  numeroCancha: number | null;

  /** Observaciones del vocal o árbitro sobre este jugador en el partido */
  @Column({ type: 'varchar', length: 300, nullable: true })
  observaciones: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
