import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RechazarTransferenciaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observaciones: string;
}
