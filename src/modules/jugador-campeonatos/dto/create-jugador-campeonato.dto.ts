import { IsNumber, IsString, IsNotEmpty, IsOptional, MaxLength, Min, Max } from 'class-validator';

export class CreateJugadorCampeonatoDto {
  @IsNumber()
  @IsNotEmpty()
  jugadorId: number;

  @IsNumber()
  @IsNotEmpty()
  campeonatoId: number;

  @IsNumber()
  @IsNotEmpty()
  equipoId: number;

  @IsNumber()
  @IsNotEmpty()
  categoriaId: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(99)
  numeroCancha: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  posicion: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  motivoReingreso?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  referenciaReingreso?: string;
}
