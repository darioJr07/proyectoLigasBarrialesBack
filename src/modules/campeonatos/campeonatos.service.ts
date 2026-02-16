import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campeonato } from './entities/campeonato.entity';
import { CreateCampeonatoDto } from './dto/create-campeonato.dto';
import { UpdateCampeonatoDto } from './dto/update-campeonato.dto';

@Injectable()
export class CampeonatosService {
  constructor(
    @InjectRepository(Campeonato)
    private campeonatosRepository: Repository<Campeonato>,
  ) {}

  /**
   * Crear un nuevo campeonato
   * Solo master y directivo_liga pueden crear campeonatos
   */
  async create(
    createCampeonatoDto: CreateCampeonatoDto,
    usuario: any,
  ): Promise<Campeonato> {
    // Validar que directivo_liga solo pueda crear campeonatos de su liga
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== createCampeonatoDto.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para crear campeonatos en esta liga',
      );
    }

    // Validar fechas
    const inicio = new Date(createCampeonatoDto.fechaInicio);
    const fin = new Date(createCampeonatoDto.fechaFin);
    const limiteInscripcion = new Date(createCampeonatoDto.fechaLimiteInscripcion);

    if (fin <= inicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    if (limiteInscripcion >= inicio) {
      throw new BadRequestException(
        'La fecha límite de inscripción debe ser anterior a la fecha de inicio',
      );
    }

    const campeonato = this.campeonatosRepository.create(createCampeonatoDto);
    return await this.campeonatosRepository.save(campeonato);
  }

  /**
   * Obtener todos los campeonatos filtrados por rol
   */
  async findAll(usuario: any): Promise<Campeonato[]> {
    const query = this.campeonatosRepository
      .createQueryBuilder('campeonato')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .where('campeonato.activo = :activo', { activo: true });

    // Filtrar por liga si es directivo_liga
    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId) {
        return [];
      }
      query.andWhere('campeonato.ligaId = :ligaId', { ligaId: usuario.ligaId });
    }

    // Filtrar por liga del equipo si es dirigente_equipo
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        return [];
      }
      // Obtener ligaId del equipo del usuario (requiere join adicional)
      query
        .leftJoin('equipos', 'equipo', 'equipo.id = :equipoId', { equipoId: usuario.equipoId })
        .andWhere('campeonato.ligaId = equipo.ligaId');
    }

    return await query.getMany();
  }

  /**
   * Obtener campeonatos de una liga específica
   */
  async findByLiga(ligaId: number, usuario: any): Promise<Campeonato[]> {
    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== ligaId) {
      throw new ForbiddenException('No tienes permisos para ver campeonatos de esta liga');
    }

    return await this.campeonatosRepository.find({
      where: { ligaId, activo: true },
    });
  }

  /**
   * Obtener un campeonato por ID
   */
  async findOne(id: number, usuario: any): Promise<Campeonato> {
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id },
    });

    if (!campeonato) {
      throw new NotFoundException(`Campeonato con ID ${id} no encontrado`);
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para ver este campeonato');
    }

    return campeonato;
  }

  /**
   * Actualizar un campeonato
   */
  async update(
    id: number,
    updateCampeonatoDto: UpdateCampeonatoDto,
    usuario: any,
  ): Promise<Campeonato> {
    const campeonato = await this.findOne(id, usuario);

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para editar este campeonato');
    }

    // Validar cambio de ligaId
    if (updateCampeonatoDto.ligaId && updateCampeonatoDto.ligaId !== campeonato.ligaId) {
      if (usuario.role === 'directivo_liga') {
        throw new ForbiddenException('No puedes cambiar el campeonato a otra liga');
      }
    }

    Object.assign(campeonato, updateCampeonatoDto);
    return await this.campeonatosRepository.save(campeonato);
  }

  /**
   * Soft delete - deshabilitar campeonato
   */
  async remove(id: number, usuario: any): Promise<void> {
    const campeonato = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para eliminar este campeonato');
    }

    campeonato.activo = false;
    await this.campeonatosRepository.save(campeonato);
  }

  /**
   * Cambiar estado de un campeonato
   */
  async cambiarEstado(
    id: number,
    estado: 'inscripcion_abierta' | 'en_curso' | 'finalizado' | 'cancelado',
    usuario: any,
  ): Promise<Campeonato> {
    const campeonato = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para cambiar el estado de este campeonato');
    }

    campeonato.estado = estado;
    return await this.campeonatosRepository.save(campeonato);
  }
}
