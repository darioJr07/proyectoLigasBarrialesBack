import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class IniciarOperacionTesoreriaDto {
  @IsNumber()
  @IsNotEmpty()
  ligaId: number;

  @IsNumber()
  @IsNotEmpty()
  campeonatoId: number;

  @IsDateString()
  fechaInicio: string;

  @IsNumber()
  @Min(0)
  saldoInicial: number;

  @IsOptional()
  @IsIn(['caja_nueva', 'manual', 'traslado'])
  origenSaldo?: 'caja_nueva' | 'manual' | 'traslado';

  @IsOptional()
  @IsNumber()
  campeonatoOrigenId?: number;
}
