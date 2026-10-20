import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EtapaCompetencia } from './etapa-competencia.entity';
import { EtapaGrupoEquipo } from './etapa-grupo-equipo.entity';

@Entity('etapas_grupos')
@Unique('uq_etapa_grupo_nombre', ['etapaCompetenciaId', 'nombre'])
export class EtapaGrupo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'etapa_competencia_id', type: 'int' })
  etapaCompetenciaId: number;

  @ManyToOne(() => EtapaCompetencia, (etapa) => etapa.grupos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'etapa_competencia_id' })
  etapa: EtapaCompetencia;

  @Column({ type: 'varchar', length: 40 })
  nombre: string;

  @Column({ type: 'int', default: 1 })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => EtapaGrupoEquipo, (miembro) => miembro.grupo)
  equipos: EtapaGrupoEquipo[];
}
