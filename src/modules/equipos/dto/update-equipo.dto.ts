import { PartialType } from '@nestjs/mapped-types';
import { CreateEquipoDto } from './create-equipo.dto';
import { IsOptional, IsInt, IsString, MaxLength, IsDateString } from 'class-validator';

/**
 * DTO para actualizar un equipo
 */
export class UpdateEquipoDto extends PartialType(CreateEquipoDto) {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  representante?: string;

  @IsOptional()
  @IsDateString()
  fundacion?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  ligaId?: number;

  @IsOptional()
  @IsInt()
  dirigenteId?: number;
}
