import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { EtapaGrupo } from './etapa-grupo.entity';
import { EtapaGrupoBonificacion } from './etapa-grupo-bonificacion.entity';

@Entity('etapas_grupos_equipos')
@Unique('uq_etapa_grupo_equipo', ['grupoId', 'equipoId'])
export class EtapaGrupoEquipo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'grupo_id', type: 'int' })
  grupoId: number;

  @ManyToOne(() => EtapaGrupo, (grupo) => grupo.equipos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_id' })
  grupo: EtapaGrupo;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ type: 'int', default: 1 })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => EtapaGrupoBonificacion, (bonificacion) => bonificacion.grupoEquipo)
  bonificaciones: EtapaGrupoBonificacion[];
}
