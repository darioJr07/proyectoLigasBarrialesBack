import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class RegistrarCambioDorsalDto {
  @IsInt()
  etapaCompetenciaId: number;

  @IsInt()
  @Min(1)
  @Max(99)
  numeroCancha: number;

  @IsInt()
  @Min(1)
  @Max(3)
  jornadaDesde: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}
