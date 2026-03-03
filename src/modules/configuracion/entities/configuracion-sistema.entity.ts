import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad para la configuración global del sistema
 * Permite habilitar/deshabilitar módulos para dirigentes de equipo
 */
@Entity('configuracion_sistema')
export class ConfiguracionSistema {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  clave: string;

  @Column({ type: 'varchar', length: 10, default: 'true' })
  valor: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
