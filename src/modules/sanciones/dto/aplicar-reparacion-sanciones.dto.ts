import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, ValidateNested } from 'class-validator';

export class PropuestaReparacionDto {
  @IsInt()
  sancionId: number;

  @IsInt()
  partidoId: number;
}

/** La reparación nunca se ejecuta globalmente: exige propuestas revisadas. */
export class AplicarReparacionSancionesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PropuestaReparacionDto)
  propuestas: PropuestaReparacionDto[];
}
