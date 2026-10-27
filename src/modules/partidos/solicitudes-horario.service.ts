import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Partido } from './entities/partido.entity';
import { SolicitudHorario } from './entities/solicitud-horario.entity';
import { CrearSolicitudHorarioDto, ResolverSolicitudHorarioDto } from './dto/solicitud-horario.dto';

@Injectable()
export class SolicitudesHorarioService {
  constructor(
    @InjectRepository(SolicitudHorario) private readonly solicitudes: Repository<SolicitudHorario>,
    @InjectRepository(Partido) private readonly partidos: Repository<Partido>,
    @InjectRepository(Campeonato) private readonly campeonatos: Repository<Campeonato>,
  ) {}

  async crear(dto: CrearSolicitudHorarioDto, usuario: any) {
    const campeonato = await this.obtenerCampeonato(dto.campeonatoId, usuario);
    const partido = await this.partidos.findOne({ where: { id: dto.partidoId, activo: true } });
    if (!partido) throw new NotFoundException('Partido no encontrado.');
    if (partido.campeonatoId !== dto.campeonatoId || partido.categoriaId !== dto.categoriaId || partido.etapa !== dto.etapa.trim()) {
      throw new BadRequestException('El partido no corresponde al campeonato, categoría y etapa seleccionados.');
    }
    if (partido.equipoLocalId !== dto.equipoId && partido.equipoVisitanteId !== dto.equipoId) {
      throw new BadRequestException('El equipo solicitante no participa en el partido.');
    }
    if (partido.estado !== 'programado' || (partido.fechaPartido && partido.horaPartido)) {
      throw new BadRequestException('El partido ya no está disponible para solicitar horario.');
    }
    if (usuario.role === 'dirigente_equipo' && Number(usuario.equipoId) !== dto.equipoId) {
      throw new ForbiddenException('Solo puedes registrar solicitudes para tu equipo.');
    }

    const vigente = await this.solicitudes.findOne({
      where: {
        campeonatoId: dto.campeonatoId,
        categoriaId: dto.categoriaId,
        etapa: dto.etapa.trim(),
        equipoId: dto.equipoId,
        estado: In(['pendiente', 'aprobada', 'aplicada']),
      },
    });
    if (vigente) {
      throw new BadRequestException('El equipo ya utilizó o mantiene una solicitud reglamentaria activa en esta etapa.');
    }

    return this.solicitudes.save(this.solicitudes.create({
      ligaId: campeonato.ligaId,
      campeonatoId: dto.campeonatoId,
      categoriaId: dto.categoriaId,
      etapa: dto.etapa.trim(),
      equipoId: dto.equipoId,
      partidoId: dto.partidoId,
      fechaSolicitada: dto.fechaSolicitada as any,
      horaSolicitada: dto.horaSolicitada,
      canchaSolicitada: dto.canchaSolicitada?.trim() || null,
      motivo: dto.motivo.trim(),
      estado: 'pendiente',
      programacionId: null,
      bolillaId: null,
      solicitadoPor: usuario.id ?? usuario.userId ?? null,
      resueltoPor: null,
      observacionResolucion: null,
      resueltoEn: null,
    }));
  }

  async listar(
    campeonatoId: number,
    categoriaId: number | undefined,
    etapa: string | undefined,
    estado: string | undefined,
    usuario: any,
  ) {
    await this.obtenerCampeonato(campeonatoId, usuario);
    const query = this.solicitudes.createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.equipo', 'equipo')
      .leftJoinAndSelect('solicitud.partido', 'partido')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('solicitud.campeonato_id = :campeonatoId', { campeonatoId });
    if (categoriaId) query.andWhere('solicitud.categoria_id = :categoriaId', { categoriaId });
    if (etapa?.trim()) query.andWhere('solicitud.etapa = :etapa', { etapa: etapa.trim() });
    if (estado?.trim()) query.andWhere('solicitud.estado = :estado', { estado: estado.trim() });
    if (usuario.role === 'dirigente_equipo') query.andWhere('solicitud.equipo_id = :equipoId', { equipoId: usuario.equipoId });
    return query.orderBy('solicitud.creado_en', 'DESC').getMany();
  }

  async resolver(id: number, dto: ResolverSolicitudHorarioDto, usuario: any) {
    const solicitud = await this.solicitudes.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud de horario no encontrada.');
    await this.obtenerCampeonato(solicitud.campeonatoId, usuario, true);
    if (solicitud.estado === 'aplicada') throw new BadRequestException('Una solicitud aplicada ya no se puede modificar.');
    if (dto.decision === 'aprobar') {
      if (solicitud.estado !== 'pendiente') throw new BadRequestException('Solo se pueden aprobar solicitudes pendientes.');
      const otraAprobada = await this.solicitudes.findOne({ where: { partidoId: solicitud.partidoId, estado: 'aprobada' } });
      if (otraAprobada && otraAprobada.id !== solicitud.id) {
        throw new BadRequestException('Este partido ya tiene otra solicitud de horario aprobada. Rechaza o cancela una antes de continuar.');
      }
      const partido = await this.partidos.findOne({ where: { id: solicitud.partidoId, activo: true } });
      if (!partido || partido.estado !== 'programado' || (partido.fechaPartido && partido.horaPartido)) {
        throw new BadRequestException('El partido ya no está disponible para aplicar la solicitud.');
      }
      solicitud.estado = 'aprobada';
    } else {
      if (!['pendiente', 'aprobada'].includes(solicitud.estado)) {
        throw new BadRequestException('La solicitud ya no se puede resolver.');
      }
      if (solicitud.programacionId || solicitud.bolillaId) {
        throw new BadRequestException('La solicitud ya está reservada en un bolillero. Primero libera su bolilla en la programación semanal.');
      }
      if (!dto.observacion?.trim()) throw new BadRequestException('Indica el motivo del rechazo o cancelación.');
      solicitud.estado = dto.decision === 'rechazar' ? 'rechazada' : 'cancelada';
      solicitud.programacionId = null;
      solicitud.bolillaId = null;
    }
    solicitud.observacionResolucion = dto.observacion?.trim() || null;
    solicitud.resueltoPor = usuario.id ?? usuario.userId ?? null;
    solicitud.resueltoEn = new Date();
    return this.solicitudes.save(solicitud);
  }

  async aprobadasParaPartidos(partidoIds: number[]): Promise<SolicitudHorario[]> {
    if (!partidoIds.length) return [];
    return this.solicitudes.find({
      where: { partidoId: In(partidoIds), estado: 'aprobada' },
      order: { creadoEn: 'ASC' },
    });
  }

  private async obtenerCampeonato(campeonatoId: number, usuario: any, soloDirectivo = false): Promise<Campeonato> {
    const campeonato = await this.campeonatos.findOne({ where: { id: campeonatoId, activo: true } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    if (usuario.role === 'master') return campeonato;
    if (soloDirectivo && usuario.role !== 'directivo_liga') throw new ForbiddenException('Solo un directivo puede resolver la solicitud.');
    if (!['directivo_liga', 'dirigente_equipo'].includes(usuario.role) || Number(usuario.ligaId) !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para gestionar solicitudes de esta liga.');
    }
    if (usuario.role === 'dirigente_equipo' && !usuario.equipoId) throw new ForbiddenException('Tu usuario no tiene un equipo asignado.');
    return campeonato;
  }
}
