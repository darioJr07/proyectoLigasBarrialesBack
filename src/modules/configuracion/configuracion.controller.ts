import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de configuración del sistema
 * GET  /api/configuracion         - Cualquier usuario autenticado
 * PATCH /api/configuracion/:clave - Solo master y directivo_liga
 */
@Controller('configuracion')
@UseGuards(JwtAuthGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.configuracionService.findAll();
  }

  @Patch(':clave')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('clave') clave: string,
    @Body() dto: UpdateConfiguracionDto,
    @Request() req: any,
  ) {
    return this.configuracionService.update(clave, dto, req.user);
  }
}
