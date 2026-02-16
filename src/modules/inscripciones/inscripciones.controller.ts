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
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dto/update-inscripcion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('inscripciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Post()
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createInscripcionDto: CreateInscripcionDto, @Request() req: any) {
    return this.inscripcionesService.create(createInscripcionDto, req.user);
  }

  @Get()
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findAll(@Request() req: any) {
    return this.inscripcionesService.findAll(req.user);
  }

  @Get('campeonato/:campeonatoId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByCampeonato(
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Request() req: any,
  ) {
    return this.inscripcionesService.findByCampeonato(campeonatoId, req.user);
  }

  @Get('categoria/:categoriaId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByCategoria(
    @Param('categoriaId', ParseIntPipe) categoriaId: number,
    @Request() req: any,
  ) {
    return this.inscripcionesService.findByCategoria(categoriaId, req.user);
  }

  @Get(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.inscripcionesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('master', 'directivo_liga')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInscripcionDto: UpdateInscripcionDto,
    @Request() req: any,
  ) {
    return this.inscripcionesService.update(id, updateInscripcionDto, req.user);
  }

  @Patch(':id/confirmar')
  @Roles('master', 'directivo_liga')
  confirmar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.inscripcionesService.confirmar(id, req.user);
  }

  @Patch(':id/rechazar')
  @Roles('master', 'directivo_liga')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body('observaciones') observaciones: string,
    @Request() req: any,
  ) {
    return this.inscripcionesService.rechazar(id, observaciones, req.user);
  }

  @Delete(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.inscripcionesService.remove(id, req.user);
  }
}
