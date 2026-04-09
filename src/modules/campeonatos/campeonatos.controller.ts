import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CampeonatosService } from './campeonatos.service';
import { CreateCampeonatoDto } from './dto/create-campeonato.dto';
import { UpdateCampeonatoDto } from './dto/update-campeonato.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('campeonatos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampeonatosController {
  constructor(private readonly campeonatosService: CampeonatosService) {}

  @Post()
  @Roles('master', 'directivo_liga')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCampeonatoDto: CreateCampeonatoDto, @Request() req: any) {
    return this.campeonatosService.create(createCampeonatoDto, req.user);
  }

  @Get()
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findAll(@Request() req: any) {
    return this.campeonatosService.findAll(req.user);
  }

  @Get('liga/:ligaId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findByLiga(@Param('ligaId', ParseIntPipe) ligaId: number, @Request() req: any) {
    return this.campeonatosService.findByLiga(ligaId, req.user);
  }

  @Get(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.campeonatosService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('master', 'directivo_liga')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCampeonatoDto: UpdateCampeonatoDto,
    @Request() req: any,
  ) {
    return this.campeonatosService.update(id, updateCampeonatoDto, req.user);
  }

  @Patch(':id/estado')
  @Roles('master', 'directivo_liga')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'inscripcion_abierta' | 'en_curso' | 'finalizado' | 'cancelado',
    @Request() req: any,
  ) {
    return this.campeonatosService.cambiarEstado(id, estado, req.user);
  }

  @Delete(':id')
  @Roles('master', 'directivo_liga')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.campeonatosService.remove(id, req.user);
  }

  /**
   * GET /campeonatos/:id/preview-ascensos-descensos?etapa=primera_etapa
   * Previsualiza qué equipos ascenderían/descenderían según la tabla final.
   * No modifica nada en la BD.
   */
  @Get(':id/preview-ascensos-descensos')
  @Roles('master', 'directivo_liga')
  previewAscensosDescensos(
    @Param('id', ParseIntPipe) id: number,
    @Query('etapa') etapa: string,
    @Request() req: any,
  ) {
    return this.campeonatosService.previewAscensosDescensos(id, etapa, req.user);
  }

  /**
   * POST /campeonatos/:id/procesar-ascensos-descensos
   * Ejecuta los movimientos en lote y cierra el campeonato como 'finalizado'.
   */
  @Post(':id/procesar-ascensos-descensos')
  @Roles('master', 'directivo_liga')
  @HttpCode(HttpStatus.OK)
  procesarAscensosDescensos(
    @Param('id', ParseIntPipe) id: number,
    @Body('etapa') etapa: string,
    @Request() req: any,
  ) {
    return this.campeonatosService.procesarAscensosDescensos(id, etapa, req.user);
  }

  @Post('actualizar-estados')
  @Roles('master')
  @HttpCode(HttpStatus.OK)
  actualizarEstadosMasivo(@Request() req: any) {
    return this.campeonatosService.actualizarEstadosMasivo(req.user);
  }

  @Post('corregir-estados')
  @Roles('master')
  @HttpCode(HttpStatus.OK)
  corregirEstados(@Request() req: any) {
    return this.campeonatosService.corregirEstados(req.user);
  }
}
