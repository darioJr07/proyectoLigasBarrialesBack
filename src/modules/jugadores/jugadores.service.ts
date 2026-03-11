import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Jugador } from './entities/jugador.entity';
import { CreateJugadorDto } from './dto/create-jugador.dto';
import { UpdateJugadorDto } from './dto/update-jugador.dto';
import { Equipo } from '../equipos/entities/equipo.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Usuario } from '../auth/entities/usuario.entity';
import { UploadService } from '../upload/upload.service';

/**
 * Servicio para gestión de jugadores
 * Aplica Single Responsibility Principle
 */
@Injectable()
export class JugadoresService {
  constructor(
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
    @InjectRepository(Equipo)
    private readonly equipoRepository: Repository<Equipo>,
    @InjectRepository(JugadorCampeonato)
    private readonly jugadorCampeonatoRepository: Repository<JugadorCampeonato>,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Verifica si una URL corresponde a una imagen de Cloudinary
   */
  private isCloudinaryUrl(url: string): boolean {
    return typeof url === 'string' && url.includes('res.cloudinary.com');
  }

  /**
   * Elimina una imagen de Cloudinary de forma no bloqueante
   * Si falla, solo registra el error sin interrumpir la operación principal
   */
  private async deleteOldImageSafely(url: string): Promise<void> {
    if (url && this.isCloudinaryUrl(url)) {
      try {
        await this.uploadService.deleteImage(url);
      } catch (error) {
        console.error(`No se pudo eliminar imagen antigua de Cloudinary: ${error.message}`);
      }
    }
  }

  /**
   * Valida que una cédula ecuatoriana sea válida mediante el algoritmo oficial
   */
  private validateCedulaEcuatoriana(cedula: string): boolean {
    if (!/^\d{10}$/.test(cedula)) return false;

    const provincia = parseInt(cedula.substring(0, 2));
    if (provincia < 1 || provincia > 24) return false;

    const tercerDigito = parseInt(cedula[2]);
    if (tercerDigito >= 6) return false;

    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let valor = parseInt(cedula[i]) * coeficientes[i];
      if (valor >= 10) valor -= 9;
      suma += valor;
    }
    const digitoVerificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
    return digitoVerificador === parseInt(cedula[9]);
  }

  /**
   * Crear un nuevo jugador
   */
  async create(
    createJugadorDto: CreateJugadorDto,
    userId?: number,
    userRole?: string,
    userLigaId?: number,
  ): Promise<Jugador> {
    const { equipoId, cedula, ...jugadorData } = createJugadorDto;

    // Validar cédula única si se proporciona
    if (cedula) {
      const jugadorExistente = await this.jugadorRepository.findOne({
        where: { cedula },
      });

      if (jugadorExistente) {
        throw new BadRequestException('Ya existe un jugador con esta cédula');
      }
    }

    // Validar algoritmo de cédula ecuatoriana
    if (createJugadorDto.tipoDocumento === 'Cédula' && cedula) {
      if (!this.validateCedulaEcuatoriana(cedula)) {
        throw new BadRequestException('La cédula ingresada no es válida según el registro civil ecuatoriano');
      }
    }

    // Validar equipo si se proporciona
    if (equipoId) {
      const equipo = await this.equipoRepository.findOne({
        where: { id: equipoId },
      });

      if (!equipo) {
        throw new NotFoundException('Equipo no encontrado');
      }

      // Validar permisos según rol
      if (userId && userRole && userRole !== 'master') {
        // Directivo de liga puede crear jugadores para equipos de su liga
        if (userRole === 'directivo_liga') {
          if (!userLigaId || equipo.ligaId !== userLigaId) {
            throw new ForbiddenException(
              'No tienes permisos para asignar jugadores a equipos de otras ligas',
            );
          }
        }
        // Dirigente de equipo solo puede crear jugadores para su equipo
        else if (equipo.dirigenteId !== userId) {
          throw new ForbiddenException(
            'No tienes permisos para asignar jugadores a este equipo',
          );
        }
      }
    }

    const jugador = this.jugadorRepository.create({
      ...jugadorData,
      cedula,
      equipoId: equipoId || null,
    });

    return this.jugadorRepository.save(jugador);
  }

  /**
   * Obtener todos los jugadores
   * Filtra según el rol del usuario:
   * - master: ve todos los jugadores
   * - directivo_liga: ve jugadores de equipos de su liga
   * - dirigente_equipo: ve solo jugadores de su equipo
   * - otros: no tienen acceso
   */
  async findAll(usuario: Usuario): Promise<Jugador[]> {
    const rolNombre = usuario.rol.nombre;

    // Master ve todos los jugadores
    if (rolNombre === 'master') {
      return this.jugadorRepository.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      });
    }

    // Directivo de liga ve jugadores de equipos de su liga
    if (rolNombre === 'directivo_liga') {
      if (!usuario.ligaId) {
        // Si no tiene liga asignada, retorna array vacío
        return [];
      }

      // Obtener equipos de la liga
      const equipos = await this.equipoRepository.find({
        where: { ligaId: usuario.ligaId, activo: true },
        select: ['id'],
      });

      if (equipos.length === 0) {
        return [];
      }

      const equipoIds = equipos.map(e => e.id);

      return this.jugadorRepository.find({
        where: { equipoId: In(equipoIds), activo: true },
        order: { nombre: 'ASC' },
      });
    }

    // Dirigente de equipo ve solo jugadores de su equipo
    if (rolNombre === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        // Si no tiene equipo asignado, retorna array vacío
        return [];
      }

      return this.jugadorRepository.find({
        where: { equipoId: usuario.equipoId, activo: true },
        order: { nombre: 'ASC' },
      });
    }

    // Otros roles no tienen acceso
    return [];
  }

  /**
   * Obtener jugadores por equipo
   */
  async findByEquipo(equipoId: number): Promise<Jugador[]> {
    return this.jugadorRepository.find({
      where: { equipoId, activo: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtener jugadores sin equipo
   */
  async findLibres(): Promise<Jugador[]> {
    return this.jugadorRepository.find({
      where: { equipoId: IsNull(), activo: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtener un jugador por ID
   */
  async findOne(id: number): Promise<Jugador> {
    const jugador = await this.jugadorRepository.findOne({ where: { id } });

    if (!jugador) {
      throw new NotFoundException(`Jugador con ID ${id} no encontrado`);
    }

    return jugador;
  }

  /**
   * Actualizar un jugador
   */
  async update(
    id: number,
    updateJugadorDto: UpdateJugadorDto,
    userId: number,
    userRole: string,
    userLigaId?: number,
  ): Promise<Jugador> {
    const jugador = await this.findOne(id);

    // Validar cédula única si se actualiza
    if (updateJugadorDto.cedula && updateJugadorDto.cedula !== jugador.cedula) {
      const jugadorExistente = await this.jugadorRepository.findOne({
        where: { cedula: updateJugadorDto.cedula },
      });

      if (jugadorExistente) {
        throw new BadRequestException('Ya existe un jugador con esta cédula');
      }
    }

    // Validar algoritmo de cédula ecuatoriana si se actualiza la cédula
    if (updateJugadorDto.cedula) {
      const tipoDocumentoEfectivo = updateJugadorDto.tipoDocumento ?? jugador.tipoDocumento;
      if (tipoDocumentoEfectivo === 'Cédula') {
        if (!this.validateCedulaEcuatoriana(updateJugadorDto.cedula)) {
          throw new BadRequestException('La cédula ingresada no es válida según el registro civil ecuatoriano');
        }
      }
    }

    // Validar cambio de equipo
    if (updateJugadorDto.equipoId !== undefined) {
      if (updateJugadorDto.equipoId) {
        const equipo = await this.equipoRepository.findOne({
          where: { id: updateJugadorDto.equipoId },
        });

        if (!equipo) {
          throw new NotFoundException('Equipo no encontrado');
        }

        // Validar permisos según rol
        if (userRole !== 'master') {
          // Directivo de liga puede editar jugadores de equipos de su liga
          if (userRole === 'directivo_liga') {
            if (!userLigaId || equipo.ligaId !== userLigaId) {
              throw new ForbiddenException(
                'No tienes permisos para asignar jugadores a equipos de otras ligas',
              );
            }
          }
          // Dirigente de equipo solo puede editar jugadores de su equipo
          else if (equipo.dirigenteId !== userId) {
            throw new ForbiddenException(
              'No tienes permisos para asignar jugadores a este equipo',
            );
          }
        }
      }
    }

    // Eliminar imagen anterior de Cloudinary si se está reemplazando
    if (
      updateJugadorDto.imagen !== undefined &&
      updateJugadorDto.imagen !== jugador.imagen &&
      jugador.imagen
    ) {
      await this.deleteOldImageSafely(jugador.imagen);
    }

    // Eliminar imagen de cédula anterior de Cloudinary si se está reemplazando
    if (
      updateJugadorDto.imagenCedula !== undefined &&
      updateJugadorDto.imagenCedula !== jugador.imagenCedula &&
      jugador.imagenCedula
    ) {
      await this.deleteOldImageSafely(jugador.imagenCedula);
    }

    Object.assign(jugador, updateJugadorDto);
    // Forzar la relación eager para que TypeORM use el FK actualizado al guardar
    if (updateJugadorDto.equipoId !== undefined) {
      jugador.equipo = updateJugadorDto.equipoId
        ? ({ id: updateJugadorDto.equipoId } as any)
        : (null as any);
    }
    return this.jugadorRepository.save(jugador);
  }

  /**
   * Deshabilitar un jugador (soft delete)
   * - master: puede desactivar cualquier jugador
   * - directivo_liga: solo jugadores de equipos de su liga, y solo si no tienen habilitación activa ('habilitado')
   */
  async remove(id: number, userRole: string, userLigaId?: number): Promise<{ message: string }> {
    const jugador = await this.findOne(id);

    if (userRole !== 'master') {
      if (userRole !== 'directivo_liga') {
        throw new ForbiddenException('No tienes permisos para deshabilitar jugadores');
      }

      // Verificar que el jugador pertenece a un equipo de la liga del directivo
      if (!userLigaId || !jugador.equipo || jugador.equipo.ligaId !== userLigaId) {
        throw new ForbiddenException('Solo puedes deshabilitar jugadores de equipos de tu propia liga');
      }

      // Verificar que no tenga habilitaciones activas (estado 'habilitado')
      const habilitacionActiva = await this.jugadorCampeonatoRepository.findOne({
        where: { jugadorId: id, estado: 'habilitado', activo: true },
      });

      if (habilitacionActiva) {
        throw new ForbiddenException(
          'No se puede deshabilitar un jugador que tiene una habilitación activa aprobada. Rechaza primero la habilitación.',
        );
      }
    }

    jugador.activo = false;
    await this.jugadorRepository.save(jugador);

    return { message: 'Jugador deshabilitado exitosamente' };
  }

  /**
   * Eliminar permanentemente un jugador
   */
  async removePermanently(
    id: number,
    userRole: string,
  ): Promise<{ message: string }> {
    if (userRole !== 'master') {
      throw new ForbiddenException(
        'Solo el administrador puede eliminar jugadores permanentemente',
      );
    }

    const jugador = await this.findOne(id);
    await this.jugadorRepository.remove(jugador);

    return { message: 'Jugador eliminado permanentemente' };
  }
}
