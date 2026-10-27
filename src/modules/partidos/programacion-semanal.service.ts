import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Partido } from './entities/partido.entity';
import { ProgramacionSemanal } from './entities/programacion-semanal.entity';
import { ProgramacionBolilla } from './entities/programacion-bolilla.entity';
import { CrearProgramacionSemanalDto } from './dto/crear-programacion-semanal.dto';
import { ConfigurarVocaliaDto } from './dto/vocalia-programacion.dto';
import { VocaliaPartido } from './entities/vocalia-partido.entity';
import { SolicitudHorario } from './entities/solicitud-horario.entity';
import { ProgramacionSeleccion } from './entities/programacion-seleccion.entity';
import { SeleccionProgramacionDto } from './dto/crear-programacion-semanal.dto';

@Injectable()
export class ProgramacionSemanalService {
  constructor(
    @InjectRepository(ProgramacionSemanal) private readonly programaciones: Repository<ProgramacionSemanal>,
    @InjectRepository(ProgramacionBolilla) private readonly bolillas: Repository<ProgramacionBolilla>,
    @InjectRepository(Partido) private readonly partidos: Repository<Partido>,
    @InjectRepository(Campeonato) private readonly campeonatos: Repository<Campeonato>,
    @InjectRepository(VocaliaPartido) private readonly vocalias: Repository<VocaliaPartido>,
    @InjectRepository(SolicitudHorario) private readonly solicitudesHorario: Repository<SolicitudHorario>,
    @InjectRepository(ProgramacionSeleccion) private readonly selecciones: Repository<ProgramacionSeleccion>,
    private readonly dataSource: DataSource,
  ) {}

  async crear(dto: CrearProgramacionSemanalDto, usuario: any) {
    const campeonato = await this.campeonatos.findOne({ where: { id: dto.campeonatoId, activo: true } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    this.validarLiga(campeonato.ligaId, usuario);

    const selecciones = this.normalizarSelecciones(dto);
    const sesionesAbiertas = await this.programaciones.find({
      where: { campeonatoId: dto.campeonatoId, etapa: dto.etapa, estado: 'en_sorteo' },
      order: { creadoEn: 'ASC' },
    });
    let sesionSuperpuesta: ProgramacionSemanal | undefined;
    for (const sesion of sesionesAbiertas) {
      const seleccionesSesion = await this.seleccionesDeSesion(sesion);
      if (this.seleccionesSuperpuestas(selecciones, seleccionesSesion)) {
        sesionSuperpuesta = sesion;
        break;
      }
    }
    if (sesionSuperpuesta) {
      throw new BadRequestException(
        `Ya existe un sorteo en curso (#${sesionSuperpuesta.id}) que incluye una de las categorías y jornadas seleccionadas. Recupéralo o cancélalo antes de iniciar otro sorteo.`,
      );
    }

    const partidos = await this.partidosElegibles(dto.campeonatoId, dto.etapa, selecciones);
    if (!partidos.length) throw new BadRequestException('No existen partidos programados sin horario para los filtros seleccionados.');
    const seleccionSinPartidos = selecciones.find(seleccion => !partidos.some(partido =>
      partido.jornada === seleccion.jornada
      && (seleccion.categoriaId === null || partido.categoriaId === seleccion.categoriaId),
    ));
    if (seleccionSinPartidos) {
      throw new BadRequestException(`La categoría #${seleccionSinPartidos.categoriaId} no tiene partidos pendientes en la jornada ${seleccionSinPartidos.jornada}.`);
    }
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

    const solicitudesAprobadas = await this.solicitudesHorario.find({
      where: { partidoId: In(partidos.map(partido => partido.id)), estado: 'aprobada' },
    });
    const bolillasReservadas = new Set<number>();
    const solicitudesOrdenadas = [...solicitudesAprobadas].sort((a, b) => {
      const partidoA = partidos.find(item => item.id === a.partidoId)!;
      const partidoB = partidos.find(item => item.id === b.partidoId)!;
      const opcionesA = dto.bolillas.filter(bolilla => this.esBolillaCompatible(a, bolilla, partidoA)).length;
      const opcionesB = dto.bolillas.filter(bolilla => this.esBolillaCompatible(b, bolilla, partidoB)).length;
      return opcionesA - opcionesB;
    });
    for (const solicitud of solicitudesOrdenadas) {
      const partido = partidos.find(item => item.id === solicitud.partidoId)!;
      const indiceCompatible = dto.bolillas.findIndex((bolilla, indice) =>
        !bolillasReservadas.has(indice) && this.esBolillaCompatible(solicitud, bolilla, partido),
      );
      if (indiceCompatible < 0) {
        throw new BadRequestException(
          `La solicitud aprobada de ${solicitud.equipo?.nombre ?? 'un equipo'} requiere ${String(solicitud.fechaSolicitada).slice(0, 10)} ${solicitud.horaSolicitada}. Agrega esa bolilla antes de iniciar.`,
        );
      }
      bolillasReservadas.add(indiceCompatible);
    }

    const sesion = await this.dataSource.transaction(async manager => {
      const repositorioProgramaciones = manager.getRepository(ProgramacionSemanal);
      const repositorioSelecciones = manager.getRepository(ProgramacionSeleccion);
      const repositorioBolillas = manager.getRepository(ProgramacionBolilla);
      const nuevaSesion = await repositorioProgramaciones.save(repositorioProgramaciones.create({
        ligaId: campeonato.ligaId, campeonatoId: dto.campeonatoId,
        categoriaId: selecciones.length === 1 ? selecciones[0].categoriaId : null,
        etapa: dto.etapa, jornada: selecciones[0].jornada, totalPartidos: partidos.length, estado: 'en_sorteo', creadoPor: usuario.id ?? null,
      }));
      await repositorioSelecciones.save(selecciones.map(seleccion => repositorioSelecciones.create({
        programacionId: nuevaSesion.id,
        categoriaId: seleccion.categoriaId,
        jornada: seleccion.jornada,
      })));
      await repositorioBolillas.save(dto.bolillas.map((b, indice) => repositorioBolillas.create({
        programacionId: nuevaSesion.id, numero: indice + 1, fecha: b.fecha as any, hora: b.hora, cancha: b.cancha.trim(), estado: 'disponible',
      })));
      return nuevaSesion;
    });
    return this.detalle(sesion.id, usuario);
  }

  async pendiente(
    campeonatoId: number,
    categoriaId: number | undefined,
    etapa: string,
    jornada: number | undefined,
    usuario: any,
    solicitadas?: SeleccionProgramacionDto[],
  ) {
    const campeonato = await this.campeonatos.findOne({ where: { id: campeonatoId, activo: true } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    this.validarLiga(campeonato.ligaId, usuario);

    const candidatas = await this.programaciones.find({
      where: { campeonatoId, etapa, estado: 'en_sorteo' },
      order: { creadoEn: 'DESC' },
    });
    const buscadas: Array<{ categoriaId: number | null; jornada: number }> = solicitadas?.length
      ? solicitadas.map(item => ({ categoriaId: item.categoriaId, jornada: item.jornada }))
      : jornada
        ? [{ categoriaId: categoriaId ?? null, jornada }]
        : [];
    let sesion: ProgramacionSemanal | undefined;
    for (const candidata of candidatas) {
      const seleccionesSesion = await this.seleccionesDeSesion(candidata);
      if (!buscadas.length || this.seleccionesSuperpuestas(buscadas, seleccionesSesion)) {
        sesion = candidata;
        break;
      }
    }
    return sesion ? this.detalle(sesion.id, usuario) : null;
  }

  async listarConfirmadas(
    campeonatoId: number,
    categoriaId: number | undefined,
    etapa: string | undefined,
    jornada: number | undefined,
    usuario: any,
  ) {
    const campeonato = await this.campeonatos.findOne({ where: { id: campeonatoId } });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado.');
    this.validarLiga(campeonato.ligaId, usuario);

    if (categoriaId !== undefined && (!Number.isInteger(categoriaId) || categoriaId < 1)) {
      throw new BadRequestException('La categoría indicada no es válida.');
    }
    if (jornada !== undefined && (!Number.isInteger(jornada) || jornada < 1)) {
      throw new BadRequestException('La jornada indicada no es válida.');
    }

    const where: any = { campeonatoId, estado: 'confirmada' };
    if (etapa?.trim()) where.etapa = etapa.trim();

    const confirmadas = await this.programaciones.find({
      where,
      order: { confirmadoEn: 'DESC', creadoEn: 'DESC' },
    });

    const enriquecidas = await Promise.all(confirmadas.map(async sesion => ({
      ...sesion,
      selecciones: await this.seleccionesDeSesion(sesion),
    })));
    return enriquecidas.filter(sesion => sesion.selecciones.some(seleccion =>
      (categoriaId === undefined || seleccion.categoriaId === null || seleccion.categoriaId === categoriaId)
      && (jornada === undefined || seleccion.jornada === jornada),
    ));
  }

  async detalle(id: number, usuario: any) {
    const sesion = await this.programaciones.findOne({ where: { id } });
    if (!sesion) throw new NotFoundException('Sesión de programación no encontrada.');
    this.validarLiga(sesion.ligaId, usuario);
    const bolillas = await this.bolillas.find({ where: { programacionId: id }, order: { numero: 'ASC' } });
    const selecciones = await this.seleccionesDeSesion(sesion);
    // Durante el sorteo solo participan encuentros programados sin horario.
    // Una vez confirmada la sesión, esos encuentros ya tienen fecha y hora;
    // por eso se reconstruyen desde los partidoId conservados en las bolillas.
    // De esta forma la pantalla y las exportaciones mantienen local/visitante.
    let incluidos: Partido[];
    if (sesion.estado === 'confirmada') {
      const partidoIds = [...new Set(
        bolillas
          .filter(bolilla => bolilla.estado === 'asignada' && !!bolilla.partidoId)
          .map(bolilla => Number(bolilla.partidoId)),
      )];
      incluidos = partidoIds.length
        ? await this.partidos.find({ where: { id: In(partidoIds), activo: true } })
        : [];
    } else {
      const partidos = await this.partidosDeSelecciones(sesion.campeonatoId, sesion.etapa, selecciones);
      // La sesión puede haberse iniciado antes de que un partido se registre
      // como jugado (por ejemplo, por resultado administrativo).
      incluidos = partidos.filter(p =>
        p.estado === 'programado'
        && (!p.fechaPartido || !p.horaPartido),
      );
    }
    const porId = new Map(incluidos.map(p => [p.id, p]));
    const solicitudesHorario = incluidos.length
      ? await this.solicitudesHorario.find({
          where: sesion.estado === 'confirmada'
            ? { programacionId: id, estado: 'aplicada' }
            : { partidoId: In(incluidos.map(partido => partido.id)), estado: 'aprobada' },
          order: { creadoEn: 'ASC' },
        })
      : [];
    return {
      ...sesion,
      // Es un total operativo de la sesión recuperada; al confirmar también
      // se persiste para que el historial no conserve el total obsoleto.
      totalPartidos: sesion.estado === 'confirmada' ? sesion.totalPartidos : incluidos.length,
      bolillas: bolillas.map(b => ({ ...b, partido: b.partidoId ? porId.get(b.partidoId) ?? null : null })),
      partidos: incluidos,
      selecciones,
      solicitudesHorario,
    };
  }

  async sacarBolilla(id: number, partidoId: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La sesión no está disponible para sortear.');
    const partido = detalle.partidos.find((item: Partido) => item.id === partidoId);
    if (!partido || partido.estado !== 'programado' || (partido.fechaPartido && partido.horaPartido)) throw new BadRequestException('El partido no puede participar en esta sesión.');
    if (detalle.bolillas.some((b: ProgramacionBolilla) => b.partidoId === partidoId)) throw new BadRequestException('Este partido ya tiene una bolilla asignada.');
    const solicitudAprobada = await this.solicitudesHorario.findOne({ where: { partidoId, estado: 'aprobada' } });
    if (solicitudAprobada) throw new BadRequestException('Este partido tiene una solicitud reglamentaria aprobada. Reserva primero su horario solicitado.');

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

    const solicitudesAprobadas = await this.solicitudesHorario.find({
      where: { partidoId: In(partidosProgramables.map(partido => partido.id)), estado: 'aprobada' },
    });
    const solicitudSinAplicar = solicitudesAprobadas.find(solicitud =>
      !asignadas.some((bolilla: ProgramacionBolilla) => bolilla.solicitudHorarioId === solicitud.id && bolilla.partidoId === solicitud.partidoId),
    );
    if (solicitudSinAplicar) {
      throw new BadRequestException(`Falta aplicar la solicitud reglamentaria de ${solicitudSinAplicar.equipo?.nombre ?? 'un equipo'}.`);
    }

    await this.dataSource.transaction(async manager => {
      for (const bolilla of asignadas) {
        const partido = await manager.findOne(Partido, { where: { id: bolilla.partidoId!, activo: true } });
        if (!partido || partido.estado !== 'programado') throw new BadRequestException('Uno de los partidos ya no está disponible para programar.');
        partido.fechaPartido = bolilla.fecha;
        partido.horaPartido = bolilla.hora;
        partido.cancha = partido.cancha || bolilla.cancha;
        await manager.save(partido);
        if (bolilla.solicitudHorarioId) {
          await manager.update(SolicitudHorario, bolilla.solicitudHorarioId, {
            estado: 'aplicada',
            programacionId: id,
            bolillaId: bolilla.id,
          });
        }
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
        bolilla.solicitudHorarioId = null;
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
    await this.dataSource.transaction(async manager => {
      await manager.update(SolicitudHorario, { programacionId: id, estado: 'aprobada' }, { programacionId: null, bolillaId: null });
      await manager.update(ProgramacionBolilla, { programacionId: id }, { solicitudHorarioId: null });
      await manager.update(ProgramacionSemanal, id, { estado: 'cancelada' });
    });
    return { mensaje: 'Sorteo cancelado. No se realizaron cambios en los partidos.' };
  }

  async liberarBolilla(id: number, bolillaId: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La corrección solo está disponible antes de confirmar.');
    const bolilla = detalle.bolillas.find((item: ProgramacionBolilla) => item.id === bolillaId);
    if (!bolilla || !bolilla.partidoId) throw new NotFoundException('Bolilla asignada no encontrada.');
    if (bolilla.solicitudHorarioId) {
      await this.solicitudesHorario.update(bolilla.solicitudHorarioId, { programacionId: null, bolillaId: null });
    }
    bolilla.partidoId = null;
    bolilla.estado = 'disponible';
    bolilla.ordenSorteo = null;
    bolilla.asignacionManual = false;
    bolilla.solicitudHorarioId = null;
    await this.bolillas.save(bolilla);
    return this.detalle(id, usuario);
  }

  async asignarManual(id: number, partidoId: number, bolillaId: number, usuario: any, solicitudHorarioId?: number) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'en_sorteo') throw new BadRequestException('La corrección solo está disponible antes de confirmar.');
    const partido = detalle.partidos.find((item: Partido) => item.id === partidoId);
    if (!partido || partido.estado !== 'programado' || (partido.fechaPartido && partido.horaPartido)) throw new BadRequestException('El partido no puede recibir una asignación manual.');
    if (detalle.bolillas.some((item: ProgramacionBolilla) => item.partidoId === partidoId)) throw new BadRequestException('Primero libera la bolilla actual de este partido.');
    const bolilla = detalle.bolillas.find((item: ProgramacionBolilla) => item.id === bolillaId);
    if (!bolilla || bolilla.estado !== 'disponible') throw new BadRequestException('La bolilla seleccionada ya no está disponible.');
    if (partido.cancha && bolilla.cancha.trim().toLowerCase() !== partido.cancha.trim().toLowerCase()) throw new BadRequestException('La bolilla no corresponde a la cancha registrada para este partido.');

    const solicitudAprobada = await this.solicitudesHorario.findOne({ where: { partidoId, estado: 'aprobada' } });
    if (solicitudAprobada && solicitudAprobada.id !== solicitudHorarioId) {
      throw new BadRequestException('Este partido tiene una solicitud reglamentaria aprobada. Debes aplicar exactamente esa solicitud.');
    }
    let solicitud: SolicitudHorario | null = null;
    if (solicitudHorarioId) {
      solicitud = await this.solicitudesHorario.findOne({ where: { id: solicitudHorarioId, estado: 'aprobada' } });
      if (!solicitud || solicitud.partidoId !== partidoId) throw new BadRequestException('La solicitud reglamentaria no corresponde al partido.');
      if (!this.esBolillaCompatible(solicitud, bolilla, partido)) {
        throw new BadRequestException('La bolilla no coincide con la fecha, hora o cancha de la solicitud aprobada.');
      }
      const enlaceExistente = await this.bolillas.findOne({ where: { solicitudHorarioId: solicitud.id } });
      if (enlaceExistente && enlaceExistente.id !== bolilla.id) {
        const programacionAnterior = await this.programaciones.findOne({ where: { id: enlaceExistente.programacionId } });
        const referencia = programacionAnterior
          ? `#${programacionAnterior.id}, ${programacionAnterior.etapa}, jornada ${programacionAnterior.jornada}`
          : `#${enlaceExistente.programacionId}`;
        throw new BadRequestException(
          `Esta solicitud ya está asignada al sorteo en curso ${referencia}. Recupera esa programación o libera/cancela su bolilla antes de usar la solicitud en otro sorteo.`,
        );
      }
      bolilla.solicitudHorarioId = solicitud.id;
    } else {
      bolilla.solicitudHorarioId = null;
    }

    bolilla.partidoId = partidoId;
    bolilla.estado = 'asignada';
    bolilla.asignacionManual = true;
    bolilla.ordenSorteo = null;
    try {
      await this.dataSource.transaction(async manager => {
        await manager.save(ProgramacionBolilla, bolilla);
        if (solicitud) {
          await manager.update(SolicitudHorario, solicitud.id, { programacionId: id, bolillaId: bolilla.id });
        }
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new BadRequestException(
          'Esta solicitud ya está reservada en otro sorteo en curso. Recupera esa programación o libera/cancela su bolilla antes de intentarlo nuevamente.',
        );
      }
      throw error;
    }
    return this.detalle(id, usuario);
  }

  async obtenerVocalias(id: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'confirmada') throw new BadRequestException('Primero debes confirmar la programación de horarios.');
    const registros = await this.vocalias.find({ where: { programacionId: id } });
    const orden = new Map((detalle.bolillas as ProgramacionBolilla[]).map((bolilla, indice) => [bolilla.partidoId, indice]));
    registros.sort((a, b) => (orden.get(a.partidoId) ?? 9999) - (orden.get(b.partidoId) ?? 9999));
    return {
      estado: !registros.length ? 'sin_asignar' : registros.every(item => item.estado === 'confirmada') ? 'confirmada' : 'en_preparacion',
      vocalias: registros,
    };
  }

  async prepararVocalias(id: number, usuario: any) {
    const actual = await this.obtenerVocalias(id, usuario);
    if (actual.vocalias.length) return actual;
    const detalle = await this.detalle(id, usuario);
    const bolillasAsignadas = (detalle.bolillas as any[]).filter(bolilla => bolilla.partidoId && bolilla.partido);
    if (!bolillasAsignadas.length) throw new BadRequestException('La programación confirmada no tiene partidos disponibles.');

    const bloques = new Map<string, any[]>();
    for (const bolilla of bolillasAsignadas) {
      // La regla par/impar se evalúa sobre la programación completa del día,
      // aunque existan varias canchas.
      const clave = String(bolilla.fecha).slice(0, 10);
      bloques.set(clave, [...(bloques.get(clave) ?? []), bolilla]);
    }

    const nuevos: VocaliaPartido[] = [];
    for (const bloque of bloques.values()) {
      bloque.sort((a, b) => `${a.hora}|${a.cancha}|${a.numero}`.localeCompare(`${b.hora}|${b.cancha}|${b.numero}`));
      const cantidadImpar = bloque.length % 2 === 1;
      for (let indice = 0; indice < bloque.length; indice += 1) {
        let origen: any | undefined;
        let regla: VocaliaPartido['reglaAsignacion'] = 'normal';
        if (cantidadImpar && bloque.length >= 3 && indice >= bloque.length - 3) {
          regla = 'cierre_tres';
          if (indice === bloque.length - 3) origen = bloque[bloque.length - 1];
          if (indice === bloque.length - 2) origen = bloque[bloque.length - 3];
          if (indice === bloque.length - 1) origen = bloque[bloque.length - 2];
        } else if (bloque.length > 1) {
          // En una programación par, cada pareja de partidos intercambia sus
          // vocales: 1 ↔ 2, 3 ↔ 4, etc. En una programación impar, esta regla
          // se aplica hasta llegar al cierre especial de los tres últimos.
          origen = bloque[indice % 2 === 0 ? indice + 1 : indice - 1];
        }
        nuevos.push(this.vocalias.create({
          programacionId: id,
          partidoId: bloque[indice].partidoId,
          partidoOrigenId: origen?.partidoId ?? null,
          tipoAsignacion: 'sorteo',
          reglaAsignacion: regla,
          equipoExtractorId: null,
          resultadoBolilla: null,
          equipoVocalId: null,
          directivoNombre: null,
          estado: 'pendiente',
          creadoPor: usuario.id ?? null,
        }));
      }
    }
    await this.vocalias.save(nuevos);
    return this.obtenerVocalias(id, usuario);
  }

  async reiniciarVocalias(id: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'confirmada') throw new BadRequestException('Primero debes confirmar la programación de horarios.');
    const existentes = await this.vocalias.find({ where: { programacionId: id } });
    if (existentes.some(item => item.estado === 'confirmada')) {
      throw new BadRequestException('Las vocalías confirmadas no se pueden regenerar.');
    }
    if (existentes.length) await this.vocalias.delete({ programacionId: id });
    return this.prepararVocalias(id, usuario);
  }

  async configurarVocalia(id: number, vocaliaId: number, dto: ConfigurarVocaliaDto, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    if (detalle.estado !== 'confirmada') throw new BadRequestException('La programación aún no está confirmada.');
    const vocalia = await this.vocalias.findOne({ where: { id: vocaliaId, programacionId: id } });
    if (!vocalia) throw new NotFoundException('Asignación de vocalía no encontrada.');
    if (vocalia.estado === 'confirmada') throw new BadRequestException('Las vocalías confirmadas son de solo lectura.');

    const partidos = detalle.partidos as Partido[];
    const origen = dto.partidoOrigenId ? partidos.find(partido => partido.id === dto.partidoOrigenId) : undefined;
    if (dto.partidoOrigenId && (!origen || origen.id === vocalia.partidoId)) {
      throw new BadRequestException('El partido que proporciona la vocalía no es válido.');
    }

    const cambios: Partial<VocaliaPartido> = {
      tipoAsignacion: dto.tipoAsignacion,
      reglaAsignacion: dto.tipoAsignacion !== vocalia.tipoAsignacion
        || (!!dto.partidoOrigenId && dto.partidoOrigenId !== vocalia.partidoOrigenId)
        ? 'manual'
        : vocalia.reglaAsignacion,
      partidoOrigenId: origen?.id ?? vocalia.partidoOrigenId,
      equipoExtractorId: null,
      resultadoBolilla: null,
      equipoVocalId: null,
      directivoNombre: null,
      estado: 'pendiente',
    };

    if (dto.tipoAsignacion === 'sorteo') {
      if (!cambios.partidoOrigenId) throw new BadRequestException('Selecciona el partido que proporcionará la vocalía.');
    } else if (dto.tipoAsignacion === 'manual_equipo') {
      if (!dto.equipoVocalId) throw new BadRequestException('Selecciona el equipo responsable de la vocalía.');
      const equiposPermitidos = origen
        ? [origen.equipoLocalId, origen.equipoVisitanteId]
        : partidos.flatMap(partido => [partido.equipoLocalId, partido.equipoVisitanteId]);
      if (!equiposPermitidos.includes(dto.equipoVocalId)) throw new BadRequestException('El equipo vocal no pertenece al partido seleccionado.');
      this.validarDisponibilidadVocal(detalle, vocalia.partidoId, dto.equipoVocalId);
      cambios.equipoVocalId = dto.equipoVocalId;
      cambios.estado = 'asignada';
    } else {
      const nombre = dto.directivoNombre?.trim();
      if (!nombre) throw new BadRequestException('Escribe el nombre del directivo responsable.');
      cambios.partidoOrigenId = null;
      cambios.directivoNombre = nombre;
      cambios.estado = 'asignada';
    }

    // Se actualizan solo columnas escalares. La entidad se carga con relaciones
    // eager y un objeto relacionado anterior no debe sobrescribir los nuevos
    // identificadores del extractor o del equipo vocal.
    await this.vocalias.update(vocalia.id, cambios);
    return this.obtenerVocalias(id, usuario);
  }

  async sortearVocalia(id: number, vocaliaId: number, equipoExtractorId: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    const vocalia = await this.vocalias.findOne({ where: { id: vocaliaId, programacionId: id } });
    if (!vocalia) throw new NotFoundException('Asignación de vocalía no encontrada.');
    if (vocalia.estado === 'confirmada') throw new BadRequestException('Las vocalías confirmadas son de solo lectura.');
    if (vocalia.tipoAsignacion !== 'sorteo' || !vocalia.partidoOrigen) throw new BadRequestException('Esta vocalía no está preparada para sorteo.');
    const candidatos = [vocalia.partidoOrigen.equipoLocalId, vocalia.partidoOrigen.equipoVisitanteId];
    if (!candidatos.includes(equipoExtractorId)) throw new BadRequestException('El equipo extractor no pertenece al partido de origen.');

    const resultado: 'si' | 'no' = randomInt(2) === 0 ? 'si' : 'no';
    const equipoVocalId = resultado === 'si' ? equipoExtractorId : candidatos.find(idEquipo => idEquipo !== equipoExtractorId)!;
    this.validarDisponibilidadVocal(detalle, vocalia.partidoId, equipoVocalId);
    await this.vocalias.update(vocalia.id, {
      equipoExtractorId,
      resultadoBolilla: resultado,
      equipoVocalId,
      directivoNombre: null,
      estado: 'asignada',
    });
    return this.obtenerVocalias(id, usuario);
  }

  async liberarVocalia(id: number, vocaliaId: number, usuario: any) {
    await this.detalle(id, usuario);
    const vocalia = await this.vocalias.findOne({ where: { id: vocaliaId, programacionId: id } });
    if (!vocalia) throw new NotFoundException('Asignación de vocalía no encontrada.');
    if (vocalia.estado === 'confirmada') throw new BadRequestException('Las vocalías confirmadas son de solo lectura.');
    await this.vocalias.update(vocalia.id, {
      equipoExtractorId: null,
      resultadoBolilla: null,
      equipoVocalId: null,
      directivoNombre: null,
      estado: 'pendiente',
    });
    return this.obtenerVocalias(id, usuario);
  }

  async confirmarVocalias(id: number, usuario: any) {
    const detalle = await this.detalle(id, usuario);
    const registros = await this.vocalias.find({ where: { programacionId: id } });
    if (!registros.length || registros.length !== detalle.partidos.length) throw new BadRequestException('Prepara todas las vocalías antes de confirmar.');
    if (registros.some(item => item.estado !== 'asignada')) throw new BadRequestException('Todavía existen partidos sin vocal asignado.');
    for (const vocalia of registros) {
      if (vocalia.tipoAsignacion === 'directivo') {
        if (!vocalia.directivoNombre?.trim()) throw new BadRequestException('Falta identificar un directivo responsable.');
      } else if (!vocalia.equipoVocalId) {
        throw new BadRequestException('Falta seleccionar un equipo vocal.');
      } else {
        this.validarDisponibilidadVocal(detalle, vocalia.partidoId, vocalia.equipoVocalId);
      }
    }
    const confirmadoEn = new Date();
    await this.vocalias.update({ programacionId: id }, { estado: 'confirmada', confirmadoEn });
    return this.obtenerVocalias(id, usuario);
  }

  private validarDisponibilidadVocal(detalle: any, partidoId: number, equipoId: number): void {
    const objetivo = detalle.bolillas.find((bolilla: any) => bolilla.partidoId === partidoId);
    if (!objetivo) throw new BadRequestException('No se encontró el horario del partido.');
    const conflicto = detalle.bolillas.find((bolilla: any) =>
      bolilla.partidoId
      && String(bolilla.fecha).slice(0, 10) === String(objetivo.fecha).slice(0, 10)
      && bolilla.hora === objetivo.hora
      && (bolilla.partido?.equipoLocalId === equipoId || bolilla.partido?.equipoVisitanteId === equipoId),
    );
    if (conflicto) throw new BadRequestException('El equipo seleccionado está jugando a la misma fecha y hora.');
  }

  private normalizarSelecciones(dto: CrearProgramacionSemanalDto): Array<{ categoriaId: number | null; jornada: number }> {
    const selecciones = dto.selecciones?.length
      ? dto.selecciones.map(item => ({ categoriaId: Number(item.categoriaId), jornada: Number(item.jornada) }))
      : [{ categoriaId: dto.categoriaId ? Number(dto.categoriaId) : null, jornada: Number(dto.jornada) }];
    const claves = new Set<string>();
    const categorias = new Set<number>();
    for (const seleccion of selecciones) {
      if (!Number.isInteger(seleccion.jornada) || seleccion.jornada < 1) {
        throw new BadRequestException('Una de las jornadas seleccionadas no es válida.');
      }
      if (seleccion.categoriaId !== null && (!Number.isInteger(seleccion.categoriaId) || seleccion.categoriaId < 1)) {
        throw new BadRequestException('Una de las categorías seleccionadas no es válida.');
      }
      const clave = `${seleccion.categoriaId ?? 'todas'}:${seleccion.jornada}`;
      if (claves.has(clave)) throw new BadRequestException('No repitas una categoría y jornada dentro del mismo sorteo.');
      claves.add(clave);
      if (seleccion.categoriaId !== null) {
        if (categorias.has(seleccion.categoriaId)) throw new BadRequestException('Selecciona una sola jornada por categoría.');
        categorias.add(seleccion.categoriaId);
      }
    }
    return selecciones;
  }

  private async seleccionesDeSesion(sesion: ProgramacionSemanal): Promise<Array<{ categoriaId: number | null; jornada: number }>> {
    const guardadas = await this.selecciones.find({
      where: { programacionId: sesion.id },
      order: { id: 'ASC' },
    });
    return guardadas.length
      ? guardadas.map(item => ({ categoriaId: item.categoriaId, jornada: item.jornada }))
      : [{ categoriaId: sesion.categoriaId ?? null, jornada: sesion.jornada }];
  }

  private seleccionesSuperpuestas(
    primeras: Array<{ categoriaId: number | null; jornada: number }>,
    segundas: Array<{ categoriaId: number | null; jornada: number }>,
  ): boolean {
    return primeras.some(primera => segundas.some(segunda =>
      primera.jornada === segunda.jornada
      && (primera.categoriaId === null || segunda.categoriaId === null || primera.categoriaId === segunda.categoriaId),
    ));
  }

  private async partidosDeSelecciones(
    campeonatoId: number,
    etapa: string,
    selecciones: Array<{ categoriaId: number | null; jornada: number }>,
  ): Promise<Partido[]> {
    const query = this.partidos.createQueryBuilder('partido')
      .leftJoinAndSelect('partido.categoria', 'categoria')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.etapa = :etapa', { etapa })
      .andWhere('partido.activo = true')
      .andWhere(new Brackets(subconsulta => {
        selecciones.forEach((seleccion, indice) => {
          const condicion = seleccion.categoriaId === null
            ? `partido.jornada = :jornada${indice}`
            : `(partido.categoria_id = :categoria${indice} AND partido.jornada = :jornada${indice})`;
          const parametros: Record<string, number> = { [`jornada${indice}`]: seleccion.jornada };
          if (seleccion.categoriaId !== null) parametros[`categoria${indice}`] = seleccion.categoriaId;
          if (indice === 0) subconsulta.where(condicion, parametros);
          else subconsulta.orWhere(condicion, parametros);
        });
      }));
    return query.orderBy('partido.categoria_id', 'ASC').addOrderBy('partido.jornada', 'ASC').addOrderBy('partido.id', 'ASC').getMany();
  }

  private async partidosElegibles(
    campeonatoId: number,
    etapa: string,
    selecciones: Array<{ categoriaId: number | null; jornada: number }>,
  ): Promise<Partido[]> {
    const partidos = await this.partidosDeSelecciones(campeonatoId, etapa, selecciones);
    return partidos.filter(partido => partido.estado === 'programado' && (!partido.fechaPartido || !partido.horaPartido));
  }

  private validarLiga(ligaId: number, usuario: any): void {
    if (usuario.role === 'master') return;
    if (usuario.role !== 'directivo_liga' || Number(usuario.ligaId) !== ligaId) throw new ForbiddenException('No tienes permisos para programar partidos de esta liga.');
  }

  private esBolillaCompatible(
    solicitud: SolicitudHorario,
    bolilla: { fecha: any; hora: string; cancha: string },
    partido: Partido,
  ): boolean {
    const fechaSolicitud = String(solicitud.fechaSolicitada).slice(0, 10);
    const fechaBolilla = String(bolilla.fecha).slice(0, 10);
    const canchaRequerida = solicitud.canchaSolicitada?.trim() || partido.cancha?.trim() || '';
    return fechaSolicitud === fechaBolilla
      && solicitud.horaSolicitada === bolilla.hora
      && (!canchaRequerida || canchaRequerida.toLowerCase() === bolilla.cancha.trim().toLowerCase());
  }
}
