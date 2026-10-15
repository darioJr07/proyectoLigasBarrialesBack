import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCierreCajaTesoreriaDto {
  @IsInt()
  ligaId: number;

  @IsInt()
  campeonatoId: number;

  @IsIn(['conciliacion', 'cierre_definitivo'])
  tipo: 'conciliacion' | 'cierre_definitivo';

  @IsDateString()
  fechaCorte: string;

  @IsNumber()
  @Min(0)
  saldoContado: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
