import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Liga } from '../../ligas/entities/liga.entity';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

/**
 * Entidad MovimientoTesoreria
 *
 * Caja general de ingresos y egresos que NO vienen de un partido específico.
 *
 * INGRESOS (tipo = 'ingreso'):
 *   - Cuota de inscripción al campeonato  → equipo_id obligatorio, origen_automatico = true
 *   - Emisión de carnets                  → equipo_id obligatorio, manual
 *   - Multa administrativa                → equipo_id opcional, manual
 *   - Derecho de apelación                → equipo_id opcional, manual
 *   - Otros ingresos                      → equipo_id opcional, manual
 *
 * EGRESOS (tipo = 'egreso'):
 *   - Pago a árbitros                     → equipo_id null, manual
 *   - Compra trofeos / premios            → equipo_id null, manual
 *   - Papelería / secretaría              → equipo_id null, manual
 *   - Fondo de accidentes (pago a jugador)→ equipo_id opcional, manual
 *   - Otros gastos                        → equipo_id null, manual
 *
 * ESTADO (solo relevante para ingresos de equipo):
 *   pendiente → el equipo aún no ha pagado
 *   pagado    → el tesorero confirmó el pago
 *   anulado   → movimiento anulado, no cuenta en el saldo
 *
 * origen_automatico = true indica que el sistema lo generó (ej: al aprobar inscripción).
 * Estos registros no se deben eliminar, solo anular.
 */
@Entity('movimiento_tesoreria')
export class MovimientoTesoreria {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Contexto ────────────────────────────────────────────────────────────

  @Column({ name: 'liga_id', type: 'int' })
  ligaId: number;

  @ManyToOne(() => Liga, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liga_id' })
  liga: Liga;

  @Column({ name: 'campeonato_id', type: 'int', nullable: true })
  campeonatoId: number | null;

  @ManyToOne(() => Campeonato, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato | null;

  /** Equipo relacionado. Null si es un gasto general de la liga. */
  @Column({ name: 'equipo_id', type: 'int', nullable: true })
  equipoId: number | null;

  @ManyToOne(() => Equipo, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'equipo_id' })
  equipo: Equipo | null;

  // ─── Clasificación ────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 10 })
  tipo: 'ingreso' | 'egreso';

  /**
   * Categoría del movimiento para agrupar en reportes.
   * Valores: inscripcion | carnets | multa_admin | pago_arbitro |
   *          premios | papeleria | fondo_accidentes | otro
   */
  @Column({ type: 'varchar', length: 30, default: 'otro' })
  categoria: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  // ─── Monto y estado ───────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monto: number;

  /**
   * Estado del movimiento.
   * Para egresos manuales se crea directamente como 'pagado'.
   * Para ingresos de equipo se crea como 'pendiente' hasta que el tesorero confirme.
   */
  @Column({ type: 'varchar', length: 20, default: 'pagado' })
  estado: 'pendiente' | 'pagado' | 'anulado';

  @Column({ name: 'fecha_vencimiento', type: 'date', nullable: true })
  fechaVencimiento: Date | null;

  @Column({ name: 'fecha_pago', type: 'date', nullable: true })
  fechaPago: Date | null;

  /** Número de recibo, factura o comprobante físico */
  @Column({ type: 'varchar', length: 100, nullable: true })
  comprobante: string | null;

  /**
   * true si fue generado automáticamente por el sistema
   * (ej: al aprobar la inscripción de un equipo).
   * false si fue registrado manualmente por el tesorero.
   */
  @Column({ name: 'origen_automatico', type: 'boolean', default: false })
  origenAutomatico: boolean;

  // ─── Auditoría ────────────────────────────────────────────────────────────

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPorId: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: Usuario | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
