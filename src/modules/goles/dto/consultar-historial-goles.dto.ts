import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ConsultarHistorialGolesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  campeonatoId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoriaId?: number;

  @IsOptional()
  @IsString()
  etapa?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  jornada?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  equipoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  jugadorId?: number;

  @IsOptional()
  @IsIn(['normal', 'penal', 'autogol'])
  tipo?: 'normal' | 'penal' | 'autogol';

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsIn(['activos', 'inactivos', 'todos'])
  estado?: 'activos' | 'inactivos' | 'todos';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limite = 20;
}
