import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de equipos
 * Maneja endpoints REST para gestión de equipos
 */
@Controller('equipos')
@UseGuards(JwtAuthGuard)
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Post()
  create(@Body() createEquipoDto: CreateEquipoDto, @Request() req: any) {
    return this.equiposService.create(createEquipoDto, req.user.userId);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.equiposService.findAll(req.user);
  }

  @Get('liga/:ligaId')
  findByLiga(@Param('ligaId') ligaId: string) {
    return this.equiposService.findByLiga(+ligaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equiposService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEquipoDto: UpdateEquipoDto,
    @Request() req: any,
  ) {
    return this.equiposService.update(
      +id,
      updateEquipoDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.equiposService.remove(+id, req.user.userId, req.user.role);
  }

  @Delete(':id/permanente')
  removePermanently(@Param('id') id: string, @Request() req: any) {
    return this.equiposService.removePermanently(+id, req.user.role);
  }
}
