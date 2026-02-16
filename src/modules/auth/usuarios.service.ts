import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './entities/rol.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

/**
 * Servicio para gestión de usuarios
 * Aplica principios SOLID:
 * - Single Responsibility: Gestión de usuarios
 * - Dependency Inversion: Depende de abstracciones (Repository)
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  /**
   * Obtiene todos los usuarios del sistema
   * @returns Lista de usuarios
   */
  async findAll(): Promise<Usuario[]> {
    return this.usuarioRepository.find({
      relations: ['rol'],
      order: { id: 'ASC' },
    });
  }

  /**
   * Obtiene un usuario por su ID
   * @param id ID del usuario
   * @returns Usuario encontrado
   */
  async findOne(id: number): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
      relations: ['rol'],
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  /**
   * Crea un nuevo usuario
   * @param createUsuarioDto Datos del usuario
   * @returns Usuario creado
   */
  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    const { email, password, rolId, ...userData } = createUsuarioDto;

    // Verificar si el email ya existe
    const existingUser = await this.usuarioRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar que el rol exista
    const rol = await this.rolRepository.findOne({ where: { id: rolId } });
    if (!rol) {
      throw new NotFoundException('El rol especificado no existe');
    }

    // Hashear la contraseña
    const hashedPassword = await this.hashPassword(password);

    // Crear el nuevo usuario
    const newUser = this.usuarioRepository.create({
      ...userData,
      email,
      password: hashedPassword,
      rol,
    });

    const savedUser = await this.usuarioRepository.save(newUser);

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword as Usuario;
  }

  /**
   * Actualiza un usuario existente
   * @param id ID del usuario
   * @param updateUsuarioDto Datos a actualizar
   * @returns Usuario actualizado
   */
  async update(
    id: number,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<Usuario> {
    const usuario = await this.findOne(id);

    // Si se actualiza el email, verificar que no exista
    if (updateUsuarioDto.email && updateUsuarioDto.email !== usuario.email) {
      const existingUser = await this.usuarioRepository.findOne({
        where: { email: updateUsuarioDto.email },
      });

      if (existingUser) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // Si se actualiza el rol, verificar que exista
    if (updateUsuarioDto.rolId) {
      const rol = await this.rolRepository.findOne({
        where: { id: updateUsuarioDto.rolId },
      });

      if (!rol) {
        throw new NotFoundException('El rol especificado no existe');
      }

      usuario.rol = rol;
    }

    // Actualizar campos
    Object.assign(usuario, updateUsuarioDto);

    const updatedUser = await this.usuarioRepository.save(usuario);

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as Usuario;
  }

  /**
   * Cambia la contraseña de un usuario
   * @param id ID del usuario
   * @param changePasswordDto Nueva contraseña
   * @returns Mensaje de confirmación
   */
  async changePassword(
    id: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const usuario = await this.findOne(id);

    // Hashear la nueva contraseña
    const hashedPassword = await this.hashPassword(
      changePasswordDto.newPassword,
    );

    // Actualizar contraseña
    usuario.password = hashedPassword;
    await this.usuarioRepository.save(usuario);

    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Activa o desactiva un usuario
   * @param id ID del usuario
   * @param activo Estado activo/inactivo
   * @returns Usuario actualizado
   */
  async toggleActive(id: number, activo: boolean): Promise<Usuario> {
    const usuario = await this.findOne(id);

    usuario.activo = activo;
    const updatedUser = await this.usuarioRepository.save(usuario);

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as Usuario;
  }

  /**
   * Elimina lógicamente un usuario (desactivándolo)
   * @param id ID del usuario
   * @returns Mensaje de confirmación
   */
  async remove(id: number): Promise<{ message: string }> {
    const usuario = await this.findOne(id);

    // No permitir eliminar el usuario con ID 1 (master)
    if (usuario.id === 1) {
      throw new BadRequestException('No se puede eliminar el usuario master');
    }

    usuario.activo = false;
    await this.usuarioRepository.save(usuario);

    return { message: 'Usuario desactivado correctamente' };
  }

  /**
   * Hashea una contraseña
   * @param password Contraseña en texto plano
   * @returns Contraseña hasheada
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
