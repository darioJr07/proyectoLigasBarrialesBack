import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsInt,
  IsOptional,
} from 'class-validator';

/**
 * DTO para crear un nuevo usuario
 * Aplica validaciones para garantizar integridad de datos
 */
export class CreateUsuarioDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  nombre: string;

  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsInt()
  rolId: number;

  @IsOptional()
  @IsInt()
  ligaId?: number;

  @IsOptional()
  @IsInt()
  equipoId?: number;
}
