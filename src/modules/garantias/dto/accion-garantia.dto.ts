import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AccionGarantiaDto {
  /**
   * Acción a ejecutar sobre la garantía.
   * - 'devolver': el equipo se retira y se le devuelve el dinero (crea EGRESO en caja)
   * - 'ejecutar': el equipo pierde la garantía por sanción (crea INGRESO en caja)
   */
  @IsIn(['devolver', 'ejecutar'])
  accion: 'devolver' | 'ejecutar';

  /** Motivo obligatorio al devolver o ejecutar */
  @IsString()
  @MaxLength(500)
  motivo: string;

  /**
   * Campeonato activo donde se registrará el movimiento de tesorería.
   * Requerido para ejecutar (ingreso a caja) o devolver (egreso de caja).
   */
  @IsOptional()
  campeonatoId?: number;
}
