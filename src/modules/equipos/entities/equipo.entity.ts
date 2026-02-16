import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Entidad Equipo
 * Representa un equipo inscrito en una liga
 */
@Entity('equipos')
export class Equipo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  representante: string;

  @Column({ type: 'date', nullable: true })
  fundacion: Date;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen: string;

  @Column({ name: 'liga_id', type: 'int', nullable: true })
  ligaId: number | null;

  @ManyToOne(() => Liga, { eager: true })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'dirigente_id', type: 'int', nullable: true })
  dirigenteId: number | null;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'dirigente_id' })
  dirigente: Usuario;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
