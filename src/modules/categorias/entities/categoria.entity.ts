import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Inscripcion } from '../../inscripciones/entities/inscripcion.entity';

/**
 * Entidad Categoria
 * Representa una división dentro de un campeonato
 * Ejemplos: "Máxima", "Primera", "Segunda", "Reserva"
 * Con configuración de ascensos y descensos
 */
@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, (campeonato) => campeonato.categorias, {
    eager: true,
  })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ type: 'int', comment: 'Orden jerárquico: 1=Máxima, 2=Primera, etc.' })
  orden: number;

  @Column({
    name: 'equipos_ascienden',
    type: 'int',
    default: 0,
    comment: 'Número de equipos que ascienden a categoría superior',
  })
  equiposAscienden: number;

  @Column({
    name: 'equipos_descienden',
    type: 'int',
    default: 0,
    comment: 'Número de equipos que descienden a categoría inferior',
  })
  equiposDescienden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  // Relación con inscripciones
  @OneToMany(() => Inscripcion, (inscripcion) => inscripcion.categoria)
  inscripciones: Inscripcion[];
}
