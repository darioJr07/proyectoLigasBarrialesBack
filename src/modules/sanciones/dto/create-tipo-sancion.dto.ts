import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, IsBoolean, MaxLength, Min } from 'class-validator';

export class CreateTipoSancionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsIn(['jugador', 'equipo', 'directivo', 'barra'])
  aplicaA?: string;

  @IsOptional()
  @IsNumber()
  ligaId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMulta?: number;
}
