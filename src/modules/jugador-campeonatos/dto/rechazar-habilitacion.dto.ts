import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RechazarHabilitacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observaciones: string;
}
