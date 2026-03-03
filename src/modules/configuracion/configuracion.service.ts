import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionSistema } from './entities/configuracion-sistema.entity';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';

/**
 * Servicio de configuración global del sistema
 * Permite habilitar/deshabilitar módulos para dirigentes de equipo
 */
@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(ConfiguracionSistema)
    private configuracionRepository: Repository<ConfiguracionSistema>,
  ) {}

  /**
   * Obtiene todas las configuraciones (accesible para cualquier usuario autenticado)
   */
  async findAll(): Promise<ConfiguracionSistema[]> {
    return this.configuracionRepository.find({ order: { clave: 'ASC' } });
  }

  /**
   * Obtiene una configuración por clave
   */
  async findOne(clave: string): Promise<ConfiguracionSistema> {
    const config = await this.configuracionRepository.findOne({ where: { clave } });
    if (!config) {
      throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    }
    return config;
  }

  /**
   * Actualiza el valor de una configuración
   * Solo accesible para master y directivo_liga (validado en el controller)
   */
  async update(clave: string, dto: UpdateConfiguracionDto, user: any): Promise<ConfiguracionSistema> {
    const rolNombre = user?.rol?.nombre;
    if (rolNombre !== 'master' && rolNombre !== 'directivo_liga') {
      throw new ForbiddenException('No tienes permisos para modificar la configuración del sistema');
    }

    const config = await this.findOne(clave);
    config.valor = dto.valor;
    return this.configuracionRepository.save(config);
  }
}
