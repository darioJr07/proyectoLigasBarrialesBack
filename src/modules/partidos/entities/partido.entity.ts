import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campeonato } from '../../campeonatos/entities/campeonato.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Equipo } from '../../equipos/entities/equipo.entity';

/**
 * Entidad Partido
 *
 * Representa un partido entre dos equipos dentro de un campeonato y categoría.
 *
 * CAMPO CLAVE: etapa
 *   - Permite manejar múltiples etapas del torneo de forma flexible.
 *   - Ejemplos: 'primera_etapa', 'liguilla', 'final', etc.
 *   - Puedes agregar nuevas etapas sin modificar el código, solo configurando los datos.
 *
 * CAMPO CLAVE: jornada
 *   - Número de fecha/jornada dentro de la etapa.
 *   - Ejemplo: Jornada 1, Jornada 2... en la primera etapa todos contra todos.
 *
 * CAMPOS DE RESULTADO:
 *   - golesLocal y golesVisitante: se llenan cuando el partido es jugado.
 *   - bonificacionLocal y bonificacionVisitante: puntos extra configurables
 *     (útil para la liguilla o primera etapa con bonificaciones).
 *
 * RELACIONES:
 *   - campeonato: cada partido pertenece a un campeonato específico.
 *   - categoria: define en qué categoría (Máxima, Primera, etc.) se juega.
 *   - equipoLocal / equipoVisitante: los dos equipos que se enfrentan.
 *     Ambos ya deben estar inscritos en el campeonato.
 */
@Entity('partidos')
export class Partido {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Relaciones con entidades ya existentes ───────────────────────────────

  @Column({ name: 'campeonato_id', type: 'int' })
  campeonatoId: number;

  /**
   * Campeonato al que pertenece el partido.
   * eager: true → se carga automáticamente sin necesidad de join manual.
   */
  @ManyToOne(() => Campeonato, { eager: true })
  @JoinColumn({ name: 'campeonato_id' })
  campeonato: Campeonato;

  @Column({ name: 'categoria_id', type: 'int' })
  categoriaId: number;

  /**
   * Categoría (Máxima, Primera, etc.) donde se juega el partido.
   */
  @ManyToOne(() => Categoria, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @Column({ name: 'equipo_local_id', type: 'int' })
  equipoLocalId: number;

  @Column({ name: 'equipo_local_orden', type: 'int', nullable: true })
  equipoLocalOrden: number | null;

  /**
   * Equipo que juega como local.
   */
  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_local_id' })
  equipoLocal: Equipo;

  @Column({ name: 'equipo_visitante_id', type: 'int' })
  equipoVisitanteId: number;

  @Column({ name: 'equipo_visitante_orden', type: 'int', nullable: true })
  equipoVisitanteOrden: number | null;

  /**
   * Equipo que juega como visitante.
   */
  @ManyToOne(() => Equipo, { eager: true })
  @JoinColumn({ name: 'equipo_visitante_id' })
  equipoVisitante: Equipo;

  // ─── Datos del partido ────────────────────────────────────────────────────

  /**
   * Etapa del torneo. Ejemplos: 'primera_etapa', 'liguilla', 'final'.
   * Flexible: se puede configurar sin cambiar código.
   */
  @Column({ type: 'varchar', length: 50, default: 'primera_etapa' })
  etapa: string;

  /**
   * Número de jornada o fecha dentro de la etapa.
   * Ej: 1, 2, 3... para el torneo todos contra todos.
   */
  @Column({ type: 'int' })
  jornada: number;

  /**
   * Fecha programada para el partido.
   */
  @Column({ name: 'fecha_partido', type: 'date', nullable: true })
  fechaPartido: Date;

  /**
   * Hora programada. Se guarda como texto (ej: "15:30").
   */
  @Column({ name: 'hora_partido', type: 'varchar', length: 10, nullable: true })
  horaPartido: string;

  /**
   * Cancha o lugar donde se jugará. Opcional.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  cancha: string;

  // ─── Estado del partido ───────────────────────────────────────────────────

  /**
   * Estado del partido:
   * - programado: está en el fixture pero no se ha jugado.
   * - jugado: ya tiene resultado.
   * - suspendido: fue suspendido temporalmente.
   * - cancelado: cancelado definitivamente.
   */
  @Column({ type: 'varchar', length: 20, default: 'programado' })
  estado: 'programado' | 'jugado' | 'suspendido' | 'cancelado';

  // ─── Resultado ────────────────────────────────────────────────────────────

  /**
   * Goles del equipo local. Null hasta que se registre el resultado.
   */
  @Column({ name: 'goles_local', type: 'int', nullable: true })
  golesLocal: number;

  /**
   * Goles del equipo visitante. Null hasta que se registre el resultado.
   */
  @Column({ name: 'goles_visitante', type: 'int', nullable: true })
  golesVisitante: number;

  /**
   * Puntos extra para el equipo local.
   * Útil para bonificaciones en liguilla o primera etapa.
   * Ejemplo: los 3 primeros de Máxima bonifican puntos para la liguilla.
   */
  @Column({ name: 'bonificacion_local', type: 'int', nullable: true, default: 0 })
  bonificacionLocal: number;

  /**
   * Puntos extra para el equipo visitante.
   */
  @Column({ name: 'bonificacion_visitante', type: 'int', nullable: true, default: 0 })
  bonificacionVisitante: number;

  /**
   * Sanción administrativa al equipo local o visitante.
   * - 'ninguno': sin sanción.
   * - 'local': el local pierde los puntos del partido (0 pts), el visitante recibe 3 pts.
   * - 'visitante': el visitante pierde los puntos del partido (0 pts), el local recibe 3 pts.
   * Los goles no se modifican: la diferencia de gol se preserva.
   */
  @Column({ name: 'sancionado', type: 'varchar', length: 20, default: 'ninguno' })
  sancionado: 'ninguno' | 'local' | 'visitante';

  /**
   * Observaciones o notas del partido. Ej: "partido suspendido por lluvia".
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string;

  // ─── Auditoría ────────────────────────────────────────────────────────────

  /**
   * Soft delete: si activo=false no aparece en listados normales.
   * Se usa en lugar de eliminar físicamente el registro.
   */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  /**
   * Fecha de creación automática del registro.
   */
  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
