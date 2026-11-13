import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegularizarReingresoDto {
  @IsInt()
  habilitacionOrigenId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivoReingreso: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  referenciaReingreso?: string;

  @IsDateString()
  @IsOptional()
  fechaBaja?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  motivoBaja?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  referenciaBaja?: string;
}
