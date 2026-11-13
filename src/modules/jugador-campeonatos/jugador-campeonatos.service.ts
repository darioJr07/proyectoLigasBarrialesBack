import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
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
import { Sancion } from '../sanciones/entities/sancion.entity';
import { CambiosDorsalService } from './cambios-dorsal.service';
import { Gol } from '../goles/entities/gol.entity';
import { RegularizarReingresoDto } from './dto/regularizar-reingreso.dto';

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
    @InjectRepository(Transferencia)
    private transferenciaRepo: Repository<Transferencia>,
    @InjectRepository(Sancion)
    private sancionRepo: Repository<Sancion>,
    @InjectRepository(Gol)
    private golRepo: Repository<Gol>,
    private dataSource: DataSource,
    private readonly cambiosDorsalService: CambiosDorsalService,
  ) {}

  private async assertCampeonatoAccess(campeonato: Campeonato, usuario: any): Promise<void> {
    if (usuario.role === 'master') return;

    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId || campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para acceder a este campeonato');
      }
      return;
    }

    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        throw new ForbiddenException('No tienes un equipo asignado');
      }
      const equipo = await this.equipoRepo.findOne({ where: { id: usuario.equipoId } });
      if (!equipo || equipo.ligaId !== campeonato.ligaId) {
        throw new ForbiddenException('No tienes permisos para acceder a este campeonato');
      }
      return;
    }

    throw new ForbiddenException('No tienes permisos para acceder a habilitaciones');
  }

  private async getCampeonatoAutorizado(campeonatoId: number, usuario: any): Promise<Campeonato> {
    const campeonato = await this.campeonatoRepo.findOne({ where: { id: campeonatoId } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado');
    await this.assertCampeonatoAccess(campeonato, usuario);
    return campeonato;
  }

  private async buscarBajaAnterior(
    jugadorId: number,
    campeonatoId: number,
    equipoId: number,
    excluirId?: number,
  ): Promise<JugadorCampeonato | null> {
    return this.jugadorCampeonatoRepo.findOne({
      where: {
        ...(excluirId ? { id: Not(excluirId) } : {}),
        jugadorId,
        campeonatoId,
        equipoId,
        estado: 'baja',
        activo: false,
      },
      order: { id: 'DESC' },
    });
  }

  private async adjuntarContextoReingreso(habilitaciones: JugadorCampeonato[]): Promise<any[]> {
    if (!habilitaciones.length) return habilitaciones;
    const origenIds = [...new Set(
      habilitaciones
        .map((item) => item.habilitacionOrigenId)
        .filter((id): id is number => !!id),
    )];
    if (!origenIds.length) return habilitaciones;
    const origenes = await this.jugadorCampeonatoRepo.find({ where: { id: In(origenIds) } });
    const porId = new Map(origenes.map((item) => [item.id, item]));
    return habilitaciones.map((item) => ({
      ...item,
      habilitacionOrigen: item.habilitacionOrigenId
        ? porId.get(item.habilitacionOrigenId) ?? null
        : null,
    }));
  }

  async create(dto: CreateJugadorCampeonatoDto, usuario: any): Promise<JugadorCampeonato> {
    // 1. Verificar que el campeonato existe y está en estado inscripcion_abierta
    const campeonato = await this.campeonatoRepo.findOne({
      where: { id: dto.campeonatoId, activo: true },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    // Se permite habilitar cuando el campeonato está en inscripcion_abierta o en_curso
    // (en_curso: se puede hasta la 3ra fecha jugada; el cierre se controla con el switch de configuración)
    if (campeonato.estado !== 'inscripcion_abierta' && campeonato.estado !== 'en_curso') {
      throw new BadRequestException('El campeonato no está en periodo de inscripción');
    }

    // 2. Validar fecha límite de inscripción solo cuando el campeonato aún no ha iniciado
    // Si ya está en_curso, la fecha límite ya pasó y el control lo ejerce el switch de configuración
    if (campeonato.estado === 'inscripcion_abierta') {
      const fechaActual = new Date();
      if (fechaActual > campeonato.fechaLimiteInscripcion) {
        throw new BadRequestException('La fecha límite de inscripción ha vencido');
      }
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

    // 8.1. Verificar si hay transferencias activas del jugador desde este equipo
    const transferenciaPendiente = await this.transferenciaRepo.findOne({
      where: {
        jugadorId: dto.jugadorId,
        campeonatoId: dto.campeonatoId,
        equipoOrigenId: dto.equipoId,
        activo: true,
      },
      relations: ['equipoDestino'],
    });

    // Bloquear habilitación si hay una transferencia en proceso
    if (transferenciaPendiente) {
      // Caso 1: El equipo origen aún no ha decidido
      if (transferenciaPendiente.estadoEquipoOrigen === 'pendiente') {
        throw new BadRequestException(
          `Existe una solicitud de transferencia pendiente para este jugador hacia el equipo ` +
          `"${transferenciaPendiente.equipoDestino?.nombre || 'destino'}". ` +
          `Debe aprobar o rechazar la transferencia antes de poder habilitar al jugador en este campeonato.`
        );
      }
      
      // Caso 2: El equipo origen aprobó, pero el directivo aún no ha decidido
      if (transferenciaPendiente.estadoEquipoOrigen === 'aprobado' && 
          transferenciaPendiente.estadoDirectivo === 'pendiente') {
        throw new BadRequestException(
          `La transferencia de este jugador hacia el equipo ` +
          `"${transferenciaPendiente.equipoDestino?.nombre || 'destino'}" fue aprobada por usted ` +
          `y está pendiente de aprobación del directivo. No puede habilitar al jugador mientras ` +
          `la transferencia esté en proceso.`
        );
      }
    }

    // 9. Verificar habilitación existente
    const inscripcionActiva = await this.jugadorCampeonatoRepo.findOne({
      where: {
        jugadorId: dto.jugadorId,
        campeonatoId: dto.campeonatoId,
        activo: true,
      },
      order: { fechaInscripcion: 'DESC' },
    });

    // Si existe una habilitación activa del MISMO equipo, no permitir duplicado
    if (inscripcionActiva && inscripcionActiva.equipoId === dto.equipoId) {
      throw new BadRequestException('Este jugador ya tiene una habilitación activa en el campeonato.');
    }

    const bajaAnterior = await this.buscarBajaAnterior(
      dto.jugadorId,
      dto.campeonatoId,
      dto.equipoId,
    );
    const esReingreso = !!bajaAnterior;
    const motivoReingreso = dto.motivoReingreso?.trim() || null;
    const referenciaReingreso = dto.referenciaReingreso?.trim() || null;

    if (esReingreso && !motivoReingreso) {
      throw new BadRequestException(
        'El jugador ya fue dado de baja en este campeonato. Debes indicar el motivo del reingreso.',
      );
    }

    // Si existe una habilitación inactiva/rechazada del MISMO equipo, reutilizarla
    const solicitudRechazada = await this.jugadorCampeonatoRepo.findOne({
      where: {
        jugadorId: dto.jugadorId,
        campeonatoId: dto.campeonatoId,
        equipoId: dto.equipoId,
        estado: 'rechazado',
        activo: false,
      },
      order: { fechaInscripcion: 'DESC' },
    });

    if (solicitudRechazada) {
      // Validar límite de jugadores habilitados antes de reactivar
      const maxJugadores = campeonato.maxJugadoresHabilitados || 20;
      const habilitadosCount = await this.jugadorCampeonatoRepo.count({
        where: {
          campeonatoId: dto.campeonatoId,
          equipoId: dto.equipoId,
          estado: In(['pendiente', 'habilitado']),
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
        await this.cambiosDorsalService.validarDorsalParaHabilitacion({
          campeonatoId: dto.campeonatoId,
          categoriaId: dto.categoriaId,
          equipoId: dto.equipoId,
          numeroCancha: dto.numeroCancha,
          excluirHabilitacionId: solicitudRechazada.id,
        });
      }

      // Reactivar la ficha existente del mismo equipo
      await this.jugadorCampeonatoRepo.update(
        { id: solicitudRechazada.id },
        {
          categoriaId: dto.categoriaId,
          numeroCancha: dto.numeroCancha,
          posicion: dto.posicion,
          estado: 'pendiente',
          activo: true,
          solicitadoPor: usuario.userId,
          aprobadoPor: null,
          fechaAprobacion: null,
          observaciones: null,
          tipoSolicitud: esReingreso ? 'reingreso' : 'normal',
          habilitacionOrigenId: bajaAnterior?.id ?? null,
          motivoReingreso,
          referenciaReingreso,
          fechaInscripcion: new Date(),
        }
      );
      return await this.jugadorCampeonatoRepo.findOne({ where: { id: solicitudRechazada.id } }) as JugadorCampeonato;
    }

    // Si existe una habilitación de OTRO equipo (jugador transferido), dejarla como historial
    // y continuar para crear un nuevo registro abajo (no retorna aquí)
    if (inscripcionActiva && inscripcionActiva.equipoId !== dto.equipoId) {
      // Asegurarse de que la ficha del equipo anterior quede inactiva con estado 'baja'
      // para que el historial sea claro y no quede como 'habilitado' inactivo (confuso)
      // El cierre se ejecuta despues de validar cupo y numero de camiseta.
      // Continúa al bloque de creación de nuevo registro
    }

    // 10. Validar límite de jugadores habilitados para nueva inscripción
    const maxJugadores = campeonato.maxJugadoresHabilitados || 20;
    const habilitadosCount = await this.jugadorCampeonatoRepo.count({
      where: {
        campeonatoId: dto.campeonatoId,
        equipoId: dto.equipoId,
        estado: In(['pendiente', 'habilitado']),
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
      await this.cambiosDorsalService.validarDorsalParaHabilitacion({
        campeonatoId: dto.campeonatoId,
        categoriaId: dto.categoriaId,
        equipoId: dto.equipoId,
        numeroCancha: dto.numeroCancha,
      });
    }

    // 11. Crear nueva inscripción con estado pendiente
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(JugadorCampeonato);
      if (inscripcionActiva && inscripcionActiva.equipoId !== dto.equipoId) {
        await repo.update(
          { id: inscripcionActiva.id },
          {
            activo: false,
            estado: 'baja',
            observaciones: 'Baja por transferencia a otro equipo',
          },
        );
      }

      const jugadorCampeonato = repo.create({
        ...dto,
        motivoReingreso,
        referenciaReingreso,
        tipoSolicitud: esReingreso ? 'reingreso' : 'normal',
        habilitacionOrigenId: bajaAnterior?.id ?? null,
        estado: 'pendiente',
        solicitadoPor: usuario.userId,
      });
      return repo.save(jugadorCampeonato);
    });
  }

  async findAll(usuario: any): Promise<JugadorCampeonato[]> {
    // No filtrar por activo para permitir ver habilitaciones rechazadas con observaciones
    const whereCondition: any = {};

    // Filtrar según rol
    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId) return [];
      // Obtener inscripciones de campeonatos de su liga
      whereCondition.campeonato = { ligaId: usuario.ligaId };
    } else if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) return [];
      // Solo inscripciones de su equipo (activas e inactivas para ver rechazadas)
      whereCondition.equipoId = usuario.equipoId;
    }

    const habilitaciones = await this.jugadorCampeonatoRepo.find({
      where: whereCondition,
      order: { fechaInscripcion: 'DESC' },
    });
    const conDorsales = await this.cambiosDorsalService.adjuntarCambiosActivos(habilitaciones);
    return this.adjuntarContextoReingreso(conDorsales as JugadorCampeonato[]) as any;
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

    const conDorsales = await this.cambiosDorsalService.adjuntarCambiosActivos([jugadorCampeonato]);
    const [resultado] = await this.adjuntarContextoReingreso(conDorsales as JugadorCampeonato[]);
    return resultado as JugadorCampeonato;
  }

  async findByCampeonato(campeonatoId: number, usuario: any): Promise<JugadorCampeonato[]> {
    await this.getCampeonatoAutorizado(campeonatoId, usuario);
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

    const conDorsales = await this.cambiosDorsalService.adjuntarCambiosActivos(inscripciones);
    return this.adjuntarContextoReingreso(conDorsales as JugadorCampeonato[]) as any;
  }

  /**
   * Obtener jugadores disponibles para transferencia (Flujo B)
   * Solo muestra jugadores que NO están habilitados en el campeonato
   * Estos jugadores solo tienen equipoId en tabla jugadores, pero sin habilitación
   */
  async findDisponiblesParaTransferencia(campeonatoId: number, usuario: any): Promise<any[]> {
    const campeonato = await this.getCampeonatoAutorizado(campeonatoId, usuario);
    // 1. Obtener todos los jugadores activos con equipo asignado (habilitados o no)
    const todosJugadores = await this.jugadorRepo.find({
      where: { activo: true },
      relations: ['equipo'],
    });

    let jugadoresDisponibles = todosJugadores.filter(
      (jugador) => jugador.equipoId && jugador.equipo?.ligaId === campeonato.ligaId,
    );

    // 2. Filtrar según rol
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId) {
      // Excluir jugadores de mi propio equipo (los que quiero recibir, no los míos)
      jugadoresDisponibles = jugadoresDisponibles.filter(
        j => j.equipoId !== usuario.equipoId
      );
      // Filtrar solo equipos de mi liga
      jugadoresDisponibles = jugadoresDisponibles.filter(
        j => j.equipo && j.equipo.ligaId === campeonato.ligaId
      );
    }

    if (usuario.role === 'directivo_liga' && usuario.ligaId) {
      jugadoresDisponibles = jugadoresDisponibles.filter(
        j => j.equipo && j.equipo.ligaId === usuario.ligaId
      );
    }

    console.log(`Jugadores disponibles para transferencia (habilitados + no habilitados): ${jugadoresDisponibles.length}`);

    // Mapear a formato similar a JugadorCampeonato para el frontend
    return jugadoresDisponibles.map(j => ({
      id: null,
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
    const campeonato = await this.getCampeonatoAutorizado(campeonatoId, usuario);
    const equipo = await this.equipoRepo.findOne({ where: { id: equipoId } });
    if (!equipo || equipo.ligaId !== campeonato.ligaId) {
      throw new BadRequestException('El equipo no pertenece a la liga del campeonato');
    }

    if (usuario.role === 'dirigente_equipo' && usuario.equipoId !== equipoId) {
      throw new ForbiddenException('No tienes permisos para ver jugadores de otro equipo');
    }

    const inscripciones = await this.jugadorCampeonatoRepo.find({
      where: { campeonatoId, equipoId, activo: true },
      order: { numeroCancha: 'ASC' },
    });

    const conDorsales = await this.cambiosDorsalService.adjuntarCambiosActivos(inscripciones);
    return this.adjuntarContextoReingreso(conDorsales as JugadorCampeonato[]) as any;
  }

  async findByJugador(jugadorId: number, usuario: any): Promise<JugadorCampeonato[]> {
    // Devolver todas las habilitaciones incluyendo inactivas para el historial completo
    const habilitaciones = await this.jugadorCampeonatoRepo.find({
      where: { jugadorId },
      order: { fechaInscripcion: 'DESC' },
    });

    let permitidas: JugadorCampeonato[] = [];
    if (usuario.role === 'master') permitidas = habilitaciones;
    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId) return [];
      permitidas = habilitaciones.filter((item) => item.campeonato?.ligaId === usuario.ligaId);
    }
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) return [];
      permitidas = habilitaciones.filter((item) => item.equipoId === usuario.equipoId);
    }
    return this.adjuntarContextoReingreso(permitidas) as any;
  }

  async update(id: number, dto: UpdateJugadorCampeonatoDto, usuario: any): Promise<JugadorCampeonato> {
    // Primero validar que existe y el usuario tiene permisos
    const jugadorCampeonato = await this.jugadorCampeonatoRepo.findOne({
      where: { id },
      relations: ['campeonato'],
    });

    if (!jugadorCampeonato) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Validar permisos de acceso
    if (usuario.role === 'dirigente_equipo') {
      if (jugadorCampeonato.equipoId !== usuario.equipoId) {
        throw new ForbiddenException('No tienes permisos para editar esta inscripción');
      }
    } else if (usuario.role === 'directivo_liga') {
      if (jugadorCampeonato.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para editar esta inscripción');
      }
    }

    // Validar número de camiseta duplicado si se está actualizando
    if (dto.numeroCancha !== undefined && dto.numeroCancha !== jugadorCampeonato.numeroCancha) {
      if (jugadorCampeonato.estado === 'habilitado') {
        throw new BadRequestException(
          'Una habilitación aprobada no puede cambiar su dorsal original. Usa la opción Cambiar dorsal por etapa.',
        );
      }
      await this.cambiosDorsalService.validarDorsalParaHabilitacion({
        campeonatoId: jugadorCampeonato.campeonatoId,
        categoriaId: dto.categoriaId ?? jugadorCampeonato.categoriaId,
        equipoId: jugadorCampeonato.equipoId,
        numeroCancha: dto.numeroCancha,
        excluirHabilitacionId: id,
      });
    }

    // Validar categoría si se está actualizando
    if (dto.categoriaId !== undefined) {
      const categoria = await this.categoriaRepo.findOne({
        where: { id: dto.categoriaId, campeonatoId: jugadorCampeonato.campeonatoId, activo: true },
      });

      if (!categoria) {
        throw new BadRequestException('Categoría no válida para este campeonato');
      }
    }

    // Construir el objeto de actualización solo con los campos que vienen en el DTO
    const updateData: any = {};
    if (dto.categoriaId !== undefined) updateData.categoriaId = dto.categoriaId;
    if (dto.numeroCancha !== undefined) updateData.numeroCancha = dto.numeroCancha;
    if (dto.posicion !== undefined) updateData.posicion = dto.posicion;
    if (dto.observaciones !== undefined) updateData.observaciones = dto.observaciones;

    // Usar update directo que es más confiable para campos simples
    await this.jugadorCampeonatoRepo.update(id, updateData);

    // Cargar y retornar el registro actualizado
    const resultado = await this.jugadorCampeonatoRepo.findOne({
      where: { id },
    });

    if (!resultado) {
      throw new NotFoundException('Error al cargar el registro actualizado');
    }
    
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

    const bajaAnterior = await this.buscarBajaAnterior(
      jugadorCampeonato.jugadorId,
      jugadorCampeonato.campeonatoId,
      jugadorCampeonato.equipoId,
      jugadorCampeonato.id,
    );
    if (bajaAnterior && jugadorCampeonato.tipoSolicitud !== 'reingreso') {
      throw new BadRequestException(
        'Esta solicitud corresponde a un reingreso y debe vincularse con la baja anterior antes de aprobarla.',
      );
    }
    if (
      jugadorCampeonato.tipoSolicitud === 'reingreso'
      && (!jugadorCampeonato.habilitacionOrigenId || !jugadorCampeonato.motivoReingreso?.trim())
    ) {
      throw new BadRequestException('El reingreso no tiene completo su antecedente y motivo.');
    }

    const inscripcionEquipo = await this.inscripcionRepo.findOne({
      where: {
        campeonatoId: jugadorCampeonato.campeonatoId,
        equipoId: jugadorCampeonato.equipoId,
        activo: true,
        estado: 'confirmada',
      },
    });
    if (!inscripcionEquipo) {
      throw new BadRequestException('El equipo ya no tiene una inscripcion confirmada en el campeonato');
    }

    const jugador = await this.jugadorRepo.findOne({
      where: { id: jugadorCampeonato.jugadorId, activo: true },
    });
    if (!jugador || jugador.equipoId !== jugadorCampeonato.equipoId) {
      throw new BadRequestException('El jugador ya no pertenece al equipo que solicito la habilitacion');
    }

    const otraHabilitacionActiva = await this.jugadorCampeonatoRepo.findOne({
      where: {
        id: Not(jugadorCampeonato.id),
        jugadorId: jugadorCampeonato.jugadorId,
        campeonatoId: jugadorCampeonato.campeonatoId,
        activo: true,
      },
    });
    if (otraHabilitacionActiva) {
      throw new BadRequestException('El jugador ya tiene otra habilitacion activa en este campeonato');
    }

    const maxJugadores = jugadorCampeonato.campeonato.maxJugadoresHabilitados || 20;
    const habilitadosCount = await this.jugadorCampeonatoRepo.count({
      where: {
        campeonatoId: jugadorCampeonato.campeonatoId,
        equipoId: jugadorCampeonato.equipoId,
        estado: 'habilitado',
        activo: true,
      },
    });
    if (habilitadosCount >= maxJugadores) {
      throw new BadRequestException(
        `El equipo ya alcanzo el limite de ${maxJugadores} jugadores habilitados`,
      );
    }

    await this.cambiosDorsalService.validarDorsalParaHabilitacion({
      campeonatoId: jugadorCampeonato.campeonatoId,
      categoriaId: jugadorCampeonato.categoriaId,
      equipoId: jugadorCampeonato.equipoId,
      numeroCancha: jugadorCampeonato.numeroCancha,
      excluirHabilitacionId: jugadorCampeonato.id,
    });

    jugadorCampeonato.estado = 'habilitado';
    jugadorCampeonato.aprobadoPor = usuario.userId;
    jugadorCampeonato.fechaAprobacion = new Date();
    if (dto.observaciones) {
      jugadorCampeonato.observaciones = dto.observaciones;
    }

    return await this.jugadorCampeonatoRepo.save(jugadorCampeonato);
  }

  /**
   * Da de baja a un jugador ya habilitado, liberando el cupo para que el equipo
   * pueda registrar un nuevo jugador. Solo aplica a habilitaciones en estado 'habilitado'.
   * El registro queda con activo=false para conservar el historial.
   */
  async darDeBaja(
    id: number,
    motivo: string,
    usuario: any,
    referencia?: string,
  ): Promise<JugadorCampeonato> {
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('Solo master o directivo_liga pueden dar de baja habilitaciones');
    }

    const jugadorCampeonato = await this.jugadorCampeonatoRepo.findOne({
      where: { id, activo: true },
    });

    if (!jugadorCampeonato) {
      throw new NotFoundException('Habilitación no encontrada');
    }

    if (usuario.role === 'directivo_liga') {
      if (jugadorCampeonato.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para dar de baja habilitaciones de otra liga');
      }
    }

    if (jugadorCampeonato.estado !== 'habilitado') {
      throw new BadRequestException('Solo se pueden dar de baja jugadores con estado habilitado');
    }

    // Desactivar la habilitación conservando el historial
    // El estado pasa a 'baja' para diferenciarlo visualmente de un rechazo
    jugadorCampeonato.activo = false;
    jugadorCampeonato.estado = 'baja';
    jugadorCampeonato.fechaBaja = new Date();
    jugadorCampeonato.dadoBajaPor = usuario.userId;
    jugadorCampeonato.motivoBaja = motivo.trim();
    jugadorCampeonato.referenciaBaja = referencia?.trim() || null;
    jugadorCampeonato.observaciones = motivo.trim();

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

    const pendientes = await queryBuilder
      .orderBy('jc.fechaInscripcion', 'ASC')
      .getMany();
    return this.adjuntarContextoReingreso(pendientes) as any;
  }

  async obtenerAntecedenteReingreso(
    jugadorId: number,
    campeonatoId: number,
    equipoId: number,
    usuario: any,
  ): Promise<any> {
    const campeonato = await this.getCampeonatoAutorizado(campeonatoId, usuario);
    const equipo = await this.equipoRepo.findOne({ where: { id: equipoId } });
    if (!equipo || equipo.ligaId !== campeonato.ligaId) {
      throw new BadRequestException('El equipo no pertenece a la liga del campeonato');
    }
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId !== equipoId) {
      throw new ForbiddenException('No tienes permisos para consultar jugadores de otro equipo');
    }

    const antecedente = await this.buscarBajaAnterior(jugadorId, campeonatoId, equipoId);
    return {
      esReingreso: !!antecedente,
      antecedente: antecedente ? {
        id: antecedente.id,
        numeroCancha: antecedente.numeroCancha,
        fechaAprobacion: antecedente.fechaAprobacion,
        fechaBaja: antecedente.fechaBaja,
        motivoBaja: antecedente.motivoBaja || antecedente.observaciones,
        referenciaBaja: antecedente.referenciaBaja,
      } : null,
    };
  }

  async obtenerResumenReingreso(id: number, usuario: any): Promise<any> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden revisar reingresos');
    }
    const solicitud = await this.findOne(id, usuario);
    const candidato = solicitud.habilitacionOrigenId
      ? await this.jugadorCampeonatoRepo.findOne({ where: { id: solicitud.habilitacionOrigenId } })
      : await this.buscarBajaAnterior(
          solicitud.jugadorId,
          solicitud.campeonatoId,
          solicitud.equipoId,
          solicitud.id,
        );

    const [golesAcumulados, sancionesActivas, transferenciasActivas] = await Promise.all([
      this.golRepo.count({
        where: {
          jugadorId: solicitud.jugadorId,
          campeonatoId: solicitud.campeonatoId,
          activo: true,
          tipo: Not('autogol'),
        },
      }),
      this.sancionRepo.find({
        where: {
          jugadorId: solicitud.jugadorId,
          campeonatoId: solicitud.campeonatoId,
          suspensionActiva: true,
          activo: true,
        },
        order: { fechaSancion: 'ASC' },
      }),
      this.transferenciaRepo.find({
        where: {
          jugadorId: solicitud.jugadorId,
          campeonatoId: solicitud.campeonatoId,
          activo: true,
        },
        order: { fechaSolicitud: 'DESC' },
      }),
    ]);

    const transferenciasEnProceso = transferenciasActivas.filter(
      (item) => item.estadoEquipoOrigen === 'pendiente' || item.estadoDirectivo === 'pendiente',
    );

    return {
      solicitud,
      esReingreso: solicitud.tipoSolicitud === 'reingreso' || !!candidato,
      requiereRegularizacion: !!candidato && solicitud.tipoSolicitud !== 'reingreso',
      antecedente: candidato,
      golesAcumulados,
      sancionesActivas: sancionesActivas.map((sancion) => ({
        id: sancion.id,
        tipo: sancion.tipoSancion?.nombre || 'Sancion',
        descripcion: sancion.descripcion,
        partidosSuspension: sancion.partidosSuspension || 0,
        partidosCumplidos: sancion.partidosCumplidos || 0,
        partidosPendientes: Math.max(
          (sancion.partidosSuspension || 0) - (sancion.partidosCumplidos || 0),
          0,
        ),
        fechaFinSuspension: sancion.fechaFinSuspension,
      })),
      transferenciasEnProceso,
    };
  }

  async regularizarReingreso(
    id: number,
    dto: RegularizarReingresoDto,
    usuario: any,
  ): Promise<JugadorCampeonato> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden regularizar reingresos');
    }

    const solicitud = await this.jugadorCampeonatoRepo.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    await this.assertCampeonatoAccess(solicitud.campeonato, usuario);
    if (!solicitud.activo || !['pendiente', 'habilitado'].includes(solicitud.estado)) {
      throw new BadRequestException('Solo se puede regularizar una solicitud activa');
    }

    const origen = await this.jugadorCampeonatoRepo.findOne({
      where: { id: dto.habilitacionOrigenId },
    });
    if (
      !origen
      || origen.estado !== 'baja'
      || origen.activo
      || origen.jugadorId !== solicitud.jugadorId
      || origen.campeonatoId !== solicitud.campeonatoId
      || origen.equipoId !== solicitud.equipoId
    ) {
      throw new BadRequestException('La ficha seleccionada no es una baja anterior valida para este reingreso');
    }

    const enlaceExistente = await this.jugadorCampeonatoRepo.findOne({
      where: { id: Not(id), habilitacionOrigenId: origen.id },
    });
    if (enlaceExistente) {
      throw new BadRequestException('La baja anterior ya esta vinculada con otra solicitud de reingreso');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(JugadorCampeonato);
      await repo.update(origen.id, {
        fechaBaja: origen.fechaBaja || (dto.fechaBaja ? new Date(dto.fechaBaja) : null),
        motivoBaja: origen.motivoBaja || dto.motivoBaja?.trim() || origen.observaciones,
        referenciaBaja: origen.referenciaBaja || dto.referenciaBaja?.trim() || null,
      });
      await repo.update(solicitud.id, {
        tipoSolicitud: 'reingreso',
        habilitacionOrigenId: origen.id,
        motivoReingreso: dto.motivoReingreso.trim(),
        referenciaReingreso: dto.referenciaReingreso?.trim() || null,
      });
      return await repo.findOne({ where: { id: solicitud.id } }) as JugadorCampeonato;
    });
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

  // ─────────────────────────────────────────────────────────────────────────
  // ARRASTRE DE SANCIONES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve suspensiones activas del jugador en campeonatos ANTERIORES de la
   * misma liga. Se llama justo después de habilitar al jugador para alertar
   * al directivo si tiene partidos/tiempo pendientes.
   * Solo accesible para master y directivo_liga.
   */
  async suspensionesArrastradasAlInscribir(
    jugadorId: number,
    nuevoCampeonatoId: number,
    usuario: any,
  ): Promise<Sancion[]> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Sin permisos para consultar suspensiones.');
    }

    // Obtener ligaId del campeonato destino
    const campeonato = await this.campeonatoRepo.findOne({ where: { id: nuevoCampeonatoId } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    await this.assertCampeonatoAccess(campeonato, usuario);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return this.sancionRepo
      .createQueryBuilder('sancion')
      .leftJoinAndSelect('sancion.tipoSancion', 'tipo')
      .leftJoinAndSelect('sancion.campeonato', 'campeonato')
      .leftJoinAndSelect('sancion.reglaSancion', 'regla')
      .where('sancion.jugador_id = :jugadorId', { jugadorId })
      .andWhere('sancion.liga_id = :ligaId', { ligaId: campeonato.ligaId })
      .andWhere('sancion.campeonato_id != :nuevoCampeonatoId', { nuevoCampeonatoId })
      .andWhere('sancion.suspension_activa = true')
      .andWhere('sancion.activo = true')
      // Excluir las que ya fueron transferidas a este campeonato
      .andWhere(
        'NOT EXISTS (' +
        '  SELECT 1 FROM sanciones s2' +
        '  WHERE s2.origen_sancion_id = sancion.id' +
        '    AND s2.campeonato_id = :nuevoCampeonatoId' +
        '    AND s2.activo = true' +
        ')',
        { nuevoCampeonatoId },
      )
      .orderBy('sancion.fecha_sancion', 'ASC')
      .getMany();
  }
}
