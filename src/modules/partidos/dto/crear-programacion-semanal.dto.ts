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

export class SeleccionProgramacionDto {
  @IsInt() @Min(1)
  categoriaId: number;

  @IsInt() @Min(1)
  jornada: number;
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

  /**
   * Permite combinar, en un mismo bolillero, una jornada distinta por
   * categoría. Si no se envía se mantiene el flujo histórico de
   * categoriaId/jornada.
   */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SeleccionProgramacionDto)
  selecciones?: SeleccionProgramacionDto[];

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BolillaHorarioDto)
  bolillas: BolillaHorarioDto[];
}
