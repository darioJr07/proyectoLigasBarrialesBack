import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

/**
 * DTO para crear un partido
 *
 * Los DTOs (Data Transfer Objects) validan los datos que llegan del frontend.
 * Si algo no cumple las reglas, NestJS responde automáticamente con error 400.
 *
 * @IsNumber() → debe ser un número
 * @IsString() → debe ser un string
 * @IsOptional() → el campo no es obligatorio
 * @IsDateString() → debe ser una fecha válida en formato ISO (ej: "2026-03-15")
 */
export class CreatePartidoDto {
  /**
   * ID del campeonato ya existente en la base de datos.
   * Ejemplo: 1 (Apertura 2026)
   */
  @IsNumber()
  @IsNotEmpty()
  campeonatoId: number;

  /**
   * ID de la categoría (Máxima, Primera, etc.) ya existente.
   * Ejemplo: 1 (Máxima), 2 (Primera)
   */
  @IsNumber()
  @IsNotEmpty()
  categoriaId: number;

  /**
   * ID del equipo que juega como local. Debe estar inscrito en el campeonato.
   */
  @IsNumber()
  @IsNotEmpty()
  equipoLocalId: number;

  /**
   * ID del equipo que juega como visitante. Debe estar inscrito en el campeonato.
   */
  @IsNumber()
  @IsNotEmpty()
  equipoVisitanteId: number;

  /**
   * Etapa del torneo. Ejemplos: 'primera_etapa', 'liguilla', 'final'.
   * Por defecto 'primera_etapa'.
   */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  etapa?: string;

  /**
   * Número de jornada dentro de la etapa.
   * Ejemplo: 1 = primera fecha, 2 = segunda fecha, etc.
   */
  @IsNumber()
  @Min(1)
  jornada: number;

  /**
   * Fecha programada del partido. Formato ISO: "2026-03-15"
   */
  @IsDateString()
  @IsOptional()
  fechaPartido?: string;

  /**
   * Hora del partido. Formato: "15:30"
   */
  @IsString()
  @IsOptional()
  @MaxLength(10)
  horaPartido?: string;

  /**
   * Nombre de la cancha donde se jugará.
   */
  @IsString()
  @IsOptional()
  @MaxLength(150)
  cancha?: string;

  /**
   * Observaciones o notas adicionales.
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  observaciones?: string;
}
