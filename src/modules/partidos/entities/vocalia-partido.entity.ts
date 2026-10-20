import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Partido } from './partido.entity';

@Entity('vocalias_partido')
export class VocaliaPartido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'programacion_id', type: 'int' })
  programacionId: number;

  @Column({ name: 'partido_id', type: 'int', unique: true })
  partidoId: number;

  @ManyToOne(() => Partido, { eager: true })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @Column({ name: 'partido_origen_id', type: 'int', nullable: true })
  partidoOrigenId: number | null;

  @ManyToOne(() => Partido, { eager: true, nullable: true })
  @JoinColumn({ name: 'partido_origen_id' })
  partidoOrigen: Partido | null;

  @Column({ name: 'tipo_asignacion', type: 'varchar', length: 20, default: 'sorteo' })
  tipoAsignacion: 'sorteo' | 'manual_equipo' | 'directivo';

  @Column({ name: 'regla_asignacion', type: 'varchar', length: 20, default: 'normal' })
  reglaAsignacion: 'normal' | 'cierre_tres' | 'manual';

  @Column({ name: 'equipo_extractor_id', type: 'int', nullable: true })
  equipoExtractorId: number | null;

  @ManyToOne(() => Equipo, { eager: true, nullable: true })
  @JoinColumn({ name: 'equipo_extractor_id' })
  equipoExtractor: Equipo | null;

  @Column({ name: 'resultado_bolilla', type: 'varchar', length: 2, nullable: true })
  resultadoBolilla: 'si' | 'no' | null;

  @Column({ name: 'equipo_vocal_id', type: 'int', nullable: true })
  equipoVocalId: number | null;

  @ManyToOne(() => Equipo, { eager: true, nullable: true })
  @JoinColumn({ name: 'equipo_vocal_id' })
  equipoVocal: Equipo | null;

  @Column({ name: 'directivo_nombre', type: 'varchar', length: 200, nullable: true })
  directivoNombre: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: 'pendiente' | 'asignada' | 'confirmada';

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPor: number | null;

  @Column({ name: 'confirmado_en', type: 'timestamp', nullable: true })
  confirmadoEn: Date | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
