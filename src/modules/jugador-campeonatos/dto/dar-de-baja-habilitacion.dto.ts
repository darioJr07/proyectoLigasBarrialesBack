import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DarDeBajaHabilitacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  referencia?: string;
}
