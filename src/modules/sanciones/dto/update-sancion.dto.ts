import { IsOptional, IsString, IsBoolean, IsNumber, Min, MaxLength } from 'class-validator';

export class UpdateSancionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  partidosSuspension?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  partidosCumplidos?: number;

  @IsOptional()
  @IsBoolean()
  suspensionActiva?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
