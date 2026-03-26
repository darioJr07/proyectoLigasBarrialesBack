import { IsOptional, IsBoolean, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class UpdateReglaSancionDto {
  /** Literal del reglamento. Ej: "Art. 108 lit. A: Reincidir en falta estando amonestado" */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  acumulacionActiva?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  acumulacionCantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  partidosSuspension?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  puntosDescuento?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
