import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from '../modules/auth/entities/rol.entity';
import { Usuario } from '../modules/auth/entities/usuario.entity';
import { ConfiguracionSistema } from '../modules/configuracion/entities/configuracion-sistema.entity';
import * as bcrypt from 'bcrypt';

/**
 * Servicio de inicialización de base de datos
 * Se ejecuta automáticamente al arrancar la aplicación
 * Crea roles y usuario admin si no existen
 */
@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectRepository(Rol)
    private rolRepository: Repository<Rol>,
    @InjectRepository(Usuario)
    private usuarioRepository: Repository<Usuario>,
    @InjectRepository(ConfiguracionSistema)
    private configuracionRepository: Repository<ConfiguracionSistema>,
  ) {}

  async onModuleInit() {
    this.logger.log('🌱 Iniciando seed de base de datos...');
    await this.seedRoles();
    await this.seedAdminUser();
    await this.seedConfiguracion();
    this.logger.log('✅ Seed de base de datos completado');
  }

  /**
   * Crea los roles básicos del sistema si no existen
   */
  private async seedRoles(): Promise<void> {
    const roles = [
      { nombre: 'master', descripcion: 'Administrador del sistema con acceso total' },
      { nombre: 'directivo_liga', descripcion: 'Directivo de una liga' },
      { nombre: 'dirigente_equipo', descripcion: 'Dirigente de un equipo' },
      { nombre: 'tribuna_penas', descripcion: 'Miembro de la Tribuna de Penas' },
      { nombre: 'tesoreria', descripcion: 'Responsable de Tesorería' },
    ];

    for (const rolData of roles) {
      const existe = await this.rolRepository.findOne({
        where: { nombre: rolData.nombre },
      });

      if (!existe) {
        const rol = this.rolRepository.create(rolData);
        await this.rolRepository.save(rol);
        this.logger.log(`✓ Rol creado: ${rolData.nombre}`);
      } else {
        this.logger.log(`• Rol ya existe: ${rolData.nombre}`);
      }
    }
  }

  /**
   * Crea el usuario administrador por defecto si no existe
   * Credenciales:
   * - Email: admin@ligasbarriales.com
   * - Contraseña: password123
   * 
   * ⚠️ IMPORTANTE: Cambiar la contraseña después del primer inicio de sesión
   */
  private async seedAdminUser(): Promise<void> {
    const adminEmail = 'admin@ligasbarriales.com';
    
    // Verificar si el admin ya existe
    const adminExiste = await this.usuarioRepository.findOne({
      where: { email: adminEmail },
    });

    if (adminExiste) {
      this.logger.log(`• Usuario admin ya existe: ${adminEmail}`);
      return;
    }

    // Obtener el rol master
    const rolMaster = await this.rolRepository.findOne({
      where: { nombre: 'master' },
    });

    if (!rolMaster) {
      this.logger.error('❌ No se pudo crear el usuario admin: rol master no encontrado');
      return;
    }

    // Crear usuario admin
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = this.usuarioRepository.create({
      nombre: 'Administrador Sistema',
      email: adminEmail,
      password: hashedPassword,
      rol: rolMaster,
      activo: true,
    });

    await this.usuarioRepository.save(admin);
    
    this.logger.log('✓ Usuario admin creado exitosamente');
    this.logger.log(`  📧 Email: ${adminEmail}`);
    this.logger.log(`  🔑 Contraseña: ${password}`);
    this.logger.warn('  ⚠️  IMPORTANTE: Cambiar la contraseña después del primer inicio de sesión');
  }

  /**
   * Crea las configuraciones globales por defecto si no existen
   * Por defecto todos los módulos están habilitados (valor: 'true')
   */
  private async seedConfiguracion(): Promise<void> {
    const configs = [
      {
        clave: 'modulo_jugadores',
        valor: 'true',
        descripcion: 'Permite a los dirigentes de equipo acceder al módulo de Jugadores (registrar y editar jugadores)',
      },
      {
        clave: 'modulo_inscripciones',
        valor: 'true',
        descripcion: 'Permite a los dirigentes de equipo acceder al módulo de Inscripciones/Habilitaciones',
      },
      {
        clave: 'modulo_transferencias',
        valor: 'true',
        descripcion: 'Permite a los dirigentes de equipo acceder al módulo de Transferencias',
      },
    ];

    for (const configData of configs) {
      const existe = await this.configuracionRepository.findOne({
        where: { clave: configData.clave },
      });

      if (!existe) {
        const config = this.configuracionRepository.create(configData);
        await this.configuracionRepository.save(config);
        this.logger.log(`✓ Configuración creada: ${configData.clave} = ${configData.valor}`);
      } else {
        this.logger.log(`• Configuración ya existe: ${configData.clave} = ${existe.valor}`);
      }
    }
  }
}
