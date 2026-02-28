import { PartialType } from '@nestjs/mapped-types';
import { CreateJugadorCampeonatoDto } from './create-jugador-campeonato.dto';
import { IsNumber, IsString, IsOptional, Min, Max, MaxLength } from 'class-validator';

export class UpdateJugadorCampeonatoDto extends PartialType(CreateJugadorCampeonatoDto) {
  @IsNumber()
  @IsOptional()
  categoriaId?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(99)
  numeroCancha?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  posicion?: string;
}
