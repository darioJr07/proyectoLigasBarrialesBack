import { IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateDerramaDto {
  @IsNumber()
  ligaId: number;

  @IsNumber()
  campeonatoId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @IsEnum(['monetaria', 'unidades'])
  tipo: 'monetaria' | 'unidades';

  @IsNumber()
  @IsPositive()
  montoUnitario: number;
}
