import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Equipo } from '../../equipos/entities/equipo.entity';

/**
 * Entidad Jugador
 * Representa un jugador que puede ser inscrito en equipos
 */
@Entity('jugadores')
export class Jugador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  // Propiedad virtual para compatibilidad con frontend
  get nombreCompleto(): string {
    return this.nombre;
  }

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  cedula: string;

  @Column({ name: 'tipo_documento', type: 'varchar', length: 20, default: 'Cédula' })
  tipoDocumento: string;

  @Column({ name: 'equipo_id', type: 'int', nullable: true })
  equipoId: number | null;

  @ManyToOne(() => Equipo, { eager: true, nullable: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen: string;

  // Propiedad virtual para compatibilidad con frontend
  get fotoPerfil(): string {
    return this.imagen;
  }

  @Column({ name: 'imagen_cedula', type: 'varchar', length: 500, nullable: true })
  imagenCedula: string;

  @Column({ name: 'numero_cancha', type: 'int', nullable: true })
  numeroCancha: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  posicion: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
