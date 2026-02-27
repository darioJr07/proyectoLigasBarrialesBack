import { PartialType } from '@nestjs/mapped-types';
import { CreateJugadorDto } from './create-jugador.dto';
import { IsOptional, IsInt, IsString, MaxLength, IsDateString, IsIn, ValidateIf, Matches, MinLength } from 'class-validator';

/**
 * DTO para actualizar un jugador
 */
export class UpdateJugadorDto extends PartialType(CreateJugadorDto) {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Cédula', 'Pasaporte'], { message: 'El tipo de documento debe ser Cédula o Pasaporte' })
  tipoDocumento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  // Validación condicional: si es Cédula, debe tener 10 dígitos numéricos
  @ValidateIf(o => o.tipoDocumento === 'Cédula')
  @Matches(/^\d{10}$/, { message: 'La cédula debe tener exactamente 10 dígitos numéricos' })
  // Validación condicional: si es Pasaporte, debe tener al menos 6 caracteres alfanuméricos
  @ValidateIf(o => o.tipoDocumento === 'Pasaporte')
  @MinLength(6, { message: 'El pasaporte debe tener al menos 6 caracteres' })
  cedula?: string;

  @IsOptional()
  @IsInt()
  equipoId?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
