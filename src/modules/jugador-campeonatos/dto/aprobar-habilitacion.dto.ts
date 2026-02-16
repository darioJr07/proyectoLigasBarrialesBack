import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AprobarHabilitacionDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  observaciones?: string;
}
