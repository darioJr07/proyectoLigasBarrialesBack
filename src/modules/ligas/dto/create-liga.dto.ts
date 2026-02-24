import { IsString, IsNotEmpty, MaxLength, IsDateString, IsNumber, IsOptional } from 'class-validator';

/**
 * DTO para crear una liga
 * Aplica el principio de validación de datos en la entrada
 */
export class CreateLigaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  @MaxLength(200, { message: 'La ubicación no puede exceder 200 caracteres' })
  ubicacion: string;

  @IsDateString({}, { message: 'La fecha de fundación debe ser una fecha válida' })
  @IsNotEmpty({ message: 'La fecha de fundación es obligatoria' })
  fechaFundacion: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La URL de la imagen no puede exceder 500 caracteres' })
  imagen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El correo no puede exceder 150 caracteres' })
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  telefono?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El ID del directivo debe ser un número' })
  directivoId?: number;
}
