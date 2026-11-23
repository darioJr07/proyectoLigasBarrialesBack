import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ConsultarReporteCampeonatoDto {
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
  @MaxLength(50)
  etapa?: string;
}
