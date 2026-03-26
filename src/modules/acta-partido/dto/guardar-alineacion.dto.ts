import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { ActaAlineacionJugadorDto } from './acta-alineacion-jugador.dto';

/**
 * DTO para guardar la alineación completa de un partido (ambos equipos).
 * Se envía una sola vez con todos los jugadores de los dos equipos.
 */
export class GuardarAlineacionDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ActaAlineacionJugadorDto)
  jugadores?: ActaAlineacionJugadorDto[];
}
