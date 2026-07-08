import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';

export class CreateMovimientoTesoreriaDto {
  @IsNumber()
  @IsNotEmpty()
  ligaId: number;

  @IsOptional()
  @IsNumber()
  campeonatoId?: number;

  @IsOptional()
  @IsNumber()
  equipoId?: number;

  @IsIn(['ingreso', 'egreso'])
  tipo: 'ingreso' | 'egreso';

  @IsOptional()
  @IsIn([
    'inscripcion',
    'carnets',
    'multa_admin',
    'pago_arbitro',
    'premios',
    'papeleria',
    'fondo_accidentes',
    'otro',
  ])
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsNumber()
  @Min(0)
  monto: number;

  /** Para ingresos de equipo se recibe 'pendiente'; egresos van directo como 'pagado' */
  @IsOptional()
  @IsIn(['pendiente', 'pagado'])
  estado?: 'pendiente' | 'pagado';

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  comprobante?: string;
}
