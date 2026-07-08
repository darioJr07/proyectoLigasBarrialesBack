import {
  IsIn,
  IsOptional,
  IsInt,
  Min,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';

/**
 * DTO para que el Tribunal de Penas resuelva una incidencia.
 *
 * El tribunal puede:
 *   - 'sancionar' → se crea una Sancion en el módulo de sanciones
 *   - 'absolver'  → la incidencia se cierra sin sanción
 *
 * Cuando decision='sancionar', tipoSancionId es obligatorio.
 * Si partidosSuspension=0, es una amonestación/multa sin quitar partidos.
 */
export class ResolverIncidenciaDto {
  @IsIn(['sancionar', 'absolver'])
  decision: 'sancionar' | 'absolver';

  /** Obligatorio cuando decision='sancionar'. */
  @IsOptional()
  @IsInt()
  tipoSancionId?: number;

  /** Regla específica del reglamento que fundamenta la sanción (opcional). */
  @IsOptional()
  @IsInt()
  reglaSancionId?: number;

  /** Partidos de suspensión. 0 = sanción sin suspensión (amonestación/multa). */
  @IsOptional()
  @IsInt()
  @Min(0)
  partidosSuspension?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  /** Notas del tribunal al momento de resolver. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionesTribunal?: string;

  /** Fecha de la sanción. Por defecto, la fecha actual. */
  @IsOptional()
  @IsDateString()
  fechaSancion?: string;

  /** Inicio de suspensión por tiempo (modoCastigo = 'tiempo'). */
  @IsOptional()
  @IsDateString()
  fechaInicioSuspension?: string;

  /** Fin de suspensión por tiempo (modoCastigo = 'tiempo'). */
  @IsOptional()
  @IsDateString()
  fechaFinSuspension?: string;

  /**
   * Monto de multa económica aprobado por el tribunal.
   * Si se envía y es > 0, la sanción queda con estado_cobro='aprobada'
   * y se cobrará en la próxima vocalía.
   */
  @IsOptional()
  montoMulta?: number;
}
