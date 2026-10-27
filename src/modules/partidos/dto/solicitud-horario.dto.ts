import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CrearSolicitudHorarioDto {
  @IsInt() @Min(1)
  campeonatoId: number;

  @IsInt() @Min(1)
  categoriaId: number;

  @IsString() @IsNotEmpty() @MaxLength(50)
  etapa: string;

  @IsInt() @Min(1)
  equipoId: number;

  @IsInt() @Min(1)
  partidoId: number;

  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaSolicitada: string;

  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaSolicitada: string;

  @IsOptional() @IsString() @MaxLength(150)
  canchaSolicitada?: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  motivo: string;
}

export class ResolverSolicitudHorarioDto {
  @IsString() @IsIn(['aprobar', 'rechazar', 'cancelar'])
  decision: 'aprobar' | 'rechazar' | 'cancelar';

  @IsOptional() @IsString() @MaxLength(500)
  observacion?: string;
}
