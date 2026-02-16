import {
  IsEmail,
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
} from 'class-validator';

/**
 * DTO para actualizar un usuario existente
 * Todos los campos son opcionales para permitir actualizaciones parciales
 */
export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser válido' })
  email?: string;

  @IsOptional()
  @IsInt()
  rolId?: number;

  @IsOptional()
  @IsInt()
  ligaId?: number;

  @IsOptional()
  @IsInt()
  equipoId?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
