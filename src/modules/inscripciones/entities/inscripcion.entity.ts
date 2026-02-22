import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';

/**
 * Entidad Inscripcion
 * Representa la inscripción de un equipo a una categoría de un campeonato
 * Un equipo solo puede inscribirse una vez por campeonato
 */
@Entity('inscripciones')
@Index('idx_campeonato_equipo', ['campeonatoId', 'equipoId'], { unique: true })
export class Inscripcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: true })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'categoria_id', type: 'int' })
  categoriaId: number;

  @ManyToOne(() => Categoria, (categoria) => categoria.inscripciones, {
    eager: true,
  })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @Column({ name: 'equipo_id', type: 'int' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ 
    name: 'fecha_inscripcion', 
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP'
  })
  fechaInscripcion: Date;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'pendiente',
  })
  estado: 'pendiente' | 'confirmada' | 'rechazada';

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
