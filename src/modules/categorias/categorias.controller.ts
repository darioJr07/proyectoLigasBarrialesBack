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
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  @Roles('master', 'directivo_liga')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCategoriaDto: CreateCategoriaDto, @Request() req: any) {
    return this.categoriasService.create(createCategoriaDto, req.user);
  }

  @Get()
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findAll(@Request() req: any) {
    return this.categoriasService.findAll(req.user);
  }

  @Get('campeonato/:campeonatoId')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findByCampeonato(
    @Param('campeonatoId', ParseIntPipe) campeonatoId: number,
    @Request() req: any,
  ) {
    return this.categoriasService.findByCampeonato(campeonatoId, req.user);
  }

  @Get(':id')
  @Roles('master', 'directivo_liga', 'dirigente_equipo')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.categoriasService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('master', 'directivo_liga')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoriaDto: UpdateCategoriaDto,
    @Request() req: any,
  ) {
    return this.categoriasService.update(id, updateCategoriaDto, req.user);
  }

  @Delete(':id')
  @Roles('master', 'directivo_liga')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.categoriasService.remove(id, req.user);
  }
}
