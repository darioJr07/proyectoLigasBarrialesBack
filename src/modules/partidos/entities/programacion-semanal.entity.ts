import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('programaciones_semanales')
export class ProgramacionSemanal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  /** Nulo significa que la sesión incluye todas las categorías. */
  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @Column({ type: 'varchar', length: 50 })
  etapa: string;

  @Column({ type: 'int' })
  jornada: number;

  @Column({ name: 'total_partidos', type: 'int' })
  totalPartidos: number;

  @Column({ type: 'varchar', length: 20, default: 'borrador' })
  estado: 'borrador' | 'en_sorteo' | 'confirmada' | 'cancelada';

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPor: number | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @Column({ name: 'confirmado_en', type: 'timestamp', nullable: true })
  confirmadoEn: Date | null;
}
