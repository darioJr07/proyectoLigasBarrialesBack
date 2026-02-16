import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Jugador } from '../../jugadores/entities/jugador.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

@Entity('transferencias')
export class Transferencia {
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

  @Column({ name: 'equipo_origen_id' })
  equipoOrigenId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_origen_id' })
  equipoOrigen: Equipo;

  @Column({ name: 'equipo_destino_id' })
  equipoDestinoId: number;

  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_destino_id' })
  equipoDestino: Equipo;

  @CreateDateColumn({ name: 'fecha_solicitud' })
  fechaSolicitud: Date;

  @Column({
    name: 'estado_equipo_origen',
    type: 'enum',
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente',
  })
  estadoEquipoOrigen: string;

  @Column({
    name: 'estado_directivo',
    type: 'enum',
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente',
  })
  estadoDirectivo: string;

  @Column({ name: 'solicitado_por' })
  solicitadoPor: number;

  @ManyToOne(() => Usuario, { eager: false })
  @JoinColumn({ name: 'solicitado_por' })
  solicitadoPorUsuario: Usuario;

  @Column({ name: 'aprobado_por_origen', nullable: true })
  aprobadoPorOrigen: number;

  @ManyToOne(() => Usuario, { eager: false, nullable: true })
  @JoinColumn({ name: 'aprobado_por_origen' })
  aprobadoPorOrigenUsuario: Usuario;

  @Column({ name: 'fecha_aprobacion_origen', nullable: true })
  fechaAprobacionOrigen: Date;

  @Column({ name: 'aprobado_por_directivo', nullable: true })
  aprobadoPorDirectivo: number;

  @ManyToOne(() => Usuario, { eager: false, nullable: true })
  @JoinColumn({ name: 'aprobado_por_directivo' })
  aprobadoPorDirectivoUsuario: Usuario;

  @Column({ name: 'fecha_aprobacion_directivo', nullable: true })
  fechaAprobacionDirectivo: Date;

  @Column({ length: 500, nullable: true })
  observaciones: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
