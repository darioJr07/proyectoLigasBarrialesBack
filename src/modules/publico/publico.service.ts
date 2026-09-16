import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Liga } from '../ligas/entities/liga.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Equipo } from '../equipos/entities/equipo.entity';
import { TablaPosicionesService } from '../tabla-posiciones/tabla-posiciones.service';
import { Partido } from '../partidos/entities/partido.entity';
import { GolesService } from '../goles/goles.service';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { ReglaSancion } from '../sanciones/entities/regla-sancion.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';

/**
 * Consultas expuestas al portal público.
 *
 * Este servicio no reutiliza los endpoints administrativos: devuelve únicamente
 * campos deportivos permitidos y nunca realiza escrituras.
 */
@Injectable()
export class PublicoService {
  constructor(
    @InjectRepository(Liga)
    private readonly ligasRepository: Repository<Liga>,
    @InjectRepository(Campeonato)
    private readonly campeonatosRepository: Repository<Campeonato>,
    @InjectRepository(Categoria)
    private readonly categoriasRepository: Repository<Categoria>,
    @InjectRepository(Equipo)
    private readonly equiposRepository: Repository<Equipo>,
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
    @InjectRepository(Sancion)
    private readonly sancionesRepository: Repository<Sancion>,
    @InjectRepository(ReglaSancion)
    private readonly reglasSancionRepository: Repository<ReglaSancion>,
    @InjectRepository(Jugador)
    private readonly jugadoresRepository: Repository<Jugador>,
    private readonly tablaPosicionesService: TablaPosicionesService,
    private readonly golesService: GolesService,
  ) {}

  async listarLigas() {
    const ligas = await this.ligasRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });

    return ligas.map(liga => ({
      id: liga.id,
      nombre: liga.nombre,
      ubicacion: liga.ubicacion,
      imagen: liga.imagen,
    }));
  }

  async listarCampeonatosEnCurso(ligaId: number) {
    await this.buscarLigaPublica(ligaId);

    const campeonatos = await this.campeonatosRepository.find({
      where: { ligaId, activo: true, estado: 'en_curso' },
      order: { fechaInicio: 'DESC', nombre: 'ASC' },
    });

    return campeonatos.map(campeonato => ({
      id: campeonato.id,
      nombre: campeonato.nombre,
      fechaInicio: campeonato.fechaInicio,
      fechaFin: campeonato.fechaFin,
      estado: campeonato.estado,
    }));
  }

  async listarCategorias(campeonatoId: number) {
    await this.buscarCampeonatoPublico(campeonatoId);
    const categorias = await this.categoriasRepository.find({
      where: { campeonatoId, activo: true },
      order: { orden: 'ASC', nombre: 'ASC' },
    });

    return categorias.map(categoria => ({
      id: categoria.id,
      nombre: categoria.nombre,
      orden: categoria.orden,
    }));
  }

  /** Partidos públicos prioritarios: en juego, jornada actual y próximos pendientes. */
  async listarPartidosDestacados(ligaId: number) {
    await this.buscarLigaPublica(ligaId);
    const partidos = await this.partidosRepository
      .createQueryBuilder('partido')
      .leftJoinAndSelect('partido.campeonato', 'campeonato')
      .leftJoinAndSelect('partido.categoria', 'categoria')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('campeonato.liga_id = :ligaId', { ligaId })
      .andWhere("campeonato.estado = 'en_curso'")
      .andWhere('partido.activo = true')
      .andWhere("partido.estado IN ('programado', 'en_juego')")
      .getMany();

    const jornadaActual = new Map<string, number>();
    for (const partido of partidos) {
      const clave = `${partido.campeonatoId}-${partido.categoriaId}-${partido.etapa}`;
      const actual = jornadaActual.get(clave);
      if (actual === undefined || partido.jornada < actual) jornadaActual.set(clave, partido.jornada);
    }

    return partidos
      .sort((a, b) => {
        const prioridadEstado = (partido: Partido) => partido.estado === 'en_juego' ? 0 : 1;
        const porEstado = prioridadEstado(a) - prioridadEstado(b);
        if (porEstado) return porEstado;
        const claveA = `${a.campeonatoId}-${a.categoriaId}-${a.etapa}`;
        const claveB = `${b.campeonatoId}-${b.categoriaId}-${b.etapa}`;
        const porJornadaActual = Number(a.jornada !== jornadaActual.get(claveA)) - Number(b.jornada !== jornadaActual.get(claveB));
        if (porJornadaActual) return porJornadaActual;
        const fechaA = `${a.fechaPartido ?? '9999-12-31'}T${a.horaPartido ?? '23:59'}`;
        const fechaB = `${b.fechaPartido ?? '9999-12-31'}T${b.horaPartido ?? '23:59'}`;
        return fechaA.localeCompare(fechaB);
      })
      .map(partido => ({
        id: partido.id, jornada: partido.jornada, fechaPartido: partido.fechaPartido, horaPartido: partido.horaPartido,
        estado: partido.estado, categoriaNombre: partido.categoria?.nombre ?? '', campeonatoNombre: partido.campeonato?.nombre ?? '',
        equipoLocal: partido.equipoLocal ? { id: partido.equipoLocal.id, nombre: partido.equipoLocal.nombre, imagen: partido.equipoLocal.imagen } : null,
        equipoVisitante: partido.equipoVisitante ? { id: partido.equipoVisitante.id, nombre: partido.equipoVisitante.nombre, imagen: partido.equipoVisitante.imagen } : null,
      }));
  }

  async consultarPosiciones(campeonatoId: number, categoriaId: number, etapa: string) {
    await this.buscarCategoriaPublica(campeonatoId, categoriaId);

    const tabla = await this.tablaPosicionesService.calcular(campeonatoId, categoriaId, etapa);
    const equipos = await this.equiposRepository.find({
      where: { id: In(tabla.map(fila => fila.equipoId)), activo: true },
    });
    const imagenes = new Map(equipos.map(equipo => [equipo.id, equipo.imagen]));

    return tabla.map(fila => ({
      ...fila,
      equipoImagen: imagenes.get(fila.equipoId) ?? null,
    }));
  }

  async listarEtapas(campeonatoId: number, categoriaId: number) {
    await this.buscarCategoriaPublica(campeonatoId, categoriaId);
    const filas = await this.partidosRepository
      .createQueryBuilder('partido')
      .select('partido.etapa', 'etapa')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoria_id = :categoriaId', { categoriaId })
      .andWhere('partido.activo = true')
      .andWhere("partido.estado != 'cancelado'")
      .distinct(true)
      .orderBy('partido.etapa', 'ASC')
      .getRawMany<{ etapa: string }>();
    return filas.map(fila => fila.etapa);
  }

  async listarJornadas(campeonatoId: number, categoriaId: number, etapa: string) {
    await this.buscarCategoriaPublica(campeonatoId, categoriaId);
    const filas = await this.partidosRepository
      .createQueryBuilder('partido')
      .select('partido.jornada', 'jornada')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoria_id = :categoriaId', { categoriaId })
      .andWhere('partido.etapa = :etapa', { etapa })
      .andWhere('partido.activo = true')
      .andWhere("partido.estado != 'cancelado'")
      .distinct(true)
      .orderBy('partido.jornada', 'ASC')
      .getRawMany<{ jornada: number }>();
    return filas.map(fila => Number(fila.jornada));
  }

  async listarPartidos(campeonatoId: number, categoriaId: number, etapa: string, jornada?: number) {
    await this.buscarCategoriaPublica(campeonatoId, categoriaId);
    const consulta = this.partidosRepository
      .createQueryBuilder('partido')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoria_id = :categoriaId', { categoriaId })
      .andWhere('partido.etapa = :etapa', { etapa })
      .andWhere('partido.activo = true')
      .andWhere("partido.estado != 'cancelado'")
      .orderBy('partido.jornada', 'ASC')
      .addOrderBy('partido.fecha_partido', 'ASC')
      .addOrderBy('partido.hora_partido', 'ASC');
    if (jornada !== undefined) consulta.andWhere('partido.jornada = :jornada', { jornada });

    const partidos = await consulta.getMany();
    return partidos.map(partido => ({
      id: partido.id,
      jornada: partido.jornada,
      fechaPartido: partido.fechaPartido,
      horaPartido: partido.horaPartido,
      cancha: partido.cancha,
      estado: partido.estado,
      golesLocal: partido.golesLocal,
      golesVisitante: partido.golesVisitante,
      equipoLocal: partido.equipoLocal ? { id: partido.equipoLocal.id, nombre: partido.equipoLocal.nombre, imagen: partido.equipoLocal.imagen } : null,
      equipoVisitante: partido.equipoVisitante ? { id: partido.equipoVisitante.id, nombre: partido.equipoVisitante.nombre, imagen: partido.equipoVisitante.imagen } : null,
    }));
  }

  async listarGoleadores(campeonatoId: number, categoriaId: number) {
    await this.buscarCategoriaPublica(campeonatoId, categoriaId);
    const goleadores = await this.golesService.getGoleadoresPorCategoria(campeonatoId, categoriaId);
    const equipos = await this.equiposRepository.find({
      where: { id: In(goleadores.map(goleador => goleador.equipoId)), activo: true },
    });
    const jugadores = await this.jugadoresRepository.find({
      where: { id: In(goleadores.map(goleador => goleador.jugadorId)), activo: true },
    });
    const imagenes = new Map(equipos.map(equipo => [equipo.id, equipo.imagen]));
    const fotosJugadores = new Map(jugadores.map(jugador => [jugador.id, jugador.imagen]));

    return goleadores.map(goleador => ({
      posicion: goleador.posicion,
      jugadorNombre: goleador.jugadorNombre,
      jugadorImagen: fotosJugadores.get(goleador.jugadorId) ?? null,
      numeroCancha: goleador.numeroCancha,
      equipoNombre: goleador.equipoNombre,
      equipoImagen: imagenes.get(goleador.equipoId) ?? null,
      total: goleador.total,
    }));
  }

  async listarSancionesActivas(campeonatoId: number) {
    await this.buscarCampeonatoPublico(campeonatoId);
    const sanciones = await this.sancionesRepository
      .createQueryBuilder('sancion')
      .leftJoinAndSelect('sancion.tipoSancion', 'tipo')
      .leftJoinAndSelect('sancion.reglaSancion', 'regla')
      .leftJoinAndSelect('sancion.jugador', 'jugador')
      .leftJoinAndSelect('sancion.equipo', 'equipo')
      .where('sancion.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('sancion.activo = true')
      .andWhere(
        '((sancion.fecha_fin_suspension IS NOT NULL AND sancion.fecha_fin_suspension >= CURRENT_DATE) OR ' +
        '(sancion.fecha_fin_suspension IS NULL AND sancion.suspension_activa = true) OR ' +
        "(tipo.\"aplicaA\" IN ('equipo', 'barra', 'directivo') AND sancion.fecha_fin_suspension IS NULL))",
      )
      .orderBy('sancion.fecha_sancion', 'DESC')
      .addOrderBy('sancion.creado_en', 'DESC')
      .getMany();

    const reglasPorTipo = new Map<number, ReglaSancion>();
    if (sanciones.length) {
      const reglas = await this.reglasSancionRepository
        .createQueryBuilder('regla')
        .where('regla.liga_id = :ligaId', { ligaId: sanciones[0].ligaId })
        .andWhere('regla.activo = true')
        .andWhere('regla.acumulacion_activa = true')
        .andWhere('regla.acumulacion_cantidad IS NOT NULL')
        .andWhere('(regla.campeonato_id = :campeonatoId OR regla.campeonato_id IS NULL)', { campeonatoId })
        .orderBy('regla.campeonato_id', 'DESC')
        .getMany();
      for (const regla of reglas) if (!reglasPorTipo.has(regla.tipoSancionId)) reglasPorTipo.set(regla.tipoSancionId, regla);
    }

    const totalPorEquipoTipo = new Map<string, number>();
    for (const sancion of sanciones) {
      if (sancion.tipoSancion?.aplicaA === 'jugador' || !sancion.equipoId) continue;
      const clave = `${sancion.equipoId}-${sancion.tipoSancionId}`;
      totalPorEquipoTipo.set(clave, (totalPorEquipoTipo.get(clave) ?? 0) + 1);
    }

    return sanciones.map(sancion => {
      const esJugador = sancion.tipoSancion?.aplicaA === 'jugador';
      const pendientes = Math.max(0, (sancion.partidosSuspension ?? 0) - (sancion.partidosCumplidos ?? 0));
      const regla = sancion.reglaSancion?.acumulacionActiva && sancion.reglaSancion.acumulacionCantidad
        ? sancion.reglaSancion
        : reglasPorTipo.get(sancion.tipoSancionId);
      const contadorLimite = !esJugador && regla?.acumulacionCantidad ? regla.acumulacionCantidad : null;
      const contadorActual = contadorLimite && sancion.equipoId
        ? totalPorEquipoTipo.get(`${sancion.equipoId}-${sancion.tipoSancionId}`) ?? 0
        : null;
      return {
        id: sancion.id,
        destino: sancion.tipoSancion?.aplicaA ?? 'equipo',
        sancionado: esJugador ? sancion.jugador?.nombre ?? 'Jugador' : sancion.equipo?.nombre ?? 'Sanción general',
        jugadorImagen: esJugador ? sancion.jugador?.imagen ?? null : null,
        equipo: sancion.equipo ? { id: sancion.equipo.id, nombre: sancion.equipo.nombre, imagen: sancion.equipo.imagen } : null,
        tipo: sancion.tipoSancion?.nombre ?? 'Sanción',
        puntosDescuentoAplicado: sancion.puntosDescuentoAplicado ?? 0,
        partidosPendientes: esJugador && !sancion.fechaFinSuspension ? pendientes : null,
        fechaFinSuspension: sancion.fechaFinSuspension ?? null,
        contadorActual,
        contadorLimite,
      };
    });
  }

  private async buscarLigaPublica(ligaId: number): Promise<Liga> {
    const liga = await this.ligasRepository.findOne({ where: { id: ligaId, activo: true } });
    if (!liga) throw new NotFoundException('Liga pública no encontrada.');
    return liga;
  }

  private async buscarCampeonatoPublico(campeonatoId: number): Promise<Campeonato> {
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id: campeonatoId, activo: true, estado: 'en_curso' },
    });
    if (!campeonato) throw new NotFoundException('Campeonato público no encontrado.');
    await this.buscarLigaPublica(campeonato.ligaId);
    return campeonato;
  }

  private async buscarCategoriaPublica(campeonatoId: number, categoriaId: number): Promise<Categoria> {
    await this.buscarCampeonatoPublico(campeonatoId);
    const categoria = await this.categoriasRepository.findOne({
      where: { id: categoriaId, campeonatoId, activo: true },
    });
    if (!categoria) throw new NotFoundException('Categoría pública no encontrada.');
    return categoria;
  }
}
