import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './entities/rol.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Servicio de autenticación
 * Aplica principios SOLID:
 * - Single Responsibility: Solo maneja lógica de autenticación
 * - Dependency Inversion: Depende de abstracciones (Repository, JwtService)
 * - Open/Closed: Abierto para extensión (nuevas estrategias) cerrado para modificación
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registra un nuevo usuario en el sistema
   * @param registerDto Datos del usuario a registrar
   * @returns Usuario creado y token JWT
   */
  async register(registerDto: RegisterDto) {
    const { email, password, rolId, ...userData } = registerDto;

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

    // Generar token JWT
    const token = this.generateToken(savedUser);

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = savedUser;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Autentica un usuario existente
   * @param loginDto Credenciales de login
   * @returns Usuario autenticado y token JWT
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Buscar usuario por email
    const user = await this.usuarioRepository.findOne({
      where: { email },
      relations: ['rol'],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar si el usuario está activo
    if (!user.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Verificar contraseña
    const isPasswordValid = await this.comparePasswords(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar token JWT
    const token = this.generateToken(user);

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Valida y retorna un usuario basado en su ID
   * @param userId ID del usuario
   * @returns Usuario encontrado
   */
  async validateUser(userId: number): Promise<Usuario> {
    const user = await this.usuarioRepository.findOne({
      where: { id: userId },
      relations: ['rol'],
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return user;
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

  /**
   * Compara una contraseña en texto plano con su hash
   * @param password Contraseña en texto plano
   * @param hashedPassword Contraseña hasheada
   * @returns true si coinciden, false si no
   */
  private async comparePasswords(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Genera un token JWT para un usuario
   * @param user Usuario para generar el token
   * @returns Token JWT
   */
  private generateToken(user: Usuario): string {
    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol.nombre,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Obtiene usuarios disponibles para ser dirigentes de equipos
   * Retorna usuarios con rol dirigente_equipo que no tengan un equipo asignado o cuyo equipo esté inactivo
   * @returns Lista de usuarios disponibles
   */
  async getDirigentesDisponibles() {
    const dirigentes = await this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoin('equipos', 'equipo', 'equipo.dirigente_id = usuario.id AND equipo.activo = true')
      .where('rol.nombre = :rol', { rol: 'dirigente_equipo' })
      .andWhere('usuario.activo = :activo', { activo: true })
      .andWhere('equipo.id IS NULL')
      .select(['usuario.id', 'usuario.nombre', 'usuario.email', 'rol.id', 'rol.nombre'])
      .getMany();

    return dirigentes;
  }

  /**
   * Obtiene usuarios disponibles para ser dirigentes filtrados por liga
   * Retorna usuarios con rol dirigente_equipo que estén asignados a esa liga y no tengan un equipo
   * @param ligaId ID de la liga para filtrar dirigentes disponibles
   * @returns Lista de usuarios disponibles para esa liga
   */
  async getDirigentesDisponiblesByLiga(ligaId: number) {
    const dirigentes = await this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoin(
        'equipos',
        'equipo',
        'equipo.dirigente_id = usuario.id AND equipo.activo = true'
      )
      .where('rol.nombre = :rol', { rol: 'dirigente_equipo' })
      .andWhere('usuario.activo = :activo', { activo: true })
      .andWhere('usuario.liga_id = :ligaId', { ligaId })
      .andWhere('equipo.id IS NULL')
      .select(['usuario.id', 'usuario.nombre', 'usuario.email', 'rol.id', 'rol.nombre'])
      .getMany();

    return dirigentes;
  }

  /**
   * Obtiene usuarios disponibles para ser directivos de liga
   * Retorna usuarios con rol directivo_liga que no tengan una liga asignada o cuya liga esté inactiva
   * @returns Lista de usuarios disponibles
   */
  async getDirectivosDisponibles() {
    const directivos = await this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoin('ligas', 'liga', 'liga.directivo_id = usuario.id AND liga.activo = true')
      .where('rol.nombre = :rol', { rol: 'directivo_liga' })
      .andWhere('usuario.activo = :activo', { activo: true })
      .andWhere('liga.id IS NULL')
      .select(['usuario.id', 'usuario.nombre', 'usuario.email', 'rol.id', 'rol.nombre'])
      .getMany();

    return directivos;
  }

  /**
   * Obtiene todos los roles disponibles en el sistema
   * @returns Lista de roles
   */
  async getRoles() {
    return this.rolRepository.find({
      order: { id: 'ASC' },
    });
  }
}
