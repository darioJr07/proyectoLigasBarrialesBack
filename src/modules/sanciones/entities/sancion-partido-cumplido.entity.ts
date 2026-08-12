import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Sancion } from './sancion.entity';
import { Partido } from '../../partidos/entities/partido.entity';

/** Auditoría inmutable de cada partido que fue contabilizado para una sanción. */
@Entity('sanciones_partidos_cumplidos')
@Index(['sancionId', 'partidoId'], { unique: true })
export class SancionPartidoCumplido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sancion_id', type: 'int' })
  sancionId: number;

  @ManyToOne(() => Sancion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sancion_id' })
  sancion: Sancion;

  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'estado_planilla', type: 'varchar', length: 20, nullable: true })
  estadoPlanilla: string | null;

  @CreateDateColumn({ name: 'contabilizado_en' })
  contabilizadoEn: Date;
}
