import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BonificacionInicialDto {
  @IsInt()
  @Min(1)
  puntos: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  etapaOrigen?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  posicionOrigen?: number;

  @IsString()
  @MaxLength(250)
  motivo: string;
}

export class EquipoGrupoFixtureDto {
  @IsInt()
  equipoId: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BonificacionInicialDto)
  bonificaciones?: BonificacionInicialDto[];
}

export class GrupoFixtureDto {
  @IsString()
  @MaxLength(40)
  nombre: string;

  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => EquipoGrupoFixtureDto)
  equipos: EquipoGrupoFixtureDto[];
}

export class GenerarFixtureDto {
  @IsInt()
  campeonatoId: number;

  @IsInt()
  categoriaId: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(2)
  equipoIds?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  etapa?: string;

  @IsOptional()
  @IsBoolean()
  conRevancha?: boolean;

  @IsOptional()
  @IsIn(['tabla_unica', 'grupos_cruce_descansos'])
  formato?: 'tabla_unica' | 'grupos_cruce_descansos';

  @IsOptional()
  @IsBoolean()
  marcarComoActual?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrupoFixtureDto)
  grupos?: GrupoFixtureDto[];
}
