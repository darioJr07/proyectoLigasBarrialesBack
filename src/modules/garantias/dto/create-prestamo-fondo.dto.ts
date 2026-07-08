import { IsInt, IsPositive, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreatePrestamoFondoDto {
  @IsInt()
  @IsPositive()
  ligaId: number;

  @IsPositive()
  monto: number;

  @IsString()
  @MaxLength(500)
  motivo: string;

  /**
   * Campeonato activo donde se registrará el INGRESO en la caja.
   * Si no se especifica, el movimiento queda sin campeonato asociado.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  campeonatoId?: number;
}
