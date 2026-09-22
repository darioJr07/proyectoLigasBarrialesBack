import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Partido } from './entities/partido.entity';
import { ProgramacionSemanal } from './entities/programacion-semanal.entity';
import { ProgramacionBolilla } from './entities/programacion-bolilla.entity';
import { CrearProgramacionSemanalDto } from './dto/crear-programacion-semanal.dto';

@Injectable()
export class ProgramacionSemanalService {
  constructor(
    @InjectRepository(ProgramacionSemanal) private readonly programaciones: Repository<ProgramacionSemanal>,
    @InjectRepository(ProgramacionBolilla) private readonly bolillas: Repository<ProgramacionBolilla>,
    @InjectRepository(Partido) private readonly partidos: Repository<Partido>,
    @InjectRepository(Campeonato) private readonly campeonatos: Repository<Campeonato>,
    private readonly dataSource: DataSource,
  ) {}

  async crear(dto: CrearProgramacionSemanalDto, usuario: any) {
    const campeonato = await this.campeonatos.findOne({ where: { id: dto.campeonatoId, activo: true } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    this.validarLiga(campeonato.ligaId, usuario);

    const partidos = await this.partidosElegibles(dto);
    if (!partidos.length) throw new BadRequestException('No existen partidos programados sin horario para los filtros seleccionados.');
    if (dto.bolillas.length < partidos.length) throw new BadRequestException(`Se necesitan al menos ${partidos.length} bolillas para iniciar el sorteo.`);

    const repetidas = new Set<string>();
    for (const bolilla of dto.bolillas) {
      const clave = `${bolilla.fecha}|${bolilla.hora}|${bolilla.cancha.trim().toLowerCase()}`;
      if (repetidas.has(clave)) throw new BadRequestException('No puede existir más de una bolilla para la misma fecha, hora y cancha.');
      repetidas.add(clave);
    }

    for (const partido of partidos.filter(p => !!p.cancha)) {
      if (!dto.bolillas.some(b => b.cancha.trim().toLowerCase() === partido.cancha!.trim().toLowerCase())) {
        throw new BadRequestException(`El partido ${partido.equipoLocal?.nombre} vs ${partido.equipoVisitante?.nombre} tiene cancha "${partido.cancha}" y no cuenta con una bolilla compatible.`);
      }
    }

    const sesion = await this.programaciones.save(this.programaciones.create({
      ligaId: campeonato.ligaId, campeonatoId: dto.campeonatoId, categoriaId: dto.categoriaId ?? null,
      etapa: dto.etapa, jornada: dto.jornada, totalPartidos: partidos.length, estado: 'en_sorteo', creadoPor: usuario.id ?? null,
    }));
    await this.bolillas.save(dto.bolillas.map((b, indice) => this.bolillas.create({
      programacionId: sesion.id, numero: indice + 1, fecha: b.fecha as any, hora: b.hora, cancha: b.cancha.trim(), estado: 'disponible',
    })));
    return this.detalle(sesion.id, usuario);
  }

  async pendiente(campeonatoId: number, categoriaId: number | undefined, etapa: string, jornada: number, usuario: any) {
    const campeonato = await this.campeonatos.findOne({ where: { id: campeonatoId, activo: true } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    this.validarLiga(campeonato.ligaId, usuario);

    const sesion = await this.programaciones.findOne({
      where: {
        campeonatoId,
        categoriaId: categoriaId ?? IsNull(),
        etapa,
        jornada,
        estado: 'en_sorteo',
      },
      order: { creadoEn: 'DESC' },
    });
    return sesion ? this.detalle(sesion.id, usuario) : null;
  }

  async detalle(id: number, usuario: any) {
    const sesion = await this.programaciones.findOne({ where: { id } });
    if (!sesion) throw new NotFoundException('Sesión de programación no encontrada.');
    this.validarLiga(sesion.ligaId, usuario);
    const bolillas = await this.bolillas.find({ where: { programacionId: id }, order: { numero: 'ASC' } });
    // La sesión puede haberse iniciado antes de que un partido se registre como
    // jugado (por ejemplo, por resultado administrativo). Solo los que siguen
    // programados y sin horario deben participar o bloquear la confirmación.
    const partidos = await this.partidos.find({ where: { campeonatoId: sesion.campeonatoId, etapa: sesion.etapa, jornada: sesion.jornada, activo: true } });
    const incluidos = partidos.filter(p =>
      (!sesion.categoriaId || p.categoriaId === sesion.categoriaId)
      && p.estado === 'programado'
      && (!p.fechaPartido || !p.horaPartido),
    );
    const porId = new Map(incluidos.map(p => [p.id, p]));
    return {
      ...sesion,
      // Es un total operativo de la sesión recuperada; al confirmar también
      // se persiste para que el historial no conserve el total obsoleto.
      totalPartidos: incluidos.length,
      bolillas: bolillas.map(b => ({ ...b, partido: b.partidoId ? porId.get(b.partidoId) ?? null : null })),
      partidos: incluidos,
    };
  }

  async sacarBolilla(id: number, partidoId: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La sesión no está disponible para sortear.');
    const partido = detalle.partidos.find((item: Partido) => item.id === partidoId);
    if (!partido || partido.estado !== 'programado' || (partido.fechaPartido && partido.horaPartido)) throw new BadRequestException('El partido no puede participar en esta sesión.');
    if (detalle.bolillas.some((b: ProgramacionBolilla) => b.partidoId === partidoId)) throw new BadRequestException('Este partido ya tiene una bolilla asignada.');

    const disponibles = detalle.bolillas.filter((b: ProgramacionBolilla) => b.estado === 'disponible' && (!partido.cancha || b.cancha.toLowerCase() === partido.cancha.toLowerCase()));
    if (!disponibles.length) throw new BadRequestException('No hay bolillas compatibles disponibles para este partido.');
    const bolilla = disponibles[randomInt(disponibles.length)];
    bolilla.partidoId = partidoId; bolilla.estado = 'asignada'; bolilla.ordenSorteo = detalle.bolillas.filter((b: ProgramacionBolilla) => b.estado === 'asignada').length + 1;
    await this.bolillas.save(bolilla);
    return { bolilla, partido };
  }

  async confirmar(id: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La sesión no se puede confirmar.');
    const partidosProgramables = detalle.partidos as Partido[];
    const idsProgramables = new Set(partidosProgramables.map(partido => partido.id));
    const asignadas = detalle.bolillas.filter((bolilla: ProgramacionBolilla) =>
      bolilla.estado === 'asignada'
      && !!bolilla.partidoId
      && idsProgramables.has(bolilla.partidoId),
    );
    if (asignadas.length !== partidosProgramables.length) {
      throw new BadRequestException(`Faltan ${partidosProgramables.length - asignadas.length} partidos por sortear.`);
    }

    await this.dataSource.transaction(async manager => {
      for (const bolilla of asignadas) {
        const partido = await manager.findOne(Partido, { where: { id: bolilla.partidoId!, activo: true } });
        if (!partido || partido.estado !== 'programado') throw new BadRequestException('Uno de los partidos ya no está disponible para programar.');
        partido.fechaPartido = bolilla.fecha;
        partido.horaPartido = bolilla.hora;
        partido.cancha = partido.cancha || bolilla.cancha;
        await manager.save(partido);
      }
      // Toda bolilla que no se usó para un partido todavía programable queda
      // cerrada como no utilizada; no debe aparentar estar disponible después
      // de confirmar una sesión que cambió durante el sorteo.
      for (const bolilla of detalle.bolillas as ProgramacionBolilla[]) {
        if (asignadas.some(asignada => asignada.id === bolilla.id)) continue;
        if (bolilla.estado === 'no_utilizada') continue;
        bolilla.partidoId = null;
        bolilla.estado = 'no_utilizada';
        bolilla.ordenSorteo = null;
        bolilla.asignacionManual = false;
        await manager.save(ProgramacionBolilla, bolilla);
      }
      await manager.update(ProgramacionSemanal, id, {
        estado: 'confirmada',
        confirmadoEn: new Date(),
        totalPartidos: partidosProgramables.length,
      });
    });
    return this.detalle(id, usuario);
  }

  async cancelar(id: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('Solo se puede cancelar un sorteo que está en curso.');
    await this.programaciones.update(id, { estado: 'cancelada' });
    return { mensaje: 'Sorteo cancelado. No se realizaron cambios en los partidos.' };
  }

  async liberarBolilla(id: number, bolillaId: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La corrección solo está disponible antes de confirmar.');
    const bolilla = detalle.bolillas.find((item: ProgramacionBolilla) => item.id === bolillaId);
    if (!bolilla || !bolilla.partidoId) throw new NotFoundException('Bolilla asignada no encontrada.');
    bolilla.partidoId = null;
    bolilla.estado = 'disponible';
    bolilla.ordenSorteo = null;
    bolilla.asignacionManual = false;
    await this.bolillas.save(bolilla);
    return this.detalle(id, usuario);
  }

  async asignarManual(id: number, partidoId: number, bolillaId: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La corrección solo está disponible antes de confirmar.');
    const partido = detalle.partidos.find((item: Partido) => item.id === partidoId);
    if (!partido || partido.estado !== 'programado' || (partido.fechaPartido && partido.horaPartido)) throw new BadRequestException('El partido no puede recibir una asignación manual.');
    if (detalle.bolillas.some((item: ProgramacionBolilla) => item.partidoId === partidoId)) throw new BadRequestException('Primero libera la bolilla actual de este partido.');
    const bolilla = detalle.bolillas.find((item: ProgramacionBolilla) => item.id === bolillaId);
    if (!bolilla || bolilla.estado !== 'disponible') throw new BadRequestException('La bolilla seleccionada ya no está disponible.');
    if (partido.cancha && bolilla.cancha.trim().toLowerCase() !== partido.cancha.trim().toLowerCase()) throw new BadRequestException('La bolilla no corresponde a la cancha registrada para este partido.');

    bolilla.partidoId = partidoId;
    bolilla.estado = 'asignada';
    bolilla.asignacionManual = true;
    bolilla.ordenSorteo = null;
    await this.bolillas.save(bolilla);
    return this.detalle(id, usuario);
  }

  private async partidosElegibles(dto: CrearProgramacionSemanalDto): Promise<Partido[]> {
    const query = this.partidos.createQueryBuilder('partido')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal').leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId: dto.campeonatoId })
      .andWhere('partido.etapa = :etapa', { etapa: dto.etapa }).andWhere('partido.jornada = :jornada', { jornada: dto.jornada })
      .andWhere('partido.activo = true').andWhere("partido.estado = 'programado'")
      .andWhere('(partido.fecha_partido IS NULL OR partido.hora_partido IS NULL)');
    if (dto.categoriaId) query.andWhere('partido.categoria_id = :categoriaId', { categoriaId: dto.categoriaId });
    return query.orderBy('partido.categoria_id', 'ASC').addOrderBy('partido.id', 'ASC').getMany();
  }

  private validarLiga(ligaId: number, usuario: any): void {
    if (usuario.role === 'master') return;
    if (usuario.role !== 'directivo_liga' || Number(usuario.ligaId) !== ligaId) throw new ForbiddenException('No tienes permisos para programar partidos de esta liga.');
  }
}
