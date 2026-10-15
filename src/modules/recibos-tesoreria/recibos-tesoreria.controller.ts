import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecibosTesoreriaService } from './recibos-tesoreria.service';

@Controller('recibos-tesoreria')
@UseGuards(JwtAuthGuard)
export class RecibosTesoreriaController {
  constructor(private readonly recibosService: RecibosTesoreriaService) {}

  @Get()
  listar(
    @Query('ligaId', ParseIntPipe) ligaId: number,
    @Query('equipoId') equipoId: string | undefined,
    @Query('campeonatoId') campeonatoId: string | undefined,
    @Request() req: any,
  ) {
    return this.recibosService.listar(
      ligaId,
      equipoId ? Number(equipoId) : undefined,
      campeonatoId ? Number(campeonatoId) : undefined,
      req.user,
    );
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.recibosService.obtener(id, req.user);
  }
}
