import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class CreateInscripcionDto {
  @IsNotEmpty({ message: 'El campeonato es obligatorio' })
  @IsInt()
  campeonatoId: number;

  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @IsInt()
  categoriaId: number;

  @IsNotEmpty({ message: 'El equipo es obligatorio' })
  @IsInt()
  equipoId: number;

  @IsOptional()
  @IsString()
  @IsIn(['pendiente', 'confirmada', 'rechazada'])
  estado?: 'pendiente' | 'confirmada' | 'rechazada';

  @IsOptional()
  @IsString()
  observaciones?: string;
}
