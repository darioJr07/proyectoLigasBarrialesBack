import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../auth/entities/usuario.entity';
import { EtapaCompetencia } from '../../partidos/entities/etapa-competencia.entity';
import { JugadorCampeonato } from './jugador-campeonato.entity';

@Entity('jugador_campeonato_cambios_dorsal')
export class CambioDorsalEtapa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'jugador_campeonato_id', type: 'int' })
  jugadorCampeonatoId: number;

  @ManyToOne(() => JugadorCampeonato, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jugador_campeonato_id' })
  jugadorCampeonato: JugadorCampeonato;

  @Column({ name: 'etapa_competencia_id', type: 'int' })
  etapaCompetenciaId: number;

  @ManyToOne(() => EtapaCompetencia, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'etapa_competencia_id' })
  etapa: EtapaCompetencia;

  @Column({ name: 'numero_cancha', type: 'int' })
  numeroCancha: number;

  @Column({ name: 'jornada_desde', type: 'int' })
  jornadaDesde: number;

  @Column({ type: 'varchar', length: 500 })
  motivo: string;

  @Column({ name: 'registrado_por', type: 'int', nullable: true })
  registradoPor: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registrado_por' })
  registradoPorUsuario: Usuario | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'anulado_por', type: 'int', nullable: true })
  anuladoPor: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'anulado_por' })
  anuladoPorUsuario: Usuario | null;

  @Column({ name: 'fecha_anulacion', type: 'timestamp', nullable: true })
  fechaAnulacion: Date | null;

  @Column({ name: 'motivo_anulacion', type: 'varchar', length: 500, nullable: true })
  motivoAnulacion: string | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
