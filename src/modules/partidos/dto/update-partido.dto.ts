import { PartialType } from '@nestjs/mapped-types';
import { CreatePartidoDto } from './create-partido.dto';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * DTO para actualizar un partido.
 *
 * PartialType hace que todos los campos de CreatePartidoDto sean opcionales.
 * Así puedes actualizar solo la fecha, hora, cancha, etc. sin enviar todo.
 */
export class UpdatePartidoDto extends PartialType(CreatePartidoDto) {
  /**
   * Permite cambiar el estado manualmente si es necesario.
   * Ej: marcar como 'suspendido' o 'cancelado'.
   */
  @IsEnum(['programado', 'jugado', 'suspendido', 'cancelado'])
  @IsOptional()
  estado?: 'programado' | 'jugado' | 'suspendido' | 'cancelado';
}
