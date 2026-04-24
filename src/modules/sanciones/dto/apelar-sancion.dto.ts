import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * DTO para apelar/reemplazar una sanción existente.
 *
 * El servicio:
 *   1. Anula la sanción original (activo=false, suspensionActiva=false).
 *   2. Crea una nueva sanción heredando jugador/equipo/campeonato/partido
 *      de la original, más los partidos ya cumplidos.
 *   3. Vincula origenSancionId a la sanción original para trazabilidad.
 */
export class ApelarSancionDto {
  /** Nuevo tipo de sanción que resuelve la apelación */
  @IsNumber()
  @IsNotEmpty()
  tipoSancionId: number;

  /** Regla de reglamento aplicada (opcional) */
  @IsOptional()
  @IsNumber()
  reglaSancionId?: number;

  /** Partidos de suspensión de la nueva sanción */
  @IsOptional()
  @IsNumber()
  @Min(0)
  partidosSuspension?: number;

  /** Descripción o motivo de la resolución de la apelación */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  /** Fecha de la nueva sanción (por defecto la fecha actual) */
  @IsOptional()
  @IsDateString()
  fechaSancion?: string;

  /** Fecha de inicio de suspensión por tiempo (modoCastigo = 'tiempo') */
  @IsOptional()
  @IsDateString()
  fechaInicioSuspension?: string;

  /** Fecha de fin de suspensión por tiempo (modoCastigo = 'tiempo') */
  @IsOptional()
  @IsDateString()
  fechaFinSuspension?: string;
}
