import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Entidad Liga
 * Representa una liga de fútbol barrial
 * Aplica el principio de Encapsulación: los datos están protegidos
 */
@Entity('ligas')
export class Liga {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 200 })
  ubicacion: string;

  @Column({ name: 'fecha_fundacion', type: 'date' })
  fechaFundacion: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string;

  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'directivo_id' })
  directivo: Usuario;

  @Column({ name: 'directivo_id', nullable: true })
  directivoId: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
