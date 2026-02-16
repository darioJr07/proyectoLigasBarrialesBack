import { PartialType } from '@nestjs/mapped-types';
import { CreateLigaDto } from './create-liga.dto';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO para actualizar una liga
 * Extiende de CreateLigaDto haciendo todos los campos opcionales
 */
export class UpdateLigaDto extends PartialType(CreateLigaDto) {
  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un booleano' })
  activo?: boolean;

  // Permitir actualizar el directivoId y nombre de la liga
  @IsOptional()
  directivoId?: number;

  @IsOptional()
  nombre?: string;
}
