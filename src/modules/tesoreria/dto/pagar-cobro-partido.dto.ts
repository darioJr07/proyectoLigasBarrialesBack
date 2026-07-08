import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class PagarCobroPartidoDto {
  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
