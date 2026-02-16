import { PartialType } from '@nestjs/mapped-types';
import { CreateJugadorDto } from './create-jugador.dto';
import { IsOptional, IsInt, IsString, MaxLength, IsDateString } from 'class-validator';

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
  @MaxLength(20)
  cedula?: string;

  @IsOptional()
  @IsInt()
  equipoId?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
