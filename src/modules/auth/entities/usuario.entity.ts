import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Rol } from './rol.entity';
import { Exclude } from 'class-transformer';

/**
 * Entidad Usuario
 * Representa a los usuarios del sistema
 * Aplica el principio de Encapsulación: la contraseña está protegida con @Exclude
 */
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Exclude() // No incluir la contraseña en las respuestas JSON
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @ManyToOne(() => Rol, (rol) => rol.usuarios, { eager: true })
  @JoinColumn({ name: 'rol_id' })
  rol: Rol;

  @Column({ name: 'liga_id', type: 'int', nullable: true })
  ligaId?: number | null;

  @Column({ name: 'equipo_id', type: 'int', nullable: true })
  equipoId?: number | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
