import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JugadorCampeonato } from './entities/jugador-campeonato.entity';
import { CreateJugadorCampeonatoDto } from './dto/create-jugador-campeonato.dto';
import { UpdateJugadorCampeonatoDto } from './dto/update-jugador-campeonato.dto';
import { AprobarHabilitacionDto } from './dto/aprobar-habilitacion.dto';
import { RechazarHabilitacionDto } from './dto/rechazar-habilitacion.dto';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';

@Injectable()
export class JugadorCampeonatosService {
  constructor(
    @InjectRepository(JugadorCampeonato)
    private jugadorCampeonatoRepo: Repository<JugadorCampeonato>,
    @InjectRepository(Jugador)
    private jugadorRepo: Repository<Jugador>,
    @InjectRepository(Campeonato)
    private campeonatoRepo: Repository<Campeonato>,
    @InjectRepository(Equipo)
    private equipoRepo: Repository<Equipo>,
    @InjectRepository(Categoria)
    private categoriaRepo: Repository<Categoria>,
    @InjectRepository(Inscripcion)
    private inscripcionRepo: Repository<Inscripcion>,
  ) {}

  async create(dto: CreateJugadorCampeonatoDto, usuario: any): Promise<JugadorCampeonato> {
    // 1. Verificar que el campeonato existe y está en estado inscripcion_abierta
    const campeonato = await this.campeonatoRepo.findOne({
      where: { id: dto.campeonatoId, activo: true },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    if (campeonato.estado !== 'inscripcion_abierta') {
      throw new BadRequestException('El campeonato no está en periodo de inscripción');
    }

    // 2. Validar fecha límite de inscripción
    const fechaActual = new Date();
    if (fechaActual > campeonato.fechaLimiteInscripcion) {
      throw new BadRequestException('La fecha límite de inscripción ha vencido');
    }

    // 3. Verificar que el jugador existe
    const jugador = await this.jugadorRepo.findOne({
      where: { id: dto.jugadorId, activo: true },
    });

    if (!jugador) {
      throw new NotFoundException('Jugador no encontrado');
    }

    // 4. Verificar que el jugador está asignado al equipo especificado
    if (jugador.equipoId !== dto.equipoId) {
      throw new BadRequestException('El jugador no pertenece al equipo especificado');
    }

    // 5. Verificar que el equipo existe y pertenece a la liga del campeonato
    const equipo = await this.equipoRepo.findOne({
      where: { id: dto.equipoId, activo: true },
    });

    if (!equipo) {
      throw new NotFoundException('Equipo no encontrado');
    }

    if (equipo.ligaId !== campeonato.ligaId) {
      throw new BadRequestException('El equipo no pertenece a la liga del campeonato');
    }

    // 6. Verificar que el equipo está inscrito en el campeonato
    const inscripcionEquipo = await this.inscripcionRepo.findOne({
      where: {
        campeonatoId: dto.campeonatoId,
        equipoId: dto.equipoId,
        activo: true,
        estado: 'confirmada',
      },
    });

    if (!inscripcionEquipo) {
      throw new BadRequestException(
        'El equipo no está inscrito en este campeonato o su inscripción aún no ha sido confirmada por el directivo. '
        + 'Verifica que la inscripción del equipo esté aprobada antes de habilitar jugadores.'
      );
    }

    // 7. Verificar que la categoría existe y pertenece al campeonato
    const categoria = await this.categoriaRepo.findOne({
      where: { id: dto.categoriaId, campeonatoId: dto.campeonatoId, activo: true },
    });

    if (!categoria) {
      throw new BadRequestException('Categoría no válida para este campeonato');
    }

    // 8. Validar permisos según rol
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId || usuario.equipoId !== dto.equipoId) {
        throw new ForbiddenException('Solo puedes inscribir jugadores de tu equipo');
      }
    } else if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId || equipo.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('Solo puedes inscribir jugadores de tu liga');
      }
    }

    // 9. Verificar habilitación existente
    const inscripcionExistente = await this.jugadorCampeonatoRepo.findOne({
      where: {
        jugadorId: dto.jugadorId,
        campeonatoId: dto.campeonatoId,
      },
    });

    // Si existe una habilitación activa, no permitir duplicado
    if (inscripcionExistente && inscripcionExistente.activo) {
      throw new BadRequestException('Este jugador ya tiene una habilitación activa en el campeonato.');
    }

    // Si existe una habilitación inactiva/rechazada, reutilizarla actualizando sus datos
    if (inscripcionExistente && !inscripcionExistente.activo) {
      // Validar límite de jugadores habilitados antes de reactivar
      const maxJugadores = campeonato.maxJugadoresHabilitados || 20;
      const habilitadosCount = await this.jugadorCampeonatoRepo.count({
        where: {
          campeonatoId: dto.campeonatoId,
          equipoId: dto.equipoId,
          estado: 'habilitado',
          activo: true,
        },
      });

      if (habilitadosCount >= maxJugadores) {
        throw new BadRequestException(
          `Ya se alcanzó el límite de ${maxJugadores} jugadores habilitados para este equipo en este campeonato. ` +
          `Si necesita habilitar a otro jugador, debe solicitar al directivo que libere un cupo primero.`
        );
      }

      // Validar que el número de camiseta no esté en uso por otro jugador
      if (dto.numeroCancha) {
        const numeroDuplicado = await this.jugadorCampeonatoRepo.findOne({
          where: {
            campeonatoId: dto.campeonatoId,
            equipoId: dto.equipoId,
            numeroCancha: dto.numeroCancha,
            activo: true,
          },
        });

        if (numeroDuplicado && numeroDuplicado.jugadorId !== dto.jugadorId) {
          throw new BadRequestException(
            `El número de camiseta ${dto.numeroCancha} ya está asignado a otro jugador en este campeonato y equipo`
          );
        }
      }

      inscripcionExistente.equipoId = dto.equipoId;
      inscripcionExistente.categoriaId = dto.categoriaId;
      inscripcionExistente.numeroCancha = dto.numeroCancha;
      inscripcionExistente.posicion = dto.posicion;
      inscripcionExistente.estado = 'pendiente';
      inscripcionExistente.activo = true;
      inscripcionExistente.solicitadoPor = usuario.userId;
      inscripcionExistente.aprobadoPor = null;
      inscripcionExistente.fechaAprobacion = null;
      inscripcionExistente.observaciones = null;
      inscripcionExistente.fechaInscripcion = new Date();
      
      return await this.jugadorCampeonatoRepo.save(inscripcionExistente);
    }

    // 10. Validar límite de jugadores habilitados para nueva inscripción
    const maxJugadores = campeonato.maxJugadoresHabilitados || 20;
    const habilitadosCount = await this.jugadorCampeonatoRepo.count({
      where: {
        campeonatoId: dto.campeonatoId,
        equipoId: dto.equipoId,
        estado: 'habilitado',
        activo: true,
      },
    });

    if (habilitadosCount >= maxJugadores) {
      throw new BadRequestException(
        `Ya se alcanzó el límite de ${maxJugadores} jugadores habilitados para este equipo en este campeonato. ` +
        `Si necesita habilitar a otro jugador, debe solicitar al directivo que libere un cupo primero.`
      );
    }

    // Validar que el número de camiseta no esté en uso por otro jugador
    if (dto.numeroCancha) {
      const numeroDuplicado = await this.jugadorCampeonatoRepo.findOne({
        where: {
          campeonatoId: dto.campeonatoId,
          equipoId: dto.equipoId,
          numeroCancha: dto.numeroCancha,
          activo: true,
        },
      });

      if (numeroDuplicado) {
        throw new BadRequestException(
          `El número de camiseta ${dto.numeroCancha} ya está asignado a otro jugador en este campeonato y equipo`
        );
      }
    }

    // 11. Crear nueva inscripción con estado pendiente
    const jugadorCampeonato = this.jugadorCampeonatoRepo.create({
      ...dto,
      estado: 'pendiente',
      solicitadoPor: usuario.userId,
    });
    return await this.jugadorCampeonatoRepo.save(jugadorCampeonato);
  }

  async findAll(usuario: any): Promise<JugadorCampeonato[]> {
    // No filtrar por activo para permitir ver habilitaciones rechazadas con observaciones
    const whereCondition: any = {};

    // Filtrar según rol
    if (usuario.role === 'directivo_liga' && usuario.ligaId) {
      // Obtener inscripciones de campeonatos de su liga
      whereCondition.campeonato = { ligaId: usuario.ligaId };
    } else if (usuario.role === 'dirigente_equipo' && usuario.equipoId) {
      // Solo inscripciones de su equipo (activas e inactivas para ver rechazadas)
      whereCondition.equipoId = usuario.equipoId;
    }

    return await this.jugadorCampeonatoRepo.find({
      where: whereCondition,
      order: { fechaInscripcion: 'DESC' },
    });
  }

  async findOne(id: number, usuario: any): Promise<JugadorCampeonato> {
    // Permitir ver habilitaciones inactivas/rechazadas para ver observaciones
    const jugadorCampeonato = await this.jugadorCampeonatoRepo.findOne({
      where: { id },
    });

    if (!jugadorCampeonato) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Validar permisos de acceso
    if (usuario.role === 'dirigente_equipo') {
      if (jugadorCampeonato.equipoId !== usuario.equipoId) {
        throw new ForbiddenException('No tienes permisos para ver esta inscripción');
      }
    } else if (usuario.role === 'directivo_liga') {
      if (jugadorCampeonato.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para ver esta inscripción');
      }
    }

    return jugadorCampeonato;
  }

  async findByCampeonato(campeonatoId: number, usuario: any): Promise<JugadorCampeonato[]> {
    // No filtrar por activo para permitir ver habilitaciones rechazadas
    const whereCondition: any = { campeonatoId };

    // Filtrar según rol
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId) {
      whereCondition.equipoId = usuario.equipoId;
    }

    const inscripciones = await this.jugadorCampeonatoRepo.find({
      where: whereCondition,
      order: { fechaInscripcion: 'DESC' },
    });

    // Validar acceso para directivo_liga
    if (usuario.role === 'directivo_liga' && inscripciones.length > 0) {
      const campeonato = inscripciones[0].campeonato;
      if (campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para ver inscripciones de esta liga');
      }
    }

    return inscripciones;
  }

  /**
   * Obtener jugadores disponibles para transferencia (Flujo B)
   * Solo muestra jugadores que NO están habilitados en el campeonato
   * Estos jugadores solo tienen equipoId en tabla jugadores, pero sin habilitación
   */
  async findDisponiblesParaTransferencia(campeonatoId: number, usuario: any): Promise<any[]> {
    // 1. Obtener todos los jugadores que NO tienen habilitación en este campeonato
    const jugadoresConHabilitacion = await this.jugadorCampeonatoRepo.find({
      where: { campeonatoId, activo: true },
      select: ['jugadorId'],
    });

    const idsConHabilitacion = new Set(jugadoresConHabilitacion.map(h => h.jugadorId));

    // 2. Buscar jugadores sin habilitación
    const todosJugadores = await this.jugadorRepo.find({
      where: { activo: true },
      relations: ['equipo'],
    });

    let jugadoresSinHabilitar = todosJugadores.filter(j => 
      j.equipoId && !idsConHabilitacion.has(j.id)
    );

    // 3. Filtrar según rol
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId) {
      // Excluir jugadores de mi propio equipo
      jugadoresSinHabilitar = jugadoresSinHabilitar.filter(
        j => j.equipoId !== usuario.equipoId
      );

      // Filtrar solo equipos de mi liga
      jugadoresSinHabilitar = jugadoresSinHabilitar.filter(
        j => j.equipo && j.equipo.ligaId === usuario.ligaId
      );
    }

    if (usuario.role === 'directivo_liga' && usuario.ligaId) {
      jugadoresSinHabilitar = jugadoresSinHabilitar.filter(
        j => j.equipo && j.equipo.ligaId === usuario.ligaId
      );
    }

    console.log(`Jugadores SIN HABILITAR disponibles para transferencia: ${jugadoresSinHabilitar.length}`);

    // Mapear a formato similar a JugadorCampeonato para el frontend
    return jugadoresSinHabilitar.map(j => ({
      id: null, // No hay habilitación
      jugadorId: j.id,
      jugador: j,
      equipoId: j.equipoId,
      equipo: j.equipo,
      campeonatoId: null,
    }));
  }

  async findByCampeonatoAndEquipo(
    campeonatoId: number,
    equipoId: number,
    usuario: any,
  ): Promise<JugadorCampeonato[]> {
    // Validar permisos
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId !== equipoId) {
      throw new ForbiddenException('No tienes permisos para ver jugadores de otro equipo');
    }

    const inscripciones = await this.jugadorCampeonatoRepo.find({
      where: { campeonatoId, equipoId, activo: true },
      order: { numeroCancha: 'ASC' },
    });

    // Validar acceso para directivo_liga
    if (usuario.role === 'directivo_liga' && inscripciones.length > 0) {
      const campeonato = inscripciones[0].campeonato;
      if (campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para ver inscripciones de esta liga');
      }
    }

    return inscripciones;
  }

  async findByJugador(jugadorId: number): Promise<JugadorCampeonato[]> {
    // Devolver todas las habilitaciones incluyendo inactivas para el historial completo
    return await this.jugadorCampeonatoRepo.find({
      where: { jugadorId },
      order: { fechaInscripcion: 'DESC' },
    });
  }

  async update(id: number, dto: UpdateJugadorCampeonatoDto, usuario: any): Promise<JugadorCampeonato> {
    console.log('🔧 UPDATE recibido - ID:', id, 'DTO:', dto);
    const jugadorCampeonato = await this.findOne(id, usuario);
    console.log('📦 Habilitación actual:', {
      id: jugadorCampeonato.id,
      categoriaId: jugadorCampeonato.categoriaId,
      numeroCancha: jugadorCampeonato.numeroCancha,
      posicion: jugadorCampeonato.posicion,
      observaciones: jugadorCampeonato.observaciones
    });

    // Validar número de camiseta duplicado si se está actualizando
    if (dto.numeroCancha !== undefined && dto.numeroCancha !== jugadorCampeonato.numeroCancha) {
      const numeroDuplicado = await this.jugadorCampeonatoRepo.findOne({
        where: {
          campeonatoId: jugadorCampeonato.campeonatoId,
          equipoId: jugadorCampeonato.equipoId,
          numeroCancha: dto.numeroCancha,
          activo: true,
        },
      });

      if (numeroDuplicado && numeroDuplicado.id !== id) {
        throw new BadRequestException(
          `El número de camiseta ${dto.numeroCancha} ya está asignado a otro jugador en este campeonato y equipo`
        );
      }
    }

    // Solo permitir actualizar categoriaId, numeroCancha, posicion y observaciones
    if (dto.categoriaId !== undefined) {
      // Validar que la categoría existe y pertenece al campeonato
      const categoria = await this.categoriaRepo.findOne({
        where: { id: dto.categoriaId, campeonatoId: jugadorCampeonato.campeonatoId, activo: true },
      });

      if (!categoria) {
        throw new BadRequestException('Categoría no válida para este campeonato');
      }

      jugadorCampeonato.categoriaId = dto.categoriaId;
    }
    if (dto.numeroCancha !== undefined) {
      jugadorCampeonato.numeroCancha = dto.numeroCancha;
    }
    if (dto.posicion !== undefined) {
      jugadorCampeonato.posicion = dto.posicion;
    }
    if (dto.observaciones !== undefined) {
      jugadorCampeonato.observaciones = dto.observaciones;
    }

    console.log('💾 Habilitación después de actualizar:', {
      id: jugadorCampeonato.id,
      categoriaId: jugadorCampeonato.categoriaId,
      numeroCancha: jugadorCampeonato.numeroCancha,
      posicion: jugadorCampeonato.posicion,
      observaciones: jugadorCampeonato.observaciones
    });

    const resultado = await this.jugadorCampeonatoRepo.save(jugadorCampeonato);
    console.log('✅ Resultado guardado:', {
      id: resultado.id,
      categoriaId: resultado.categoriaId,
      numeroCancha: resultado.numeroCancha,
      posicion: resultado.posicion,
      observaciones: resultado.observaciones
    });
    return resultado;
  }

  async aprobar(id: number, dto: AprobarHabilitacionDto, usuario: any): Promise<JugadorCampeonato> {
    // Solo directivo_liga y master pueden aprobar
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('Solo el directivo de liga puede aprobar habilitaciones');
    }

    const jugadorCampeonato = await this.jugadorCampeonatoRepo.findOne({
      where: { id, activo: true },
    });

    if (!jugadorCampeonato) {
      throw new NotFoundException('Habilitación no encontrada');
    }

    // Validar que sea de su liga si es directivo
    if (usuario.role === 'directivo_liga') {
      if (jugadorCampeonato.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para aprobar habilitaciones de otra liga');
      }
    }

    if (jugadorCampeonato.estado !== 'pendiente') {
      throw new BadRequestException('Esta habilitación ya fue procesada');
    }

    jugadorCampeonato.estado = 'habilitado';
    jugadorCampeonato.aprobadoPor = usuario.userId;
    jugadorCampeonato.fechaAprobacion = new Date();
    if (dto.observaciones) {
      jugadorCampeonato.observaciones = dto.observaciones;
    }

    return await this.jugadorCampeonatoRepo.save(jugadorCampeonato);
  }

  async rechazar(id: number, dto: RechazarHabilitacionDto, usuario: any): Promise<JugadorCampeonato> {
    // Solo directivo_liga y master pueden rechazar
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('Solo el directivo de liga puede rechazar habilitaciones');
    }

    const jugadorCampeonato = await this.jugadorCampeonatoRepo.findOne({
      where: { id, activo: true },
    });

    if (!jugadorCampeonato) {
      throw new NotFoundException('Habilitación no encontrada');
    }

    // Validar que sea de su liga si es directivo
    if (usuario.role === 'directivo_liga') {
      if (jugadorCampeonato.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para rechazar habilitaciones de otra liga');
      }
    }

    if (jugadorCampeonato.estado !== 'pendiente') {
      throw new BadRequestException('Esta habilitación ya fue procesada');
    }

    // Marcar como rechazado y desactivar para permitir nueva solicitud
    jugadorCampeonato.estado = 'rechazado';
    jugadorCampeonato.activo = false; // Desactivar para permitir nueva inscripción
    jugadorCampeonato.aprobadoPor = usuario.userId;
    jugadorCampeonato.fechaAprobacion = new Date();
    jugadorCampeonato.observaciones = dto.observaciones;

    return await this.jugadorCampeonatoRepo.save(jugadorCampeonato);
  }

  async findPendientes(usuario: any): Promise<JugadorCampeonato[]> {
    // Solo directivo_liga y master
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('No tienes permisos para ver habilitaciones pendientes');
    }

    const queryBuilder = this.jugadorCampeonatoRepo
      .createQueryBuilder('jc')
      .leftJoinAndSelect('jc.jugador', 'jugador')
      .leftJoinAndSelect('jugador.equipo', 'jugadorEquipo')
      .leftJoinAndSelect('jc.campeonato', 'campeonato')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .leftJoinAndSelect('jc.equipo', 'equipo')
      .leftJoinAndSelect('jc.categoria', 'categoria')
      .where('jc.estado = :estado', { estado: 'pendiente' })
      .andWhere('jc.activo = :activo', { activo: true });

    // Filtrar por liga si es directivo
    if (usuario.role === 'directivo_liga' && usuario.ligaId) {
      queryBuilder.andWhere('liga.id = :ligaId', { ligaId: usuario.ligaId });
    }

    return await queryBuilder
      .orderBy('jc.fechaInscripcion', 'ASC')
      .getMany();
  }

  async remove(id: number, usuario: any): Promise<void> {
    const jugadorCampeonato = await this.findOne(id, usuario);

    // Verificar que el campeonato no haya iniciado
    const campeonato = jugadorCampeonato.campeonato;
    if (campeonato.estado !== 'inscripcion_abierta') {
      throw new BadRequestException('No se puede eliminar la inscripción una vez iniciado el campeonato');
    }

    // Solo master y directivo pueden eliminar
    if (usuario.role === 'dirigente_equipo') {
      throw new ForbiddenException('No tienes permisos para eliminar inscripciones');
    }

    // Soft delete
    jugadorCampeonato.activo = false;
    await this.jugadorCampeonatoRepo.save(jugadorCampeonato);
  }
}
