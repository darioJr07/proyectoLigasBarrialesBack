import { IsNumber, IsNotEmpty } from 'class-validator';

/**
 * DTO para trasladar el saldo de un campeonato finalizado al siguiente.
 *
 * campeonatoOrigenId  → el campeonato que terminó (debe estar 'finalizado')
 * campeonatoDestinoId → el campeonato nuevo que recibirá el saldo
 */
export class TrasladarSaldoDto {
  @IsNumber()
  @IsNotEmpty()
  campeonatoOrigenId: number;

  @IsNumber()
  @IsNotEmpty()
  campeonatoDestinoId: number;
}
