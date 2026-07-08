import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Usuario } from '../../auth/entities/usuario.entity';
import { DerramaEquipo } from './derrama-equipo.entity';

/**
 * Entidad Derrama
 *
 * Representa un gasto colectivo que se distribuye entre los equipos de un campeonato.
 *
 * TIPOS:
 *   monetaria → monto_unitario = monto fijo que paga cada equipo (ej: $14.28 por ayuda de $100 ÷ 7 equipos)
 *   unidades  → cada equipo elige cuántas unidades toma (rifas, platos)
 *               monto_total del equipo = cantidad × monto_unitario
 *
 * ESTADOS:
 *   activa  → aceptando pagos, se puede cobrar en vocalías
 *   cerrada → se cerró manualmente o al finalizar el campeonato
 */
@Entity('derrama')
export class Derrama {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  @ManyToOne(() => Campeonato, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ type: 'varchar', length: 200 })
  descripcion: string;

  /** 'monetaria' | 'unidades' */
  @Column({ type: 'varchar', length: 20, default: 'monetaria' })
  tipo: 'monetaria' | 'unidades';

  /** Precio por unidad (o monto fijo si tipo=monetaria y cantidad=1) */
  @Column({ name: 'monto_unitario', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoUnitario: number;

  /** 'activa' | 'cerrada' */
  @Column({ type: 'varchar', length: 20, default: 'activa' })
  estado: 'activa' | 'cerrada';

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPor: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por' })
  usuario: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  // Relación inversa — disponible para queries pero no se carga automáticamente (eager: false)
  @OneToMany(() => DerramaEquipo, (de) => de.derrama)
  equipos: DerramaEquipo[];
}
