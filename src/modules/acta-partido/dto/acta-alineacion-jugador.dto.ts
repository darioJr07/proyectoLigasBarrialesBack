import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Datos de un jugador dentro de la planilla de alineación.
 */
export class ActaAlineacionJugadorDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El jugador es obligatorio' })
  jugadorId: number;

  @IsNumber()
  @IsNotEmpty({ message: 'El equipo es obligatorio' })
  equipoId: number;

  /**
   * jugo        → participó normalmente
   * no_jugo     → no fue convocado / no apareció
   * suspendido  → tenía sanción activa
   * ausente     → justificó su ausencia
   * lesionado   → no jugó por lesión
   * expulsado   → fue expulsado durante el partido
   */
  @IsIn(['jugo', 'no_jugo', 'suspendido', 'ausente', 'lesionado', 'expulsado'])
  @IsOptional()
  estado?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  @IsOptional()
  numeroCancha?: number;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  observaciones?: string;
}
