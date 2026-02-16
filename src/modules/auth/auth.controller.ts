import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  UseInterceptors,
  ClassSerializerInterceptor,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Controlador de autenticación
 * Aplica el principio de Single Responsibility: solo maneja endpoints de autenticación
 */
@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint para registro de usuarios
   * POST /api/auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Endpoint para login de usuarios
   * POST /api/auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Endpoint para obtener perfil del usuario autenticado
   * GET /api/auth/profile
   * Requiere autenticación JWT
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@Request() req: any) {
    return req.user;
  }

  /**
   * Endpoint para obtener usuarios disponibles para ser dirigentes
   * GET /api/auth/users/dirigentes-disponibles?ligaId=1
   * Requiere autenticación JWT
   */
  @Get('users/dirigentes-disponibles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDirigentesDisponibles(@Query('ligaId') ligaId?: string) {
    if (ligaId) {
      return this.authService.getDirigentesDisponiblesByLiga(Number(ligaId));
    }
    return this.authService.getDirigentesDisponibles();
  }

  /**
   * Endpoint para obtener usuarios disponibles para ser directivos de liga
   * GET /api/auth/users/directivos-disponibles
   * Requiere autenticación JWT
   */
  @Get('users/directivos-disponibles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDirectivosDisponibles() {
    return this.authService.getDirectivosDisponibles();
  }

  /**
   * Endpoint para obtener todos los roles disponibles
   * GET /api/auth/roles
   * Requiere autenticación JWT
   */
  @Get('roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRoles() {
    return this.authService.getRoles();
  }
}
