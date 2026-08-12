import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sancion } from './sancion.entity';
import { Partido } from '../../partidos/entities/partido.entity';

/** Partido ya cerrado antes de crear la sanción; no puede contar retroactivamente. */
@Entity('sanciones_partidos_excluidos')
@Index(['sancionId', 'partidoId'], { unique: true })
export class SancionPartidoExcluido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sancion_id', type: 'int' }) sancionId: number;
  @ManyToOne(() => Sancion, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'sancion_id' }) sancion: Sancion;
  @Column({ name: 'partido_id', type: 'int' }) partidoId: number;
  @ManyToOne(() => Partido, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'partido_id' }) partido: Partido;
  @CreateDateColumn({ name: 'excluido_en' }) excluidoEn: Date;
}
