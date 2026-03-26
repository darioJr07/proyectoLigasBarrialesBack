import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Un ítem de incidencia dentro del informe del vocal.
 * Representa UN hecho disciplinario ocurrido en el partido.
 */
export class IncidenciaItemDto {
  @IsInt()
  equipoId: number;

  /** ID del jugador involucrado. Omitir para incidencias colectivas del equipo. */
  @IsOptional()
  @IsInt()
  jugadorId?: number;

  @IsIn([
    'tarjeta_amarilla',
    'tarjeta_roja',
    'doble_amarilla',
    'expulsion_directa',
    'incidencia_grave',
    'otro',
  ])
  tipoIncidencia: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  minuto?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

/**
 * DTO para que el vocal guarde el informe del partido.
 *
 * IMPORTANTE: Solo registra HECHOS — el Tribunal de Penas es quien
 * decide las sanciones al revisar el informe. Este DTO NO crea sanciones.
 *
 * Si enviarATribunal=true, el informe pasa a estado 'enviado_tribunal'
 * y el tribunal puede comenzar a procesar las incidencias.
 */
export class GuardarInformePartidoDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacionesVocal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreArbitro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacionesArbitro?: string;

  /** Nombre del vocal (texto libre: equipo, jugador, directivo, etc.) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vocalNombre?: string;

  /** ID del equipo al que pertenece el vocal (para trazabilidad/sanciones) */
  @IsOptional()
  @IsInt()
  vocalEquipoId?: number;

  /**
   * Si true → cambia el estado del informe a 'enviado_tribunal'.
   * Solo puede avanzar de estado, no retroceder (borrador → enviado_tribunal).
   */
  @IsOptional()
  @IsBoolean()
  enviarATribunal?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncidenciaItemDto)
  incidencias: IncidenciaItemDto[];
}
