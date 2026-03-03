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
import { Usuario } from '../auth/entities/usuario.entity';

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
  ) {}

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
   */
  async remove(id: number, userRole: string): Promise<{ message: string }> {
    const jugador = await this.findOne(id);

    // Solo master puede deshabilitar jugadores
    if (userRole !== 'master') {
      throw new ForbiddenException(
        'No tienes permisos para deshabilitar jugadores',
      );
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
