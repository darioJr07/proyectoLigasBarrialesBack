import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO para cambiar la contraseña de un usuario
 */
export class ChangePasswordDto {
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  newPassword: string;
}
