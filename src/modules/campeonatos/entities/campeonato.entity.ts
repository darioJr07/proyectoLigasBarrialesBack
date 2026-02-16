import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';

/**
 * Entidad Campeonato
 * Representa un torneo o campeonato dentro de una liga
 * Ejemplos: "Torneo Apertura 2026", "Copa de Verano", "Clausura 2026"
 */
@Entity('campeonatos')
export class Campeonato {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: Date;

  @Column({ name: 'fecha_limite_inscripcion', type: 'date' })
  fechaLimiteInscripcion: Date;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'inscripcion_abierta',
  })
  estado: 'inscripcion_abierta' | 'en_curso' | 'finalizado' | 'cancelado';

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  // Relación con categorías
  @OneToMany(() => Categoria, (categoria) => categoria.campeonato)
  categorias: Categoria[];
}
