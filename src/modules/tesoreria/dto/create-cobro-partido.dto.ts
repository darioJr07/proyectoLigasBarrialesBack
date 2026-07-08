import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExtraVocaliaDto {
  @IsString()
  @MaxLength(200)
  detalle: string;

  @IsNumber()
  @Min(0)
  valor: number;
}

export class CreateCobroPartidoDto {
  @IsNumber()
  @IsNotEmpty()
  partidoId: number;

  @IsNumber()
  @IsNotEmpty()
  equipoId: number;

  @IsNumber()
  @IsNotEmpty()
  campeonatoId: number;

  @IsNumber()
  @IsNotEmpty()
  ligaId: number;

  @IsOptional()
  @IsNumber()
  jornada?: number;

  @IsNumber()
  @Min(0)
  montoArbitraje: number;

  @IsNumber()
  @Min(0)
  montoAporteLiga: number;

  @IsNumber()
  @Min(0)
  montoPremios: number;

  @IsNumber()
  @Min(0)
  montoFondoAccidentes: number;

  @IsNumber()
  @Min(0)
  montoLimpieza: number;

  @IsNumber()
  @Min(0)
  montoTarjetas: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraVocaliaDto)
  extrasJson?: ExtraVocaliaDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
