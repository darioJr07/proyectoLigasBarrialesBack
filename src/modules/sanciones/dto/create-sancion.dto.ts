import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSancionDto {
  @IsNumber()
  @IsNotEmpty()
  tipoSancionId: number;

  @IsNumber()
  @IsNotEmpty()
  ligaId: number;

  @IsNumber()
  @IsNotEmpty()
  campeonatoId: number;

  @IsOptional()
  @IsNumber()
  categoriaId?: number;

  /** Partido donde ocurrió (opcional para sanciones fuera de partido) */
  @IsOptional()
  @IsNumber()
  partidoId?: number;

  /** Jugador sancionado (opcional para sanciones a equipo/barra) */
  @IsOptional()
  @IsNumber()
  jugadorId?: number;

  /** Equipo sancionado (opcional para sanciones individuales) */
  @IsOptional()
  @IsNumber()
  equipoId?: number;

  /** Regla específica del reglamento que justifica esta sanción (opcional) */
  @IsOptional()
  @IsNumber()
  reglaSancionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  /** Partidos de suspensión asignados manualmente (si no viene de regla automática) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  partidosSuspension?: number;

  @IsOptional()
  @IsBoolean()
  suspensionActiva?: boolean;

  @IsOptional()
  @IsDateString()
  fechaSancion?: string;

  /** Fecha de inicio de suspensión por tiempo (modoCastigo = 'tiempo'). */
  @IsOptional()
  @IsDateString()
  fechaInicioSuspension?: string;

  /** Fecha de fin de suspensión por tiempo (modoCastigo = 'tiempo'). */
  @IsOptional()
  @IsDateString()
  fechaFinSuspension?: string;
}
