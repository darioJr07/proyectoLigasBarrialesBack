import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ConfigurarVocaliaDto {
  @IsIn(['sorteo', 'manual_equipo', 'directivo'])
  tipoAsignacion: 'sorteo' | 'manual_equipo' | 'directivo';

  @IsOptional() @IsInt() @Min(1)
  partidoOrigenId?: number;

  @IsOptional() @IsInt() @Min(1)
  equipoVocalId?: number;

  @IsOptional() @IsString() @MaxLength(200)
  directivoNombre?: string;
}

export class SortearVocaliaDto {
  @IsInt() @Min(1)
  equipoExtractorId: number;
}
