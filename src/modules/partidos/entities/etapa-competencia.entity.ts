import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { EtapaGrupo } from './etapa-grupo.entity';

export type FormatoEtapa = 'tabla_unica' | 'grupos_cruce_descansos';
export type EstadoEtapa = 'pendiente' | 'actual' | 'finalizada';

@Entity('etapas_competencia')
@Unique('uq_etapa_competencia_nombre', ['campeonatoId', 'categoriaId', 'nombre'])
export class EtapaCompetencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'categoria_id', type: 'int' })
  categoriaId: number;

  @ManyToOne(() => Categoria, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'int', default: 1 })
  orden: number;

  @Column({ type: 'varchar', length: 40, default: 'tabla_unica' })
  formato: FormatoEtapa;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: EstadoEtapa;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => EtapaGrupo, (grupo) => grupo.etapa)
  grupos: EtapaGrupo[];

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
