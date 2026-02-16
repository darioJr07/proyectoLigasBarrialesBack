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
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { LigasService } from './ligas.service';
import { CreateLigaDto } from './dto/create-liga.dto';
import { UpdateLigaDto } from './dto/update-liga.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de Ligas
 * Aplica el principio de Single Responsibility: solo maneja endpoints de ligas
 * Todos los endpoints están protegidos por autenticación JWT
 */
@Controller('ligas')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class LigasController {
  constructor(private readonly ligasService: LigasService) {}

  /**
   * Crear una nueva liga
   * POST /api/ligas
   * Solo usuarios con rol 'master' pueden crear ligas
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createLigaDto: CreateLigaDto, @Request() req: any) {
    return await this.ligasService.create(createLigaDto, req.user);
  }

  /**
   * Obtener todas las ligas
   * GET /api/ligas
   * Filtra según el rol del usuario
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Request() req: any) {
    return await this.ligasService.findAll(req.user);
  }

  /**
   * Obtener todas las ligas activas
   * GET /api/ligas/activas
   */
  @Get('activas')
  @HttpCode(HttpStatus.OK)
  async findActive() {
    return await this.ligasService.findActive();
  }

  /**
   * Obtener una liga por ID
   * GET /api/ligas/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.ligasService.findOne(id);
  }

  /**
   * Actualizar una liga
   * PATCH /api/ligas/:id
   * Solo el master o el directivo de la liga pueden actualizarla
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLigaDto: UpdateLigaDto,
    @Request() req: any,
  ) {
    return await this.ligasService.update(id, updateLigaDto, req.user);
  }

  /**
   * Desactivar una liga
   * DELETE /api/ligas/:id
   * Solo usuarios con rol 'master' pueden desactivar ligas
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return await this.ligasService.remove(id, req.user);
  }

  /**
   * Eliminar permanentemente una liga
   * DELETE /api/ligas/:id/permanente
   * Solo usuarios con rol 'master' pueden eliminar ligas permanentemente
   */
  @Delete(':id/permanente')
  @HttpCode(HttpStatus.OK)
  async removePermanently(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return await this.ligasService.removePermanently(id, req.user);
  }
}
