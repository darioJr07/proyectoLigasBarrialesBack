import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Partido } from './partido.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';

export type EstadoSolicitudHorario = 'pendiente' | 'aprobada' | 'aplicada' | 'rechazada' | 'cancelada';

@Entity('solicitudes_horario')
@Index('idx_solicitudes_horario_filtros', ['campeonatoId', 'categoriaId', 'etapa', 'estado'])
@Index('uq_solicitud_horario_equipo_etapa_vigente', ['campeonatoId', 'categoriaId', 'etapa', 'equipoId'], {
  unique: true,
  where: `"estado" IN ('pendiente', 'aprobada', 'aplicada')`,
})
export class SolicitudHorario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @Column({ name: 'categoria_id', type: 'int' })
  categoriaId: number;

  @Column({ type: 'varchar', length: 50 })
  etapa: string;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ name: 'partido_id', type: 'int' })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: true })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'fecha_solicitada', type: 'date' })
  fechaSolicitada: Date;

  @Column({ name: 'hora_solicitada', type: 'varchar', length: 10 })
  horaSolicitada: string;

  @Column({ name: 'cancha_solicitada', type: 'varchar', length: 150, nullable: true })
  canchaSolicitada: string | null;

  @Column({ type: 'varchar', length: 500 })
  motivo: string;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: EstadoSolicitudHorario;

  @Column({ name: 'programacion_id', type: 'int', nullable: true })
  programacionId: number | null;

  @Column({ name: 'bolilla_id', type: 'int', nullable: true })
  bolillaId: number | null;

  @Column({ name: 'solicitado_por', type: 'int', nullable: true })
  solicitadoPor: number | null;

  @Column({ name: 'resuelto_por', type: 'int', nullable: true })
  resueltoPor: number | null;

  @Column({ name: 'observacion_resolucion', type: 'varchar', length: 500, nullable: true })
  observacionResolucion: string | null;

  @Column({ name: 'resuelto_en', type: 'timestamp', nullable: true })
  resueltoEn: Date | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
