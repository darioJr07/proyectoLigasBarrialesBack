import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';

export class CreateGarantiaDto {
  @IsInt()
  @IsPositive()
  ligaId: number;

  @IsInt()
  @IsPositive()
  equipoId: number;

  @IsOptional()
  @IsPositive()
  @Min(1)
  monto?: number;
}
