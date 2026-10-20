import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PartidosService } from './partidos.service';
import { CreatePartidoDto } from './dto/create-partido.dto';
import { UpdatePartidoDto } from './dto/update-partido.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProgramacionSemanalService } from './programacion-semanal.service';
import { CrearProgramacionSemanalDto } from './dto/crear-programacion-semanal.dto';
import { GenerarFixtureDto } from './dto/generar-fixture.dto';
import { ConfigurarVocaliaDto, SortearVocaliaDto } from './dto/vocalia-programacion.dto';

/**
 * Controlador de Partidos
 *
 * Define todos los endpoints HTTP del módulo de partidos.
 * Todos los endpoints requieren autenticación JWT (@UseGuards).
 *
 * ENDPOINTS DISPONIBLES:
 *
 * POST   /partidos                              → Crear partido individual
 * POST   /partidos/generar-fixture              → Generar fixture automático round-robin
 * GET    /partidos                              → Listar partidos (filtrado por rol)
 * GET    /partidos/campeonato/:id               → Partidos de un campeonato
 * GET    /partidos/jornada                      → Partidos de una jornada específica
 * GET    /partidos/:id                          → Detalle de un partido
 * PATCH  /partidos/:id                          → Actualizar datos del partido
 * PATCH  /partidos/:id/resultado                → Registrar resultado
 * DELETE /partidos/fixture                      → Eliminar fixture completo (para regenerar)
 * DELETE /partidos/:id                          → Soft delete de un partido
 */
@Controller('partidos')
@UseGuards(JwtAuthGuard)
export class PartidosController {
  constructor(private readonly partidosService: PartidosService, private readonly programacionSemanalService: ProgramacionSemanalService) {}

  @Post('programacion-semanal')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  crearProgramacionSemanal(@Body() dto: CrearProgramacionSemanalDto, @Request() req: any) {
    return this.programacionSemanalService.crear(dto, req.user);
  }

  @Get('programacion-semanal/pendiente')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  programacionSemanalPendiente(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId') categoriaId: string | undefined,
    @Query('etapa') etapa: string,
    @Query('jornada', ParseIntPipe) jornada: number,
    @Request() req: any,
  ) {
    return this.programacionSemanalService.pendiente(campeonatoId, categoriaId ? Number(categoriaId) : undefined, etapa, jornada, req.user);
  }

  @Get('programacion-semanal/confirmadas')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  programacionesSemanalesConfirmadas(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId') categoriaId: string | undefined,
    @Query('etapa') etapa: string | undefined,
    @Query('jornada') jornada: string | undefined,
    @Request() req: any,
  ) {
    return this.programacionSemanalService.listarConfirmadas(
      campeonatoId,
      categoriaId ? Number(categoriaId) : undefined,
      etapa,
      jornada ? Number(jornada) : undefined,
      req.user,
    );
  }

  @Get('programacion-semanal/:id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  detalleProgramacionSemanal(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.detalle(id, req.user);
  }

  @Post('programacion-semanal/:id/sacar-bolilla/:partidoId')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  sacarBolilla(@Param('id', ParseIntPipe) id: number, @Param('partidoId', ParseIntPipe) partidoId: number, @Request() req: any) {
    return this.programacionSemanalService.sacarBolilla(id, partidoId, req.user);
  }

  @Post('programacion-semanal/:id/confirmar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  confirmarProgramacionSemanal(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.confirmar(id, req.user);
  }

  @Post('programacion-semanal/:id/cancelar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  cancelarProgramacionSemanal(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.cancelar(id, req.user);
  }

  @Post('programacion-semanal/:id/bolillas/:bolillaId/liberar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  liberarBolillaProgramacion(@Param('id', ParseIntPipe) id: number, @Param('bolillaId', ParseIntPipe) bolillaId: number, @Request() req: any) {
    return this.programacionSemanalService.liberarBolilla(id, bolillaId, req.user);
  }

  @Post('programacion-semanal/:id/asignar-manual')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  asignarBolillaManual(@Param('id', ParseIntPipe) id: number, @Body() body: { partidoId: number; bolillaId: number }, @Request() req: any) {
    return this.programacionSemanalService.asignarManual(id, Number(body.partidoId), Number(body.bolillaId), req.user);
  }

  @Get('programacion-semanal/:id/vocalias')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  obtenerVocaliasProgramacion(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.obtenerVocalias(id, req.user);
  }

  @Post('programacion-semanal/:id/vocalias/preparar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  prepararVocaliasProgramacion(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.prepararVocalias(id, req.user);
  }

  @Post('programacion-semanal/:id/vocalias/reiniciar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  reiniciarVocaliasProgramacion(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.reiniciarVocalias(id, req.user);
  }

  @Patch('programacion-semanal/:id/vocalias/:vocaliaId')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  configurarVocaliaProgramacion(
    @Param('id', ParseIntPipe) id: number,
    @Param('vocaliaId', ParseIntPipe) vocaliaId: number,
    @Body() dto: ConfigurarVocaliaDto,
    @Request() req: any,
  ) {
    return this.programacionSemanalService.configurarVocalia(id, vocaliaId, dto, req.user);
  }

  @Post('programacion-semanal/:id/vocalias/:vocaliaId/sortear')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  sortearVocaliaProgramacion(
    @Param('id', ParseIntPipe) id: number,
    @Param('vocaliaId', ParseIntPipe) vocaliaId: number,
    @Body() dto: SortearVocaliaDto,
    @Request() req: any,
  ) {
    return this.programacionSemanalService.sortearVocalia(id, vocaliaId, dto.equipoExtractorId, req.user);
  }

  @Post('programacion-semanal/:id/vocalias/:vocaliaId/liberar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  liberarVocaliaProgramacion(
    @Param('id', ParseIntPipe) id: number,
    @Param('vocaliaId', ParseIntPipe) vocaliaId: number,
    @Request() req: any,
  ) {
    return this.programacionSemanalService.liberarVocalia(id, vocaliaId, req.user);
  }

  @Post('programacion-semanal/:id/vocalias/confirmar')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  confirmarVocaliasProgramacion(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.programacionSemanalService.confirmarVocalias(id, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR PARTIDO INDIVIDUAL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /partidos
   * Crea un partido individual manualmente.
   * Roles permitidos: master, directivo_liga
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  create(@Body() dto: CreatePartidoDto, @Request() req: any) {
    return this.partidosService.create(dto, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GENERACIÓN AUTOMÁTICA DE FIXTURE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /partidos/generar-fixture
   * Genera automáticamente el fixture todos contra todos (round-robin)
   * para una categoría de un campeonato.
   *
   * Body esperado:
   * {
   *   "campeonatoId": 1,
   *   "categoriaId": 1,
   *   "equipoIds": [1, 2, 3, 4, ...],   ← IDs de equipos inscritos (cualquier cantidad)
   *   "etapa": "primera_etapa",          ← opcional, default 'primera_etapa'
   *   "conRevancha": false               ← true = ida y vuelta, false = solo ida
   * }
   *
   * El sistema calculará automáticamente:
   *   - Número de jornadas según cantidad de equipos (N-1 si par, N si impar)
   *   - Emparejamientos por jornada (round-robin)
   *   - Si conRevancha=true, duplica el fixture invirtiendo local/visitante
   *
   * Ejemplos:
   *   14 equipos, solo ida   → 13 jornadas, 91 partidos total
   *   14 equipos, con vuelta → 26 jornadas, 182 partidos total
   *   13 equipos, solo ida   → 13 jornadas (BYE automático), 78 partidos
   *
   * Roles permitidos: master, directivo_liga
   */
  @Post('generar-fixture')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  generarFixture(
    @Body() body: GenerarFixtureDto,
    @Request() req: any,
  ) {
    return this.partidosService.generarFixture(body, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTAR PARTIDOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /partidos
   * Lista todos los partidos activos filtrados por rol del usuario.
   * Roles permitidos: master, directivo_liga, dirigente_equipo
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findAll(@Request() req: any) {
    return this.partidosService.findAll(req.user);
  }

  /**
   * GET /partidos/campeonato/:campeonatoId?categoriaId=1&etapa=primera_etapa
   * Lista partidos de un campeonato, con filtros opcionales por categoría y etapa.
   * Útil para mostrar el fixture completo de una categoría.
   */
  @Get('campeonato/:campeonatoId')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findByCampeonato(
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId') categoriaId?: string,
    @Query('etapa') etapa?: string,
    @Request() req?: any,
  ) {
    return this.partidosService.findByCampeonato(
      campeonatoId,
      categoriaId ? Number(categoriaId) : undefined,
      etapa,
      req?.user,
    );
  }

  /**
   * GET /partidos/jornada?campeonatoId=1&categoriaId=1&jornada=1&etapa=primera_etapa
   * Lista los partidos de una jornada específica.
   */
  @Get('jornada')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findByJornada(
    @Query('campeonatoId') campeonatoId: string,
    @Query('categoriaId') categoriaId: string,
    @Query('jornada') jornada: string,
    @Query('etapa') etapa?: string,
  ) {
    return this.partidosService.findByJornada(
      Number(campeonatoId),
      Number(categoriaId),
      Number(jornada),
      etapa,
    );
  }

  /**
   * GET /partidos/etapas?campeonatoId=1&categoriaId=1
   * Devuelve las etapas distintas de un campeonato/categoría para poblar el selector dinámico.
   */
  @Get('etapas')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  getEtapas(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
  ) {
    return this.partidosService.getEtapas(campeonatoId, categoriaId);
  }

  @Get('etapas/detalle')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  getEtapasDetalle(
    @Query('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Query('categoriaId', ParseIntPipe) categoriaId: number,
  ) {
    return this.partidosService.getEtapasDetalle(campeonatoId, categoriaId);
  }

  /**
   * GET /partidos/:id
   * Obtiene el detalle de un partido específico.
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga', 'dirigente_equipo', 'tribuna_penas', 'tesoreria')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partidosService.findOne(id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTUALIZAR PARTIDO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * PATCH /partidos/:id
   * Actualiza datos del partido (fecha, hora, cancha, etc.).
   * NO actualiza el resultado (usar /resultado).
   * Roles permitidos: master, directivo_liga
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartidoDto,
    @Request() req: any,
  ) {
    return this.partidosService.update(id, dto, req.user);
  }

  /**
   * PATCH /partidos/:id/resultado
   * Registra el resultado de un partido jugado (goles, bonificaciones).
   * Cambia automáticamente el estado del partido a 'jugado'.
   * Roles permitidos: master, directivo_liga
   */
  @Patch(':id/resultado')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  registrarResultado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarResultadoDto,
    @Request() req: any,
  ) {
    return this.partidosService.registrarResultado(id, dto, req.user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ELIMINAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * DELETE /partidos/fixture?campeonatoId=1&categoriaId=1&etapa=primera_etapa
   * Elimina (soft delete) TODOS los partidos de un fixture.
   * Útil si se generó mal y necesitas regenerarlo.
   * PRECAUCIÓN: borra todos los partidos de la etapa indicada.
   * Roles permitidos: master, directivo_liga
   */
  @Delete('fixture')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  eliminarFixture(
    @Query('campeonatoId') campeonatoId: string,
    @Query('categoriaId') categoriaId: string,
    @Query('etapa') etapa: string,
    @Request() req: any,
  ) {
    return this.partidosService.eliminarFixture(
      Number(campeonatoId),
      Number(categoriaId),
      etapa,
      req.user,
    );
  }

  /**
   * DELETE /partidos/:id
   * Soft delete de un partido individual.
   * Roles permitidos: master, directivo_liga
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('master', 'directivo_liga')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.partidosService.remove(id, req.user);
  }
}
