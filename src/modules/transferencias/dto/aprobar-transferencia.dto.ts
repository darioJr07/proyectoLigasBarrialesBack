import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AprobarTransferenciaDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  observaciones?: string;
}
