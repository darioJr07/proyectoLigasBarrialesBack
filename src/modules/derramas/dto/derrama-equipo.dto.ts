import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Un ítem de asignación por equipo al crear/actualizar una derrama */
export class AsignacionEquipoDto {
  @IsInt()
  equipoId: number;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsEnum(['inmediato', 'por_vocalia'])
  modoPago: 'inmediato' | 'por_vocalia';
}

/** Asigna (o reasigna) equipos a una derrama con sus cantidades y modo de pago */
export class AsignarEquiposDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionEquipoDto)
  equipos: AsignacionEquipoDto[];
}

/** Actualiza cantidad o modo de pago de un equipo individual */
export class ActualizarDerramaEquipoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsEnum(['inmediato', 'por_vocalia'])
  modoPago?: 'inmediato' | 'por_vocalia';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

/** Registra un pago directo sobre la deuda de un equipo */
export class PagarDerramaEquipoDto {
  @IsNumber()
  @IsPositive()
  monto: number;

  @IsOptional()
  @IsInt()
  campeonatoId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
