import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { ProgramacionSemanal } from './programacion-semanal.entity';

/**
 * Combinación categoría/jornada incluida en una programación semanal.
 * categoriaId nulo se conserva únicamente para representar las sesiones
 * históricas que se crearon para "todas las categorías" de una jornada.
 */
@Entity('programacion_selecciones')
@Index('idx_programacion_selecciones_programacion', ['programacionId'])
@Index('uq_programacion_seleccion', ['programacionId', 'categoriaId', 'jornada'], { unique: true })
export class ProgramacionSeleccion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'programacion_id', type: 'int' })
  programacionId: number;

  @ManyToOne(() => ProgramacionSemanal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programacion_id' })
  programacion: ProgramacionSemanal;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @ManyToOne(() => Categoria, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;

  @Column({ type: 'int' })
  jornada: number;
}
