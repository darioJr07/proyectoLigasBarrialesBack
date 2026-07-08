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
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { TesoreriaService } from '../tesoreria/tesoreria.service';

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
    @InjectRepository(JugadorCampeonato)
    private jugadorCampeonatoRepository: Repository<JugadorCampeonato>,
    private tesoreriaService: TesoreriaService,
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

    // Validar fecha límite de inscripción usando la fecha proporcionada o la actual
    const fechaInscripcionToCheck = createInscripcionDto.fechaInscripcion 
      ? new Date(createInscripcionDto.fechaInscripcion) 
      : new Date();
    
    if (fechaInscripcionToCheck > new Date(campeonato.fechaLimiteInscripcion)) {
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
      
      // Parsear fecha sin problemas de timezone
      if (createInscripcionDto.fechaInscripcion) {
        const [year, month, day] = createInscripcionDto.fechaInscripcion.split('-');
        inscripcionRechazada.fechaInscripcion = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
      } else {
        inscripcionRechazada.fechaInscripcion = new Date();
      }
      
      return await this.inscripcionesRepository.save(inscripcionRechazada);
    }

    // Si no existe inscripción rechazada, crear una nueva
    let fechaParsed: Date;
    if (createInscripcionDto.fechaInscripcion) {
      const [year, month, day] = createInscripcionDto.fechaInscripcion.split('-');
      fechaParsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    } else {
      fechaParsed = new Date();
    }

    const inscripcion = this.inscripcionesRepository.create({
      ...createInscripcionDto,
      estado: usuario.role === 'directivo_liga' ? 'confirmada' : 'pendiente',
      fechaInscripcion: fechaParsed,
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
      .leftJoinAndSelect('equipo.liga', 'equipoLiga')
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
      relations: ['campeonato', 'categoria', 'equipo'],
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

    // Validar permisos según rol
    if (usuario.role === 'directivo_liga') {
      if (usuario.ligaId !== inscripcion.campeonato.ligaId) {
        throw new ForbiddenException(
          'No tienes permisos para modificar esta inscripción',
        );
      }
    }

    // Validar que no se cambien IDs críticos (campeonato y equipo no deben cambiar)
    if (updateInscripcionDto.campeonatoId && updateInscripcionDto.campeonatoId !== inscripcion.campeonatoId) {
      throw new BadRequestException(
        'No se puede cambiar el campeonato de una inscripción existente',
      );
    }

    if (updateInscripcionDto.equipoId && updateInscripcionDto.equipoId !== inscripcion.equipoId) {
      throw new BadRequestException(
        'No se puede cambiar el equipo de una inscripción existente',
      );
    }

    // Si se quiere cambiar la categoría, validar que pertenezca al mismo campeonato
    if (updateInscripcionDto.categoriaId && updateInscripcionDto.categoriaId !== inscripcion.categoriaId) {
      const nuevaCategoria = await this.categoriasRepository.findOne({
        where: { id: updateInscripcionDto.categoriaId },
      });

      if (!nuevaCategoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      if (nuevaCategoria.campeonatoId !== inscripcion.campeonatoId) {
        throw new BadRequestException(
          'La nueva categoría debe pertenecer al mismo campeonato',
        );
      }
    }

    // Validar permisos para cambiar estado
    if (updateInscripcionDto.estado) {
      if (usuario.role === 'directivo_liga') {
        if (usuario.ligaId !== inscripcion.campeonato.ligaId) {
          throw new ForbiddenException(
            'No tienes permisos para cambiar el estado de esta inscripción',
          );
        }
      } else if (usuario.role !== 'master') {
        throw new ForbiddenException(
          'Solo directivos y master pueden cambiar el estado de inscripciones',
        );
      }
    }

    // Preparar objeto con campos a actualizar
    const updateData: any = {};

    if (updateInscripcionDto.categoriaId !== undefined) {
      updateData.categoriaId = updateInscripcionDto.categoriaId;
    }
    if (updateInscripcionDto.observaciones !== undefined) {
      updateData.observaciones = updateInscripcionDto.observaciones;
    }
    if (updateInscripcionDto.estado !== undefined) {
      updateData.estado = updateInscripcionDto.estado;
    }
    if (updateInscripcionDto.fechaInscripcion !== undefined) {
      // Parsear fecha sin problemas de timezone
      const [year, month, day] = updateInscripcionDto.fechaInscripcion.split('-');
      updateData.fechaInscripcion = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    }

    // Usar update() en lugar de save() para evitar conflictos con relaciones eager
    await this.inscripcionesRepository.update(id, updateData);

    // Retornar la inscripción actualizada
    const inscripcionActualizada = await this.inscripcionesRepository.findOne({
      where: { id },
      relations: ['campeonato', 'categoria', 'equipo'],
    });

    if (!inscripcionActualizada) {
      throw new NotFoundException(`Inscripción con ID ${id} no encontrada después de actualizar`);
    }

    // ── Hook tesorería: generar cobro automático al confirmar inscripción ──
    if (updateData.estado === 'confirmada' && inscripcionActualizada.campeonato) {
      const camp = inscripcionActualizada.campeonato;
      await this.tesoreriaService.generarCobroInscripcion(
        camp.ligaId,
        camp.id,
        inscripcionActualizada.equipoId,
        Number(camp.cuotaInscripcion ?? 0),
        `Inscripción de ${inscripcionActualizada.equipo?.nombre ?? 'equipo'} — ${camp.nombre}`,
        usuario.sub ?? usuario.id,
      );
    }

    return inscripcionActualizada;
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

  /**
   * Registra un movimiento de categoría (ascenso o descenso) a media temporada.
   *
   * Flujo:
   * 1. Busca la inscripción 'confirmada' actual del equipo en el campeonato.
   * 2. La marca como 'transferida', guardando el motivo y la categoría de origen.
   * 3. Crea una nueva inscripción 'confirmada' en la categoría destino.
   *
   * Esto permite que el equipo aparezca solo en la nueva categoría en los
   * fixtures generados (que filtran por estado = 'confirmada'), mientras el
   * historial queda intacto en la inscripción 'transferida'.
   */
  async registrarMovimientoCategoria(
    dto: {
      campeonatoId: number;
      equipoId: number;
      categoriaNuevaId: number;
      motivo: 'ascenso' | 'descenso';
      observaciones?: string;
    },
    usuario: any,
  ): Promise<Inscripcion> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden registrar movimientos de categoría.',
      );
    }

    // 1. Buscar inscripción confirmada actual del equipo en ese campeonato
    const inscripcionActual = await this.inscripcionesRepository.findOne({
      where: {
        campeonatoId: dto.campeonatoId,
        equipoId: dto.equipoId,
        estado: 'confirmada',
        activo: true,
      },
    });

    if (!inscripcionActual) {
      throw new NotFoundException(
        'El equipo no tiene una inscripción confirmada en este campeonato.',
      );
    }

    // 2. Verificar que la categoría destino existe y pertenece al campeonato
    const categoriaDestino = await this.categoriasRepository.findOne({
      where: { id: dto.categoriaNuevaId, campeonatoId: dto.campeonatoId },
    });

    if (!categoriaDestino) {
      throw new NotFoundException(
        'La categoría destino no existe o no pertenece a este campeonato.',
      );
    }

    // 3. Verificar que no sea la misma categoría
    if (inscripcionActual.categoriaId === dto.categoriaNuevaId) {
      throw new BadRequestException(
        'El equipo ya está en esa categoría.',
      );
    }

    // 4. Marcar inscripción actual como 'transferida'
    inscripcionActual.estado = 'transferida';
    inscripcionActual.motivo = dto.motivo;
    inscripcionActual.categoriaOrigenId = inscripcionActual.categoriaId;
    if (dto.observaciones) {
      inscripcionActual.observaciones = dto.observaciones;
    }
    await this.inscripcionesRepository.save(inscripcionActual);

    // 5. Crear nueva inscripción confirmada en la categoría destino
    const nuevaInscripcion = this.inscripcionesRepository.create({
      campeonatoId: dto.campeonatoId,
      equipoId: dto.equipoId,
      categoriaId: dto.categoriaNuevaId,
      estado: 'confirmada',
      fechaInscripcion: new Date(),
      observaciones: dto.observaciones ?? `Movimiento por ${dto.motivo}`,
      motivo: null,
      categoriaOrigenId: null,
      activo: true,
    });

    const inscripcionGuardada = await this.inscripcionesRepository.save(nuevaInscripcion);

    // 6. Actualizar la categoría de las fichas de calificación de los jugadores del equipo
    await this.jugadorCampeonatoRepository.update(
      { equipoId: dto.equipoId, campeonatoId: dto.campeonatoId, activo: true },
      { categoriaId: dto.categoriaNuevaId },
    );

    return inscripcionGuardada;
  }

  /**
   * Obtener el historial completo de participaciones de un equipo.
   * Incluye todas las inscripciones (confirmadas, transferidas, rechazadas, etc.)
   * ordenadas de más reciente a más antigua.
   *
   * Permisos:
   * - master: puede ver el historial de cualquier equipo.
   * - directivo_liga: solo equipos de su liga.
   * - dirigente_equipo: solo su propio equipo.
   */
  async findByEquipo(equipoId: number, usuario: any): Promise<Inscripcion[]> {
    // Validar permisos de acceso
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId !== equipoId) {
      throw new ForbiddenException(
        'Solo puedes ver el historial de tu propio equipo.',
      );
    }

    const inscripciones = await this.inscripcionesRepository
      .createQueryBuilder('inscripcion')
      .leftJoinAndSelect('inscripcion.campeonato', 'campeonato')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .leftJoinAndSelect('inscripcion.categoria', 'categoria')
      .leftJoinAndSelect('inscripcion.equipo', 'equipo')
      .where('inscripcion.equipoId = :equipoId', { equipoId })
      .orderBy('inscripcion.fechaInscripcion', 'DESC')
      .getMany();

    // Si es directivo_liga, filtrar solo equipos de su liga
    if (usuario.role === 'directivo_liga') {
      return inscripciones.filter(
        (i) => i.campeonato?.liga?.id === usuario.ligaId,
      );
    }

    return inscripciones;
  }
}
