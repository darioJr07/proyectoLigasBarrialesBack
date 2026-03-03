import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipo } from './entities/equipo.entity';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { Usuario } from '../auth/entities/usuario.entity';
import { Liga } from '../ligas/entities/liga.entity';

/**
 * Servicio para gestión de equipos
 * Aplica Single Responsibility Principle
 */
@Injectable()
export class EquiposService {
  constructor(
    @InjectRepository(Equipo)
    private readonly equipoRepository: Repository<Equipo>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Liga)
    private readonly ligaRepository: Repository<Liga>,
  ) {}

  /**
   * Crear un nuevo equipo
   */
  async create(createEquipoDto: CreateEquipoDto, userId: number): Promise<Equipo> {
    const { dirigenteId, ligaId, ...equipoData } = createEquipoDto;

    // Validar que el dirigente existe
    const dirigente = await this.usuarioRepository.findOne({
      where: { id: dirigenteId },
      relations: ['rol'],
    });

    if (!dirigente) {
      throw new NotFoundException('Dirigente no encontrado');
    }

    // Validar que el dirigente no tiene ya un equipo
    const equipoExistente = await this.equipoRepository.findOne({
      where: { dirigenteId, activo: true },
    });

    if (equipoExistente) {
      throw new BadRequestException(
        'Este dirigente ya tiene un equipo asignado',
      );
    }

    // Validar que la liga existe
    const liga = await this.ligaRepository.findOne({ where: { id: ligaId } });
    if (!liga) {
      throw new NotFoundException('Liga no encontrada');
    }

    // Crear equipo
    const equipo = this.equipoRepository.create({
      ...equipoData,
      ligaId,
      dirigenteId,
    });

    const equipoGuardado = await this.equipoRepository.save(equipo);

    // Actualizar usuario con equipo_id
    await this.usuarioRepository.update(dirigenteId, {
      equipoId: equipoGuardado.id,
    });

    return equipoGuardado;
  }

  /**
   * Obtener todos los equipos
   * Filtra según el rol del usuario:
   * - master: ve todos los equipos
   * - directivo_liga: ve equipos de su liga
   * - dirigente_equipo: ve solo su equipo
   * - otros: no tienen acceso
   */
  async findAll(usuario: Usuario): Promise<Equipo[]> {
    const rolNombre = usuario.rol.nombre;

    // Master ve todos los equipos
    if (rolNombre === 'master') {
      return this.equipoRepository.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      });
    }

    // Directivo de liga ve equipos de su liga
    if (rolNombre === 'directivo_liga') {
      if (!usuario.ligaId) {
        // Si no tiene liga asignada, retorna array vacío
        return [];
      }

      return this.equipoRepository.find({
        where: { ligaId: usuario.ligaId, activo: true },
        order: { nombre: 'ASC' },
      });
    }

    // Dirigente de equipo ve solo su equipo
    if (rolNombre === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        // Si no tiene equipo asignado, retorna array vacío
        return [];
      }

      const equipo = await this.equipoRepository.findOne({
        where: { id: usuario.equipoId, activo: true },
      });

      return equipo ? [equipo] : [];
    }

    // Otros roles no tienen acceso
    return [];
  }

  /**
   * Obtener equipos por liga
   */
  async findByLiga(ligaId: number): Promise<Equipo[]> {
    return this.equipoRepository.find({
      where: { ligaId, activo: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtener un equipo por ID
   */
  async findOne(id: number): Promise<Equipo> {
    const equipo = await this.equipoRepository.findOne({ where: { id } });

    if (!equipo) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    return equipo;
  }

  /**
   * Actualizar un equipo
   */
  async update(
    id: number,
    updateEquipoDto: UpdateEquipoDto,
    userId: number,
    userRole: string,
  ): Promise<Equipo> {
    const equipo = await this.findOne(id);

    // Solo master o directivo_liga pueden actualizar equipos
    if (userRole !== 'master' && userRole !== 'directivo_liga') {
      throw new ForbiddenException(
        'No tienes permisos para actualizar este equipo',
      );
    }

    // Si se cambia el dirigente, validar y limpiar referencias
    if (updateEquipoDto.dirigenteId && updateEquipoDto.dirigenteId !== equipo.dirigenteId) {
      // Limpiar equipo_id del dirigente anterior
      if (equipo.dirigenteId) {
        await this.usuarioRepository.update(equipo.dirigenteId, {
          equipoId: null,
        });
      }

      // Validar nuevo dirigente
      const nuevoDirigente = await this.usuarioRepository.findOne({
        where: { id: updateEquipoDto.dirigenteId },
      });

      if (!nuevoDirigente) {
        throw new NotFoundException('Nuevo dirigente no encontrado');
      }

      // Verificar que no tenga otro equipo
      const equipoExistente = await this.equipoRepository.findOne({
        where: { dirigenteId: updateEquipoDto.dirigenteId, activo: true },
      });

      if (equipoExistente && equipoExistente.id !== id) {
        throw new BadRequestException(
          'Este dirigente ya tiene un equipo asignado',
        );
      }

      // Actualizar equipo_id del nuevo dirigente
      await this.usuarioRepository.update(updateEquipoDto.dirigenteId, {
        equipoId: id,
      });
    }

    Object.assign(equipo, updateEquipoDto);
    // Forzar relaciones eager para que TypeORM use los FK actualizados al guardar
    if (updateEquipoDto.ligaId !== undefined) {
      equipo.liga = updateEquipoDto.ligaId
        ? ({ id: updateEquipoDto.ligaId } as any)
        : (null as any);
    }
    if (updateEquipoDto.dirigenteId !== undefined) {
      equipo.dirigente = updateEquipoDto.dirigenteId
        ? ({ id: updateEquipoDto.dirigenteId } as any)
        : (null as any);
    }
    return this.equipoRepository.save(equipo);
  }

  /**
   * Deshabilitar un equipo (soft delete)
   */
  async remove(id: number, userId: number, userRole: string): Promise<{ message: string }> {
    const equipo = await this.findOne(id);

    // Solo master puede deshabilitar equipos
    if (userRole !== 'master') {
      throw new ForbiddenException(
        'No tienes permisos para deshabilitar equipos',
      );
    }

    equipo.activo = false;
    await this.equipoRepository.save(equipo);

    return { message: 'Equipo deshabilitado exitosamente' };
  }

  /**
   * Eliminar permanentemente un equipo
   */
  async removePermanently(
    id: number,
    userRole: string,
  ): Promise<{ message: string }> {
    if (userRole !== 'master') {
      throw new ForbiddenException(
        'Solo el administrador puede eliminar equipos permanentemente',
      );
    }

    const equipo = await this.findOne(id);

    // Limpiar referencia en usuario
    if (equipo.dirigenteId) {
      await this.usuarioRepository.update(equipo.dirigenteId, {
        equipoId: null,
      });
    }

    await this.equipoRepository.remove(equipo);

    return { message: 'Equipo eliminado permanentemente' };
  }
}
