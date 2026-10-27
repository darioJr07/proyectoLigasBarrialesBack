import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('programacion_bolillas')
@Index('uq_bolilla_solicitud_horario', ['solicitudHorarioId'], {
  unique: true,
  where: '"solicitud_horario_id" IS NOT NULL',
})
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

  @Column({ name: 'solicitud_horario_id', type: 'int', nullable: true })
  solicitudHorarioId: number | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
