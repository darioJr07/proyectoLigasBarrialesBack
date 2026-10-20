import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EtapaGrupoEquipo } from './etapa-grupo-equipo.entity';

@Entity('etapas_grupos_bonificaciones')
export class EtapaGrupoBonificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'grupo_equipo_id', type: 'int' })
  grupoEquipoId: number;

  @ManyToOne(() => EtapaGrupoEquipo, (grupoEquipo) => grupoEquipo.bonificaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_equipo_id' })
  grupoEquipo: EtapaGrupoEquipo;

  @Column({ type: 'int' })
  puntos: number;

  @Column({ name: 'etapa_origen', type: 'varchar', length: 50, nullable: true })
  etapaOrigen: string | null;

  @Column({ name: 'posicion_origen', type: 'int', nullable: true })
  posicionOrigen: number | null;

  @Column({ type: 'varchar', length: 250 })
  motivo: string;

  @Column({ name: 'creado_por_id', type: 'int', nullable: true })
  creadoPorId: number | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
