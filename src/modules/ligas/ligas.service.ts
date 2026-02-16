import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Liga } from './entities/liga.entity';
import { CreateLigaDto } from './dto/create-liga.dto';
import { UpdateLigaDto } from './dto/update-liga.dto';
import { Usuario } from '../auth/entities/usuario.entity';

/**
 * Servicio de Ligas
 * Aplica principios SOLID:
 * - Single Responsibility: Solo maneja lógica de negocio de ligas
 * - Dependency Inversion: Depende de abstracciones (Repository)
 * - Open/Closed: Abierto a extensión, cerrado a modificación
 */
@Injectable()
export class LigasService {
  constructor(
    @InjectRepository(Liga)
    private readonly ligaRepository: Repository<Liga>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  /**
   * Crea una nueva liga
   * Solo usuarios con rol 'master' pueden crear ligas
   */
  async create(createLigaDto: CreateLigaDto, usuario: Usuario): Promise<Liga> {
    // Validar que solo el rol master pueda crear ligas
    if (usuario.rol.nombre !== 'master') {
      throw new ForbiddenException(
        'No tienes permisos para crear ligas. Solo usuarios master pueden hacerlo.',
      );
    }

    // Validar directivo solo si se proporciona (no obligatorio al crear)
    let directivo = null;
    if (createLigaDto.directivoId) {
      directivo = await this.usuarioRepository.findOne({
        where: { id: createLigaDto.directivoId },
        relations: ['rol'],
      });

      if (!directivo) {
        throw new NotFoundException(
          `Usuario con ID ${createLigaDto.directivoId} no encontrado`,
        );
      }

      if (directivo.rol.nombre !== 'directivo_liga') {
        throw new ConflictException(
          'El usuario asignado debe tener el rol de directivo_liga',
        );
      }

      // Validar que el directivo no esté asignado a otra liga
      const ligaDelDirectivo = await this.ligaRepository.findOne({
        where: { directivoId: createLigaDto.directivoId },
      });
      if (ligaDelDirectivo) {
        throw new ConflictException(
          `El usuario directivo ya está asignado a la liga "${ligaDelDirectivo.nombre}". Un directivo solo puede pertenecer a una liga.`
        );
      }
    }

    // Verificar que no exista una liga con el mismo nombre
    const ligaExistente = await this.ligaRepository.findOne({
      where: { nombre: createLigaDto.nombre },
    });

    if (ligaExistente) {
      throw new ConflictException(
        `Ya existe una liga con el nombre "${createLigaDto.nombre}"`,
      );
    }

    const liga = this.ligaRepository.create(createLigaDto);
    const ligaGuardada = await this.ligaRepository.save(liga);

    // Actualizar el usuario directivo solo si se proporcionó
    if (directivo) {
      directivo.ligaId = ligaGuardada.id;
      await this.usuarioRepository.save(directivo);
    }

    return ligaGuardada;
  }

  /**
   * Obtiene todas las ligas
   * Filtra según el rol del usuario:
   * - master: ve todas las ligas
   * - directivo_liga: solo ve su liga
   * - otros: no tienen acceso
   */
  async findAll(usuario: Usuario): Promise<Liga[]> {
    const rolNombre = usuario.rol.nombre;

    // Master ve todas las ligas
    if (rolNombre === 'master') {
      return await this.ligaRepository.find({
        order: { nombre: 'ASC' },
      });
    }

    // Directivo de liga solo ve su liga
    if (rolNombre === 'directivo_liga') {
      if (!usuario.ligaId) {
        // Si no tiene liga asignada, retorna array vacío
        return [];
      }

      const liga = await this.ligaRepository.findOne({
        where: { id: usuario.ligaId },
      });

      return liga ? [liga] : [];
    }

    // Otros roles no tienen acceso a ligas
    return [];
  }

  /**
   * Obtiene todas las ligas activas
   */
  async findActive(): Promise<Liga[]> {
    return await this.ligaRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene una liga por ID
   */
  async findOne(id: number): Promise<Liga> {
    const liga = await this.ligaRepository.findOne({
      where: { id },
    });

    if (!liga) {
      throw new NotFoundException(`Liga con ID ${id} no encontrada`);
    }

    return liga;
  }

  /**
   * Actualiza una liga
   * Solo el usuario master o el directivo de la liga pueden actualizarla
   */
  async update(
    id: number,
    updateLigaDto: UpdateLigaDto,
    usuario: Usuario,
  ): Promise<Liga> {
    const liga = await this.findOne(id);

    // Validar permisos: solo master o el directivo de la liga pueden actualizar
    const esMaster = usuario.rol.nombre === 'master';
    const esDirectivoDeLaLiga = liga.directivoId === usuario.id;

    if (!esMaster && !esDirectivoDeLaLiga) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar esta liga',
      );
    }

    // Si se está cambiando el directivo, validar que exista y tenga el rol adecuado
    if (updateLigaDto.directivoId && updateLigaDto.directivoId !== liga.directivoId) {
      const nuevoDirectivo = await this.usuarioRepository.findOne({
        where: { id: updateLigaDto.directivoId },
        relations: ['rol'],
      });

      if (!nuevoDirectivo) {
        throw new NotFoundException(
          `Usuario con ID ${updateLigaDto.directivoId} no encontrado`,
        );
      }

      if (nuevoDirectivo.rol.nombre !== 'directivo_liga') {
        throw new ConflictException(
          'El usuario asignado debe tener el rol de directivo_liga',
        );
      }

      // Validar que el nuevo directivo no esté asignado a otra liga
      const ligaDelNuevoDirectivo = await this.ligaRepository.findOne({
        where: { directivoId: updateLigaDto.directivoId },
      });
      if (ligaDelNuevoDirectivo && ligaDelNuevoDirectivo.id !== liga.id) {
        throw new ConflictException(
          `El usuario directivo ya está asignado a la liga "${ligaDelNuevoDirectivo.nombre}". Un directivo solo puede pertenecer a una liga.`
        );
      }

      // Remover la referencia de liga del directivo anterior
      const directivoAnterior = await this.usuarioRepository.findOne({
        where: { id: liga.directivoId },
      });
      if (directivoAnterior) {
        directivoAnterior.ligaId = null;
        await this.usuarioRepository.save(directivoAnterior);
      }

      // Asignar la liga al nuevo directivo
      nuevoDirectivo.ligaId = liga.id;
      await this.usuarioRepository.save(nuevoDirectivo);
    }

    // Si se está cambiando el nombre, verificar que no exista otra liga con ese nombre
    if (updateLigaDto.nombre && updateLigaDto.nombre !== liga.nombre) {
      const ligaExistente = await this.ligaRepository.findOne({
        where: { nombre: updateLigaDto.nombre },
      });

      if (ligaExistente) {
        throw new ConflictException(
          `Ya existe una liga con el nombre "${updateLigaDto.nombre}"`,
        );
      }
    }

    Object.assign(liga, updateLigaDto);
    return await this.ligaRepository.save(liga);
  }

  /**
   * Desactiva una liga (soft delete)
   * Solo el usuario master puede desactivar ligas
   */
  async remove(id: number, usuario: Usuario): Promise<{ message: string }> {
    if (usuario.rol.nombre !== 'master') {
      throw new ForbiddenException(
        'No tienes permisos para desactivar ligas. Solo usuarios master pueden hacerlo.',
      );
    }

    const liga = await this.findOne(id);
    liga.activo = false;
    await this.ligaRepository.save(liga);

    return {
      message: `Liga "${liga.nombre}" desactivada exitosamente`,
    };
  }

  /**
   * Elimina permanentemente una liga de la base de datos
   * Solo el usuario master puede eliminar ligas permanentemente
   * También limpia la referencia de liga en el usuario directivo
   */
  async removePermanently(id: number, usuario: Usuario): Promise<{ message: string }> {
    if (usuario.rol.nombre !== 'master') {
      throw new ForbiddenException(
        'No tienes permisos para eliminar ligas permanentemente. Solo usuarios master pueden hacerlo.',
      );
    }

    const liga = await this.findOne(id);
    
    // Limpiar la referencia de liga en el usuario directivo
    const directivo = await this.usuarioRepository.findOne({
      where: { id: liga.directivoId },
    });
    
    if (directivo) {
      directivo.ligaId = null;
      await this.usuarioRepository.save(directivo);
    }

    // Eliminar la liga permanentemente
    await this.ligaRepository.remove(liga);

    return {
      message: `Liga "${liga.nombre}" eliminada permanentemente`,
    };
  }
}
