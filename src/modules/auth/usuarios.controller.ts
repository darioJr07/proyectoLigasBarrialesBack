import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Controlador para gestión de usuarios
 * Aplica el principio de Single Responsibility: solo maneja endpoints de usuarios
 */
@Controller('usuarios')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * Obtiene todos los usuarios
   * GET /api/usuarios
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.usuariosService.findAll();
  }

  /**
   * Obtiene un usuario por ID
   * GET /api/usuarios/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  /**
   * Crea un nuevo usuario
   * POST /api/usuarios
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  /**
   * Actualiza un usuario
   * PATCH /api/usuarios/:id
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  /**
   * Cambia la contraseña de un usuario
   * PATCH /api/usuarios/:id/change-password
   */
  @Patch(':id/change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usuariosService.changePassword(id, changePasswordDto);
  }

  /**
   * Activa un usuario
   * PATCH /api/usuarios/:id/activate
   */
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.toggleActive(id, true);
  }

  /**
   * Desactiva un usuario
   * PATCH /api/usuarios/:id/deactivate
   */
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.toggleActive(id, false);
  }

  /**
   * Elimina (desactiva) un usuario
   * DELETE /api/usuarios/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }
}
