import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';

/**
 * Entidad ConfigVocalia
 *
 * Almacena los valores fijos configurables del acta de vocalía por liga.
 * Reemplaza el array hardcodeado en acta-imprimir.component.ts.
 *
 * Cada liga puede tener sus propios montos. Si no hay config para una liga,
 * el frontend usa valores por defecto.
 *
 * Ejemplo de registros para una liga:
 *   orden 1 → "Valor Arbitraje"              $9.00
 *   orden 2 → "Aporte a la Liga"             $2.00
 *   orden 3 → "Valor Premios"                $2.00
 *   orden 4 → "Fondo de Accidentes"          $2.00
 *   orden 5 → "Limpieza y cuidado de baños"  $1.00
 */
@Entity('config_vocalia')
export class ConfigVocalia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monto: number;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
