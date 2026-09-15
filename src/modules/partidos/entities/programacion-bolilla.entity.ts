import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('programacion_bolillas')
export class ProgramacionBolilla {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'programacion_id', type: 'int' })
  programacionId: number;

  @Column({ type: 'int' })
  numero: number;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'varchar', length: 10 })
  hora: string;

  @Column({ type: 'varchar', length: 150 })
  cancha: string;

  @Column({ name: 'partido_id', type: 'int', nullable: true })
  partidoId: number | null;

  @Column({ type: 'varchar', length: 20, default: 'disponible' })
  estado: 'disponible' | 'asignada' | 'no_utilizada';

  @Column({ name: 'orden_sorteo', type: 'int', nullable: true })
  ordenSorteo: number | null;

  @Column({ name: 'asignacion_manual', type: 'boolean', default: false })
  asignacionManual: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
