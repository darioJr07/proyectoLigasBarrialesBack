import { IsNumber, IsNotEmpty, IsOptional, IsBoolean, IsString, MaxLength, Min } from 'class-validator';

export class CreateReglaSancionDto {
  @IsNumber()
  @IsNotEmpty()
  ligaId: number;

  @IsOptional()
  @IsNumber()
  campeonatoId?: number;

  @IsNumber()
  @IsNotEmpty()
  tipoSancionId: number;

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
}
