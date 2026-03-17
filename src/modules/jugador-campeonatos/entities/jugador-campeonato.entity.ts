import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Jugador } from '../../jugadores/entities/jugador.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

@Entity('jugador_campeonatos')
// Nota: se permite más de un registro por jugador/campeonato para historial de transferencias
export class JugadorCampeonato {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'jugador_id' })
  jugadorId: number;

  @ManyToOne(() => Jugador, { eager: true })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador;

  @Column({ name: 'campeonato_id' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: true })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'equipo_id' })
  equipoId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo;

  @Column({ name: 'categoria_id' })
  categoriaId: number;

  @ManyToOne(() => Categoria, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @Column({ name: 'numero_cancha' })
  numeroCancha: number;

  @Column({ length: 50 })
  posicion: string;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'habilitado', 'rechazado', 'baja'],
    default: 'pendiente',
  })
  estado: string;

  @Column({ name: 'solicitado_por', type: 'int', nullable: true })
  solicitadoPor: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true })
  @JoinColumn({ name: 'solicitado_por' })
  solicitadoPorUsuario: Usuario;

  @Column({ name: 'aprobado_por', type: 'int', nullable: true })
  aprobadoPor: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true })
  @JoinColumn({ name: 'aprobado_por' })
  aprobadoPorUsuario: Usuario;

  @Column({ name: 'fecha_aprobacion', type: 'timestamp', nullable: true })
  fechaAprobacion: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ name: 'fecha_inscripcion' })
  fechaInscripcion: Date;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
