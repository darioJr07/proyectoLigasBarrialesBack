import { IsNumber, IsNotEmpty, IsOptional, IsBoolean, IsString, IsIn, MaxLength, Min } from 'class-validator';

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

  /** 'partidos' (default) o 'tiempo' */
  @IsOptional()
  @IsString()
  @IsIn(['partidos', 'tiempo'])
  modoCastigo?: 'partidos' | 'tiempo';

  /** Duración en meses cuando modoCastigo = 'tiempo'. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  duracionMeses?: number;

  /** Monto de multa económica por cada sanción de este tipo (ej: 2.50). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMulta?: number;
}
