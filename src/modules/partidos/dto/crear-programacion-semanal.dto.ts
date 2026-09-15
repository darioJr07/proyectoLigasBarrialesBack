import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export class BolillaHorarioDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha: string;

  @IsString() @Matches(/^\d{2}:\d{2}$/)
  hora: string;

  @IsString() @MaxLength(150)
  cancha: string;
}

export class CrearProgramacionSemanalDto {
  @IsInt() @Min(1)
  campeonatoId: number;

  @IsOptional() @IsInt() @Min(1)
  categoriaId?: number;

  @IsString() @MaxLength(50)
  etapa: string;

  @IsInt() @Min(1)
  jornada: number;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BolillaHorarioDto)
  bolillas: BolillaHorarioDto[];
}
