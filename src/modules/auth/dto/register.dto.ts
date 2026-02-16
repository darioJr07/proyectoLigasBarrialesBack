import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsNumber,
  IsOptional,
} from 'class-validator';

/**
 * DTO para registro de usuario
 * Aplica el principio de validación de entrada y transformación de datos
 */
export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsNumber()
  @IsNotEmpty({ message: 'El rol es requerido' })
  rolId: number;

  @IsNumber()
  @IsOptional()
  ligaId?: number;

  @IsNumber()
  @IsOptional()
  equipoId?: number;
}
