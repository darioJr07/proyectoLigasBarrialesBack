import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMovimientoTesoreriaDto {
  @IsOptional()
  @IsIn(['pendiente', 'pagado', 'anulado'])
  estado?: 'pendiente' | 'pagado' | 'anulado';

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  comprobante?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
