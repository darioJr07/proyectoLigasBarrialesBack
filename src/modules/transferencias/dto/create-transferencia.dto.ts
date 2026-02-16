import { IsNumber, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateTransferenciaDto {
  @IsNumber()
  @IsNotEmpty()
  jugadorId: number;

  @IsNumber()
  @IsNotEmpty()
  campeonatoId: number;

  @IsNumber()
  @IsNotEmpty()
  equipoDestinoId: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  observaciones?: string;
}
