import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Inscripcion } from './entities/inscripcion.entity';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dto/update-inscripcion.dto';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Equipo } from '../equipos/entities/equipo.entity';

@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private inscripcionesRepository: Repository<Inscripcion>,
    @InjectRepository(Campeonato)
    private campeonatosRepository: Repository<Campeonato>,
    @InjectRepository(Categoria)
    private categoriasRepository: Repository<Categoria>,
    @InjectRepository(Equipo)
    private equiposRepository: Repository<Equipo>,
  ) {}

  /**
   * Crear una nueva inscripción
   */
  async create(
    createInscripcionDto: CreateInscripcionDto,
    usuario: any,
  ): Promise<Inscripcion> {
    // Verificar campeonato
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id: createInscripcionDto.campeonatoId },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    // Validar que campeonato esté en inscripción_abierta
    if (campeonato.estado !== 'inscripcion_abierta') {
      throw new BadRequestException(
        'El campeonato no está aceptando inscripciones',
      );
    }

    // Validar fecha límite de inscripción
    if (new Date() > new Date(campeonato.fechaLimiteInscripcion)) {
      throw new BadRequestException(
        'La fecha límite de inscripción ha expirado',
      );
    }

    // Verificar categoría
    const categoria = await this.categoriasRepository.findOne({
      where: { id: createInscripcionDto.categoriaId },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Validar que categoría pertenezca al campeonato
    if (categoria.campeonatoId !== createInscripcionDto.campeonatoId) {
      throw new BadRequestException(
        'La categoría no pertenece a este campeonato',
      );
    }

    // Verificar equipo
    const equipo = await this.equiposRepository.findOne({
      where: { id: createInscripcionDto.equipoId },
    });

    if (!equipo) {
      throw new NotFoundException('Equipo no encontrado');
    }

    // Validar que el equipo pertenezca a la liga del campeonato
    if (equipo.ligaId !== campeonato.ligaId) {
      throw new BadRequestException(
        'El equipo no pertenece a la liga de este campeonato',
      );
    }

    // Validar permisos del usuario
    if (usuario.role === 'dirigente_equipo') {
      if (usuario.equipoId !== createInscripcionDto.equipoId) {
        throw new ForbiddenException(
          'Solo puedes inscribir tu propio equipo',
        );
      }
    } else if (usuario.role === 'directivo_liga') {
      if (usuario.ligaId !== campeonato.ligaId) {
        throw new ForbiddenException(
          'No tienes permisos para inscribir equipos en este campeonato',
        );
      }
    }

    // Validar que el equipo no esté ya inscrito en este campeonato
    // Solo considerar inscripciones pendientes o confirmadas (no rechazadas)
    const inscripcionExistente = await this.inscripcionesRepository.findOne({
      where: {
        campeonatoId: createInscripcionDto.campeonatoId,
        equipoId: createInscripcionDto.equipoId,
        activo: true,
        estado: In(['pendiente', 'confirmada']),
      },
    });

    if (inscripcionExistente) {
      throw new BadRequestException(
        'El equipo ya tiene una inscripción pendiente o confirmada en este campeonato',
      );
    }

    // Buscar si existe una inscripción rechazada para reutilizarla
    const inscripcionRechazada = await this.inscripcionesRepository.findOne({
      where: {
        campeonatoId: createInscripcionDto.campeonatoId,
        equipoId: createInscripcionDto.equipoId,
        activo: true,
        estado: 'rechazada',
      },
    });

    // Si existe una inscripción rechazada, reutilizarla
    if (inscripcionRechazada) {
      inscripcionRechazada.categoriaId = createInscripcionDto.categoriaId;
      inscripcionRechazada.estado = usuario.role === 'directivo_liga' ? 'confirmada' : 'pendiente';
      inscripcionRechazada.observaciones = createInscripcionDto.observaciones || '';
      inscripcionRechazada.fechaInscripcion = new Date();
      
      return await this.inscripcionesRepository.save(inscripcionRechazada);
    }

    // Si no existe inscripción rechazada, crear una nueva
    const inscripcion = this.inscripcionesRepository.create({
      ...createInscripcionDto,
      estado: usuario.role === 'directivo_liga' ? 'confirmada' : 'pendiente',
    });

    return await this.inscripcionesRepository.save(inscripcion);
  }

  /**
   * Obtener todas las inscripciones filtradas por permisos
   */
  async findAll(usuario: any): Promise<Inscripcion[]> {
    const query = this.inscripcionesRepository
      .createQueryBuilder('inscripcion')
      .leftJoinAndSelect('inscripcion.campeonato', 'campeonato')
      .leftJoinAndSelect('inscripcion.categoria', 'categoria')
      .leftJoinAndSelect('inscripcion.equipo', 'equipo')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .where('inscripcion.activo = :activo', { activo: true });

    // Filtrar por liga si es directivo_liga
    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId) {
        return [];
      }
      query.andWhere('campeonato.ligaId = :ligaId', { ligaId: usuario.ligaId });
    }

    // Filtrar por equipo si es dirigente_equipo
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        return [];
      }
      query.andWhere('inscripcion.equipoId = :equipoId', {
        equipoId: usuario.equipoId,
      });
    }

    return await query.getMany();
  }

  /**
   * Obtener inscripciones de un campeonato
   */
  async findByCampeonato(campeonatoId: number, usuario: any): Promise<Inscripcion[]> {
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id: campeonatoId },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para ver inscripciones de este campeonato',
      );
    }

    // Filtrar inscripciones según rol
    const whereCondition: any = { campeonatoId, activo: true };

    // dirigente_equipo solo ve inscripciones de su equipo
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        return [];
      }
      whereCondition.equipoId = usuario.equipoId;
    }

    return await this.inscripcionesRepository.find({
      where: whereCondition,
      relations: ['equipo', 'categoria'],
    });
  }

  /**
   * Obtener inscripciones de una categoría
   */
  async findByCategoria(categoriaId: number, usuario: any): Promise<Inscripcion[]> {
    const categoria = await this.categoriasRepository.findOne({
      where: { id: categoriaId },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== categoria.campeonato.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para ver inscripciones de esta categoría',
      );
    }

    // Filtrar inscripciones según rol
    const whereCondition: any = { categoriaId, activo: true };

    // dirigente_equipo solo ve inscripciones de su equipo
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        return [];
      }
      whereCondition.equipoId = usuario.equipoId;
    }

    return await this.inscripcionesRepository.find({
      where: whereCondition,
      relations: ['equipo'],
    });
  }

  /**
   * Obtener una inscripción por ID
   */
  async findOne(id: number, usuario: any): Promise<Inscripcion> {
    const inscripcion = await this.inscripcionesRepository.findOne({
      where: { id },
    });

    if (!inscripcion) {
      throw new NotFoundException(`Inscripción con ID ${id} no encontrada`);
    }

    // Validar permisos
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId !== inscripcion.equipoId) {
      throw new ForbiddenException('No tienes permisos para ver esta inscripción');
    }

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== inscripcion.campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para ver esta inscripción');
    }

    return inscripcion;
  }

  /**
   * Actualizar inscripción (principalmente para cambiar estado)
   */
  async update(
    id: number,
    updateInscripcionDto: UpdateInscripcionDto,
    usuario: any,
  ): Promise<Inscripcion> {
    const inscripcion = await this.findOne(id, usuario);

    // Validar permisos para cambiar estado
    if (updateInscripcionDto.estado) {
      if (usuario.role === 'directivo_liga') {
        if (usuario.ligaId !== inscripcion.campeonato.ligaId) {
          throw new ForbiddenException(
            'No tienes permisos para cambiar el estado de esta inscripción',
          );
        }
      } else {
        throw new ForbiddenException(
          'Solo directivos pueden cambiar el estado de inscripciones',
        );
      }
    }

    Object.assign(inscripcion, updateInscripcionDto);
    return await this.inscripcionesRepository.save(inscripcion);
  }

  /**
   * Cancelar inscripción (dirigente cancela su propia inscripción)
   */
  async remove(id: number, usuario: any): Promise<void> {
    const inscripcion = await this.findOne(id, usuario);

    // Validar permisos
    if (usuario.role === 'dirigente_equipo') {
      if (usuario.equipoId !== inscripcion.equipoId) {
        throw new ForbiddenException(
          'Solo puedes cancelar la inscripción de tu propio equipo',
        );
      }
      // Solo puede cancelar si está pendiente
      if (inscripcion.estado !== 'pendiente') {
        throw new BadRequestException(
          'Solo puedes cancelar inscripciones pendientes',
        );
      }
    } else if (usuario.role === 'directivo_liga') {
      if (usuario.ligaId !== inscripcion.campeonato.ligaId) {
        throw new ForbiddenException(
          'No tienes permisos para cancelar esta inscripción',
        );
      }
    }

    inscripcion.activo = false;
    await this.inscripcionesRepository.save(inscripcion);
  }

  /**
   * Confirmar inscripción (directivo)
   */
  async confirmar(id: number, usuario: any): Promise<Inscripcion> {
    if (usuario.role !== 'directivo_liga' && usuario.role !== 'master') {
      throw new ForbiddenException(
        'Solo directivos pueden confirmar inscripciones',
      );
    }

    const inscripcion = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== inscripcion.campeonato.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para confirmar esta inscripción',
      );
    }

    inscripcion.estado = 'confirmada';
    return await this.inscripcionesRepository.save(inscripcion);
  }

  /**
   * Rechazar inscripción (directivo)
   */
  async rechazar(
    id: number,
    observaciones: string,
    usuario: any,
  ): Promise<Inscripcion> {
    if (usuario.role !== 'directivo_liga' && usuario.role !== 'master') {
      throw new ForbiddenException(
        'Solo directivos pueden rechazar inscripciones',
      );
    }

    const inscripcion = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== inscripcion.campeonato.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para rechazar esta inscripción',
      );
    }

    inscripcion.estado = 'rechazada';
    inscripcion.observaciones = observaciones;
    return await this.inscripcionesRepository.save(inscripcion);
  }
}
