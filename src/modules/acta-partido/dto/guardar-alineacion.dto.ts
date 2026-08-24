import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { ActaAlineacionJugadorDto } from './acta-alineacion-jugador.dto';

/**
 * DTO para guardar la alineación completa de un partido (ambos equipos).
 * Se envía una sola vez con todos los jugadores de los dos equipos.
 */
export class GuardarAlineacionDto {
  /** Confirmación explícita requerida para corregir la plantilla de un partido jugado. */
  @IsBoolean()
  @IsOptional()
  permitirCorreccion?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ActaAlineacionJugadorDto)
  jugadores?: ActaAlineacionJugadorDto[];
}
