import { IsString, IsOptional, IsInt, IsDateString, MaxLength } from 'class-validator';

/**
 * DTO para crear un equipo
 */
export class CreateEquipoDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

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
  @IsString()
  @MaxLength(500)
  imagen?: string;

  @IsInt()
  ligaId: number;

  @IsInt()
  dirigenteId: number;
}
