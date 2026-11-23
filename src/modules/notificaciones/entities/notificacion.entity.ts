import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../auth/entities/usuario.entity';

@Entity('notificaciones')
@Index('idx_notificaciones_usuario_estado_fecha', ['usuarioId', 'leida', 'creadoEn'])
@Index('uq_notificaciones_usuario_clave', ['usuarioId', 'claveEvento'], { unique: true })
export class Notificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => Usuario, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'liga_id', type: 'int', nullable: true })
  ligaId: number | null;

  @Column({ name: 'equipo_id', type: 'int', nullable: true })
  equipoId: number | null;

  @Column({ type: 'varchar', length: 60 })
  tipo: string;

  @Column({ type: 'varchar', length: 160 })
  titulo: string;

  @Column({ type: 'varchar', length: 600 })
  mensaje: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  ruta: string | null;

  @Column({ name: 'referencia_tipo', type: 'varchar', length: 60, nullable: true })
  referenciaTipo: string | null;

  @Column({ name: 'referencia_id', type: 'int', nullable: true })
  referenciaId: number | null;

  @Column({ name: 'clave_evento', type: 'varchar', length: 180, nullable: true })
  claveEvento: string | null;

  @Column({ type: 'boolean', default: false })
  leida: boolean;

  @Column({ name: 'fecha_lectura', type: 'timestamp', nullable: true })
  fechaLectura: Date | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
