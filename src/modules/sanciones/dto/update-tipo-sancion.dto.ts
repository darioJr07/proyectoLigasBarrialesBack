import { IsString, IsOptional, IsIn, IsNumber, IsBoolean, MaxLength } from 'class-validator';

export class UpdateTipoSancionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsIn(['jugador', 'equipo', 'directivo', 'barra'])
  aplicaA?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
