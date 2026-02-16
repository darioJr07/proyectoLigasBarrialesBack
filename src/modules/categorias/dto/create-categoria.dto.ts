import {
  IsNotEmpty,
  IsString,
  IsInt,
  MaxLength,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateCategoriaDto {
  @IsNotEmpty({ message: 'El nombre de la categoría es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNotEmpty({ message: 'El campeonato es obligatorio' })
  @IsInt()
  campeonatoId: number;

  @IsNotEmpty({ message: 'El orden es obligatorio' })
  @IsInt()
  @Min(1, { message: 'El orden debe ser mayor a 0' })
  orden: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Equipos que ascienden no puede ser negativo' })
  equiposAscienden?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Equipos que descienden no puede ser negativo' })
  equiposDescienden?: number;
}
