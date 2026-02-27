import {
  IsNotEmpty,
  IsString,
  IsDateString,
  MaxLength,
  IsOptional,
  IsInt,
  IsIn,
  Min,
} from 'class-validator';

export class CreateCampeonatoDto {
  @IsNotEmpty({ message: 'El nombre del campeonato es obligatorio' })
  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNotEmpty({ message: 'La liga es obligatoria' })
  @IsInt()
  ligaId: number;

  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria' })
  @IsDateString()
  fechaInicio: string;

  @IsNotEmpty({ message: 'La fecha de fin es obligatoria' })
  @IsDateString()
  fechaFin: string;

  @IsNotEmpty({ message: 'La fecha límite de inscripción es obligatoria' })
  @IsDateString()
  fechaLimiteInscripcion: string;

  @IsOptional()
  @IsString()
  @IsIn(['inscripcion_abierta', 'en_curso', 'finalizado', 'cancelado'])
  estado?: 'inscripcion_abierta' | 'en_curso' | 'finalizado' | 'cancelado';

  @IsOptional()
  @IsInt({ message: 'El máximo de jugadores habilitados debe ser un número entero' })
  @Min(1, { message: 'El máximo de jugadores habilitados debe ser al menos 1' })
  maxJugadoresHabilitados?: number;
}
