import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transferencia } from './entities/transferencia.entity';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { AprobarTransferenciaDto } from './dto/aprobar-transferencia.dto';
import { RechazarTransferenciaDto } from './dto/rechazar-transferencia.dto';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';

@Injectable()
export class TransferenciasService {
  constructor(
    @InjectRepository(Transferencia)
    private transferenciaRepo: Repository<Transferencia>,
    @InjectRepository(Jugador)
    private jugadorRepo: Repository<Jugador>,
    @InjectRepository(Campeonato)
    private campeonatoRepo: Repository<Campeonato>,
    @InjectRepository(Equipo)
    private equipoRepo: Repository<Equipo>,
    @InjectRepository(JugadorCampeonato)
    private jugadorCampeonatoRepo: Repository<JugadorCampeonato>,
    @InjectRepository(Inscripcion)
    private inscripcionRepo: Repository<Inscripcion>,
  ) {}

  /**
   * Helper para serializar transferencias con campos virtuales del jugador
   */
  private serializeTransferencia(transferencia: Transferencia): any {
    const serialized = { ...transferencia };
    if (transferencia.jugador) {
      serialized.jugador = {
        ...transferencia.jugador,
        nombreCompleto: transferencia.jugador.nombre,
        fotoPerfil: transferencia.jugador.imagen,
      };
    }
    return serialized;
  }

  private serializeTransferencias(transferencias: Transferencia[]): any[] {
    return transferencias.map(t => this.serializeTransferencia(t));
  }

  async create(dto: CreateTransferenciaDto, usuario: any): Promise<Transferencia> {
    // 1. Verificar que el campeonato existe
    const campeonato = await this.campeonatoRepo.findOne({
      where: { id: dto.campeonatoId, activo: true },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    // 2. Verificar que el jugador existe y está habilitado en el campeonato
    const jugador = await this.jugadorRepo.findOne({
      where: { id: dto.jugadorId, activo: true },
    });

    if (!jugador) {
      throw new NotFoundException('Jugador no encontrado');
    }

    if (!jugador.equipoId) {
      throw new BadRequestException('El jugador no tiene equipo asignado');
    }

    // 3. Obtener equipo origen
    const equipoOrigenId = jugador.equipoId;
    const equipoOrigen = await this.equipoRepo.findOne({
      where: { id: equipoOrigenId, activo: true },
    });

    if (!equipoOrigen) {
      throw new NotFoundException('Equipo origen no encontrado');
    }

    // 4. Verificar que el equipo destino existe
    const equipoDestino = await this.equipoRepo.findOne({
      where: { id: dto.equipoDestinoId, activo: true },
    });

    if (!equipoDestino) {
      throw new NotFoundException('Equipo destino no encontrado');
    }

    // 5. Validar que ambos equipos pertenecen a la misma liga
    if (equipoOrigen.ligaId !== equipoDestino.ligaId) {
      throw new BadRequestException('Los equipos deben pertenecer a la misma liga');
    }

    // 6. Validar que el equipo destino está inscrito en el campeonato
    const inscripcionDestino = await this.inscripcionRepo.findOne({
      where: {
        campeonatoId: dto.campeonatoId,
        equipoId: dto.equipoDestinoId,
        activo: true,
        estado: 'confirmada',
      },
    });

    if (!inscripcionDestino) {
      throw new BadRequestException('El equipo destino no está inscrito en este campeonato');
    }

    // Ya validamos arriba que NO tiene habilitación activa
    // No necesitamos validar habilitación en destino

    // 8. Validar permisos: solo dirigente del equipo destino o master
    if (usuario.role === 'dirigente_equipo') {
      if (usuario.equipoId !== dto.equipoDestinoId) {
        throw new ForbiddenException('Solo puedes solicitar transferencias hacia tu equipo');
      }
    }

    // 9. Verificar que no exista otra transferencia activa (pendiente o en proceso) del mismo jugador
    const transferenciaActiva = await this.transferenciaRepo.findOne({
      where: [
        {
          jugadorId: dto.jugadorId,
          campeonatoId: dto.campeonatoId,
          activo: true,
          estadoEquipoOrigen: 'pendiente',
        },
        {
          jugadorId: dto.jugadorId,
          campeonatoId: dto.campeonatoId,
          activo: true,
          estadoEquipoOrigen: 'aprobado',
          estadoDirectivo: 'pendiente',
        },
      ],
    });

    console.log('Verificación transferencia activa:', {
      jugadorId: dto.jugadorId,
      existe: transferenciaActiva ? 'SÍ' : 'NO',
    });

    if (transferenciaActiva) {
      throw new BadRequestException('Ya existe una transferencia activa para este jugador en este campeonato. Debe esperar a que se complete o rechace.');
    }

    // 10. Verificar si el jugador ya tiene una habilitación pendiente o aprobada en este campeonato
    // No bloquea la solicitud (se permiten pases a media temporada), solo genera un aviso informativo
    const habilitacionActiva = await this.jugadorCampeonatoRepo.findOne({
      where: [
        { jugadorId: dto.jugadorId, campeonatoId: dto.campeonatoId, activo: true, estado: 'pendiente' },
        { jugadorId: dto.jugadorId, campeonatoId: dto.campeonatoId, activo: true, estado: 'habilitado' },
      ],
      relations: ['equipo'],
    });

    // 11. Crear la transferencia
    const transferencia = this.transferenciaRepo.create({
      jugadorId: dto.jugadorId,
      campeonatoId: dto.campeonatoId,
      equipoOrigenId: equipoOrigenId,
      equipoDestinoId: dto.equipoDestinoId,
      solicitadoPor: usuario.userId,
      observaciones: dto.observaciones,
    });

    const saved = await this.transferenciaRepo.save(transferencia);
    // Cargar relaciones para serialización
    const loaded = await this.transferenciaRepo.findOne({
      where: { id: saved.id },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
    });
    if (!loaded) {
      throw new NotFoundException('Error al cargar la transferencia creada');
    }

    const result = this.serializeTransferencia(loaded);

    // Agregar advertencia informativa si el jugador ya estaba habilitado o pendiente en este campeonato
    if (habilitacionActiva) {
      const estadoTexto = habilitacionActiva.estado === 'habilitado' ? 'habilitado' : 'en proceso de habilitación';
      result.advertencia = `⚠️ Atención: Este jugador ya está ${estadoTexto} en el equipo "${habilitacionActiva.equipo?.nombre || 'otro equipo'}" para este campeonato. Si la transferencia es aprobada por ambas partes, será dado de baja automáticamente en ese equipo.`;
    }

    return result;
  }

  async aprobarPorEquipoOrigen(id: number, dto: AprobarTransferenciaDto, usuario: any): Promise<Transferencia> {
    const transferencia = await this.transferenciaRepo.findOne({
      where: { id, activo: true },
    });

    if (!transferencia) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transferencia.estadoEquipoOrigen !== 'pendiente') {
      throw new BadRequestException('Esta transferencia ya fue procesada por el equipo origen');
    }

    // Validar que sea el dirigente del equipo origen o master
    if (usuario.role === 'dirigente_equipo') {
      if (usuario.equipoId !== transferencia.equipoOrigenId) {
        throw new ForbiddenException('Solo el dirigente del equipo origen puede aprobar esta transferencia');
      }
    }

    transferencia.estadoEquipoOrigen = 'aprobado';
    transferencia.aprobadoPorOrigen = usuario.userId;
    transferencia.fechaAprobacionOrigen = new Date();
    if (dto.observaciones) {
      transferencia.observaciones = dto.observaciones;
    }

    const result = await this.transferenciaRepo.save(transferencia);

    console.log(`[aprobarPorEquipoOrigen] Transferencia ${result.id} aprobada por equipo origen`);
    console.log(`[aprobarPorEquipoOrigen] Estado directivo: ${result.estadoDirectivo}`);

    // Si también fue aprobado por directivo, completar transferencia
    if (result.estadoDirectivo === 'aprobado') {
      console.log(`[aprobarPorEquipoOrigen] Ambas aprobaciones completas. Llamando a completarTransferencia...`);
      await this.completarTransferencia(result);
    }

    // Cargar relaciones para serialización
    const loaded = await this.transferenciaRepo.findOne({
      where: { id: result.id },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
    });
    if (!loaded) {
      throw new NotFoundException('Error al cargar la transferencia');
    }
    return this.serializeTransferencia(loaded);
  }

  async rechazarPorEquipoOrigen(id: number, dto: RechazarTransferenciaDto, usuario: any): Promise<Transferencia> {
    const transferencia = await this.transferenciaRepo.findOne({
      where: { id, activo: true },
    });

    if (!transferencia) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transferencia.estadoEquipoOrigen !== 'pendiente') {
      throw new BadRequestException('Esta transferencia ya fue procesada por el equipo origen');
    }

    // Validar que sea el dirigente del equipo origen o master
    if (usuario.role === 'dirigente_equipo') {
      if (usuario.equipoId !== transferencia.equipoOrigenId) {
        throw new ForbiddenException('Solo el dirigente del equipo origen puede rechazar esta transferencia');
      }
    }

    transferencia.estadoEquipoOrigen = 'rechazado';
    transferencia.aprobadoPorOrigen = usuario.userId;
    transferencia.fechaAprobacionOrigen = new Date();
    transferencia.observaciones = dto.observaciones;

    const result = await this.transferenciaRepo.save(transferencia);
    // Cargar relaciones para serialización
    const loaded = await this.transferenciaRepo.findOne({
      where: { id: result.id },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
    });
    if (!loaded) {
      throw new NotFoundException('Error al cargar la transferencia');
    }
    return this.serializeTransferencia(loaded);
  }

  async aprobarPorDirectivo(id: number, dto: AprobarTransferenciaDto, usuario: any): Promise<Transferencia> {
    // Solo directivo_liga y master
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('Solo el directivo de liga puede aprobar transferencias');
    }

    const transferencia = await this.transferenciaRepo.findOne({
      where: { id, activo: true },
    });

    if (!transferencia) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    // Validar que sea de su liga si es directivo
    if (usuario.role === 'directivo_liga') {
      if (transferencia.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para aprobar transferencias de otra liga');
      }
    }

    if (transferencia.estadoDirectivo !== 'pendiente') {
      throw new BadRequestException('Esta transferencia ya fue procesada por el directivo');
    }

    transferencia.estadoDirectivo = 'aprobado';
    transferencia.aprobadoPorDirectivo = usuario.userId;
    transferencia.fechaAprobacionDirectivo = new Date();
    if (dto.observaciones) {
      transferencia.observaciones = (transferencia.observaciones || '') + ' ' + dto.observaciones;
    }

    const result = await this.transferenciaRepo.save(transferencia);

    console.log(`[aprobarPorDirectivo] Transferencia ${result.id} aprobada por directivo`);
    console.log(`[aprobarPorDirectivo] Estado equipo origen: ${result.estadoEquipoOrigen}`);

    // Si también fue aprobado por equipo origen, completar transferencia
    if (result.estadoEquipoOrigen === 'aprobado') {
      console.log(`[aprobarPorDirectivo] Ambas aprobaciones completas. Llamando a completarTransferencia...`);
      await this.completarTransferencia(result);
    }

    // Cargar relaciones para serialización
    const loaded = await this.transferenciaRepo.findOne({
      where: { id: result.id },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
    });
    if (!loaded) {
      throw new NotFoundException('Error al cargar la transferencia');
    }
    return this.serializeTransferencia(loaded);
  }

  async rechazarPorDirectivo(id: number, dto: RechazarTransferenciaDto, usuario: any): Promise<Transferencia> {
    // Solo directivo_liga y master
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('Solo el directivo de liga puede rechazar transferencias');
    }

    const transferencia = await this.transferenciaRepo.findOne({
      where: { id, activo: true },
    });

    if (!transferencia) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    // Validar que sea de su liga si es directivo
    if (usuario.role === 'directivo_liga') {
      if (transferencia.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para rechazar transferencias de otra liga');
      }
    }

    if (transferencia.estadoDirectivo !== 'pendiente') {
      throw new BadRequestException('Esta transferencia ya fue procesada por el directivo');
    }

    transferencia.estadoDirectivo = 'rechazado';
    transferencia.aprobadoPorDirectivo = usuario.userId;
    transferencia.fechaAprobacionDirectivo = new Date();
    transferencia.observaciones = (transferencia.observaciones || '') + ' ' + dto.observaciones;

    const result = await this.transferenciaRepo.save(transferencia);
    // Cargar relaciones para serialización
    const loaded = await this.transferenciaRepo.findOne({
      where: { id: result.id },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
    });
    if (!loaded) {
      throw new NotFoundException('Error al cargar la transferencia');
    }
    return this.serializeTransferencia(loaded);
  }

  private async completarTransferencia(transferencia: Transferencia): Promise<void> {
    console.log(`\n========== COMPLETANDO TRANSFERENCIA ==========`);
    console.log(`Transferencia ID: ${transferencia.id}`);
    console.log(`Jugador ID: ${transferencia.jugadorId}`);
    console.log(`Equipo Origen ID: ${transferencia.equipoOrigenId}`);
    console.log(`Equipo Destino ID: ${transferencia.equipoDestinoId}`);
    
    // 1. Actualizar equipoId en tabla jugadores
    const updateResult = await this.jugadorRepo
      .createQueryBuilder()
      .update()
      .set({ equipoId: transferencia.equipoDestinoId })
      .where('id = :jugadorId', { jugadorId: transferencia.jugadorId })
      .execute();

    // 2. Dar de baja la ficha de habilitación del jugador en el equipo origen (si existe)
    await this.jugadorCampeonatoRepo.update(
      {
        jugadorId: transferencia.jugadorId,
        campeonatoId: transferencia.campeonatoId,
        equipoId: transferencia.equipoOrigenId,
        activo: true,
      },
      { activo: false, estado: 'baja' },
    );
    console.log(`✓ Ficha de habilitación del equipo origen marcada como baja e inactiva (si existía)`);

    console.log(`✓ UPDATE ejecutado`);
    console.log(`  - Filas afectadas: ${updateResult.affected}`);
    
    // Verificar que se aplicó el cambio
    const jugadorActualizado = await this.jugadorRepo.findOne({
      where: { id: transferencia.jugadorId },
      relations: ['equipo'],
    });
    
    if (jugadorActualizado) {
      console.log(`✓ Verificación post-update:`);
      console.log(`  - Jugador: ${jugadorActualizado.nombre} (ID: ${jugadorActualizado.id})`);
      console.log(`  - Nuevo equipoId: ${jugadorActualizado.equipoId}`);
      console.log(`  - Nuevo equipo: ${jugadorActualizado.equipo?.nombre || 'Sin equipo'}`);
    } else {
      console.error(`ERROR: No se pudo verificar el jugador después del update`);
    }
    
    console.log(`===============================================\n`);
  }

  async findAll(usuario: any): Promise<any[]> {
    const whereCondition: any = { activo: true };

    // Filtrar según rol
    if (usuario.role === 'directivo_liga' && usuario.ligaId) {
      whereCondition.campeonato = { ligaId: usuario.ligaId };
    } else if (usuario.role === 'dirigente_equipo' && usuario.equipoId) {
      // Ver transferencias donde es origen o destino
      const transferencias = await this.transferenciaRepo.find({
        where: [
          { equipoOrigenId: usuario.equipoId, activo: true },
          { equipoDestinoId: usuario.equipoId, activo: true },
        ],
        relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
        order: { fechaSolicitud: 'DESC' },
      });
      return this.serializeTransferencias(transferencias);
    }

    const transferencias = await this.transferenciaRepo.find({
      where: whereCondition,
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
      order: { fechaSolicitud: 'DESC' },
    });
    return this.serializeTransferencias(transferencias);
  }

  async findOne(id: number, usuario: any): Promise<any> {
    const transferencia = await this.transferenciaRepo.findOne({
      where: { id, activo: true },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
    });

    if (!transferencia) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    // Validar permisos de acceso
    if (usuario.role === 'dirigente_equipo') {
      if (
        transferencia.equipoOrigenId !== usuario.equipoId &&
        transferencia.equipoDestinoId !== usuario.equipoId
      ) {
        throw new ForbiddenException('No tienes permisos para ver esta transferencia');
      }
    } else if (usuario.role === 'directivo_liga') {
      if (transferencia.campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para ver esta transferencia');
      }
    }

    return this.serializeTransferencia(transferencia);
  }

  async findPendientesEquipoOrigen(usuario: any): Promise<any[]> {
    // El master puede ver TODAS las transferencias pendientes de equipo origen
    // para poder intervenir en casos de bloqueo o conflicto
    if (usuario.role === 'master') {
      const transferencias = await this.transferenciaRepo.find({
        where: {
          estadoEquipoOrigen: 'pendiente',
          activo: true,
        },
        relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
        order: { fechaSolicitud: 'ASC' },
      });
      return this.serializeTransferencias(transferencias);
    }

    // El dirigente_equipo solo ve las transferencias pendientes de su propio equipo
    if (usuario.role !== 'dirigente_equipo' || !usuario.equipoId) {
      throw new ForbiddenException('Solo dirigentes pueden ver transferencias pendientes de su equipo');
    }

    const transferencias = await this.transferenciaRepo.find({
      where: {
        equipoOrigenId: usuario.equipoId,
        estadoEquipoOrigen: 'pendiente',
        activo: true,
      },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
      order: { fechaSolicitud: 'ASC' },
    });
    return this.serializeTransferencias(transferencias);
  }

  async findPendientesDirectivo(usuario: any): Promise<any[]> {
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException('Solo directivos pueden ver transferencias pendientes');
    }

    const whereCondition: any = {
      estadoEquipoOrigen: 'aprobado', // Solo las que ya fueron aprobadas por el equipo origen
      estadoDirectivo: 'pendiente',
      activo: true,
    };

    if (usuario.role === 'directivo_liga' && usuario.ligaId) {
      whereCondition.campeonato = { ligaId: usuario.ligaId };
    }

    const transferencias = await this.transferenciaRepo.find({
      where: whereCondition,
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
      order: { fechaSolicitud: 'ASC' },
    });
    return this.serializeTransferencias(transferencias);
  }

  async findByCampeonato(campeonatoId: number, usuario: any): Promise<any[]> {
    const whereCondition: any = { campeonatoId, activo: true };

    // Filtrar según rol
    if (usuario.role === 'dirigente_equipo' && usuario.equipoId) {
      const transferencias = await this.transferenciaRepo.find({
        where: [
          { campeonatoId, equipoOrigenId: usuario.equipoId, activo: true },
          { campeonatoId, equipoDestinoId: usuario.equipoId, activo: true },
        ],
        relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
        order: { fechaSolicitud: 'DESC' },
      });
      return this.serializeTransferencias(transferencias);
    }

    const transferencias = await this.transferenciaRepo.find({
      where: whereCondition,
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
      order: { fechaSolicitud: 'DESC' },
    });

    // Validar acceso para directivo_liga
    if (usuario.role === 'directivo_liga' && transferencias.length > 0) {
      const campeonato = transferencias[0].campeonato;
      if (campeonato.ligaId !== usuario.ligaId) {
        throw new ForbiddenException('No tienes permisos para ver transferencias de esta liga');
      }
    }

    return this.serializeTransferencias(transferencias);
  }

  async findByJugador(jugadorId: number): Promise<any[]> {
    const transferencias = await this.transferenciaRepo.find({
      where: { jugadorId, activo: true },
      relations: ['jugador', 'campeonato', 'equipoOrigen', 'equipoDestino'],
      order: { fechaSolicitud: 'DESC' },
    });
    return this.serializeTransferencias(transferencias);
  }

  async cancelar(id: number, usuario: any): Promise<void> {
    const transferencia = await this.transferenciaRepo.findOne({
      where: { id, activo: true },
    });

    if (!transferencia) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    // Solo puede cancelar quien solicitó y solo si está pendiente
    if (transferencia.solicitadoPor !== usuario.userId && usuario.role !== 'master') {
      throw new ForbiddenException('Solo quien solicitó puede cancelar la transferencia');
    }

    if (transferencia.estadoEquipoOrigen !== 'pendiente') {
      throw new BadRequestException('No se puede cancelar una transferencia que ya fue procesada');
    }

    // Soft delete
    transferencia.activo = false;
    await this.transferenciaRepo.save(transferencia);
  }
}
