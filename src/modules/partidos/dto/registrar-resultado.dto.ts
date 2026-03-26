import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateGolDto } from '../../goles/dto/create-gol.dto';

/**
 * DTO para registrar el resultado de un partido jugado.
 *
 * Solo se necesitan los goles de cada equipo para registrar el resultado.
 * Las bonificaciones son opcionales (solo para partidos con bonificación).
 */
export class RegistrarResultadoDto {
  /**
   * Goles marcados por el equipo local. Mínimo 0.
   */
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  golesLocal: number;

  /**
   * Goles marcados por el equipo visitante. Mínimo 0.
   */
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  golesVisitante: number;

  /**
   * Puntos extra para el equipo local (opcional).
   * Útil para bonificaciones de primera etapa o liguilla.
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  bonificacionLocal?: number;

  /**
   * Puntos extra para el equipo visitante (opcional).
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  bonificacionVisitante?: number;

  /**
   * Observaciones del partido. Ej: "Partido suspendido por lluvia".
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  observaciones?: string;

  /**
   * Sanción administrativa.
   * - 'ninguno': sin sanción (por defecto).
   * - 'local': el equipo local es sancionado (pierde puntos, rival obtiene 3).
   * - 'visitante': el equipo visitante es sancionado.
   */
  @IsIn(['ninguno', 'local', 'visitante'])
  @IsOptional()
  sancionado?: 'ninguno' | 'local' | 'visitante';

  /**
   * Autores de los goles del partido (opcional).
   * Si se envían, deben coincidir con el marcador (golesLocal + golesVisitante).
   * Si no se envían, el marcador se guarda pero sin detalle de goleadores.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGolDto)
  autoresGoles?: CreateGolDto[];
}
