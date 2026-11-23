import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Partido } from '../../partidos/entities/partido.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Conserva una copia inmutable de cada correccion realizada sobre la
 * alineacion de un partido ya jugado.
 */
@Entity('acta_alineacion_historial')
@Index('idx_acta_alineacion_historial_partido', ['partidoId', 'creadoEn'])
export class ActaAlineacionHistorial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @Column({ type: 'varchar', length: 500 })
  motivo: string;

  @Column({ name: 'alineacion_anterior', type: 'jsonb' })
  alineacionAnterior: Record<string, unknown>[];

  @Column({ name: 'alineacion_nueva', type: 'jsonb' })
  alineacionNueva: Record<string, unknown>[];

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
