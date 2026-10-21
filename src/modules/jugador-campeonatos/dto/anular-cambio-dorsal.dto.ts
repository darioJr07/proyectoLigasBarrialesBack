import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularCambioDorsalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}
