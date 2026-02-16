import { IsString, IsOptional, IsInt, IsDateString, MaxLength } from 'class-validator';

/**
 * DTO para crear un jugador
 */
export class CreateJugadorDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenCedula?: string;

  @IsOptional()
  @IsInt()
  numeroCancha?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  posicion?: string;
}
