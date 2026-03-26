import {
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

/**
 * DTO para registrar un gol individual de un partido.
 *
 * Se usa dentro del array 'autoresGoles' al registrar el resultado.
 *
 * AUTOGOLES: se envía el jugador que lo hizo (para estadísticas propias),
 * pero el service asigna el equipo contrario como beneficiario.
 */
export class CreateGolDto {
  /**
   * ID del jugador que anotó.
   */
  @IsNumber()
  @IsNotEmpty()
  jugadorId: number;

  /**
   * ID del equipo al que pertenece el jugador.
   * El service determinará a qué equipo beneficia el gol
   * dependiendo del tipo (normal/penal vs autogol).
   */
  @IsNumber()
  @IsNotEmpty()
  equipoDelJugadorId: number;

  /**
   * Minuto del gol. Opcional.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  minuto?: number;

  /**
   * Tipo de gol.
   */
  @IsOptional()
  @IsIn(['normal', 'penal', 'autogol'])
  tipo?: 'normal' | 'penal' | 'autogol';
}
