import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Gol } from './entities/gol.entity';
import { CreateGolDto } from './dto/create-gol.dto';
import { Partido } from '../partidos/entities/partido.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { CambiosDorsalService } from '../jugador-campeonatos/cambios-dorsal.service';
import { ConsultarHistorialGolesDto } from './dto/consultar-historial-goles.dto';

/**
 * Fila de la tabla de goleadores para un jugador.
 */
export interface FilaGoleador {
  posicion: number;
  jugadorId: number;
  jugadorNombre: string;
  equipoId: number;
  equipoNombre: string;
  total: number;     // Total de goles (incluye penales, excluye autogoles de la cuenta personal)
  penales: number;   // De los totales, cuántos fueron penal
  autogoles: number; // Goles en contra (informativos, no suman al total del jugador)
  numeroCancha: number | null; // Número de camiseta de la habilitación del jugador
}

export interface HistorialGolItem {
  id: number;
  partidoId: number;
  campeonatoId: number;
  campeonatoNombre: string;
  categoriaId: number;
  categoriaNombre: string;
  etapa: string;
  jornada: number;
  fechaPartido: Date | string | null;
  horaPartido: string | null;
  jugadorId: number;
  jugadorNombre: string;
  equipoJugadorId: number;
  equipoJugadorNombre: string;
  equipoBeneficiadoId: number;
  equipoBeneficiadoNombre: string;
  rivalId: number;
  rivalNombre: string;
  localNombre: string;
  visitanteNombre: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  minuto: number | null;
  tipo: 'normal' | 'penal' | 'autogol';
  activo: boolean;
}

@Injectable()
export class GolesService {
  constructor(
    @InjectRepository(Gol)
    private readonly golesRepository: Repository<Gol>,
    @InjectRepository(JugadorCampeonato)
    private readonly jugadorCampeonatoRepository: Repository<JugadorCampeonato>,
    @InjectRepository(Inscripcion)
    private readonly inscripcionesRepository: Repository<Inscripcion>,
    private readonly cambiosDorsalService: CambiosDorsalService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRAR GOLES DE UN PARTIDO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra los goles individuales de un partido.
   *
   * FLUJO:
   *   1. Elimina los goles previos del partido (para que sea idempotente: al
   *      editar un resultado, los goles se reemplazan y no se duplican).
   *   2. Valida que la suma de goles coincida con golesLocal + golesVisitante.
   *   3. Crea y guarda cada gol, asignando el equipo beneficiario correcto
   *      según el tipo (en autogoles, beneficia al equipo contrario).
   *
   * @param partido   - El partido al que pertenecen los goles (ya cargado)
   * @param goles     - Array de goles a registrar
   */
  async registrarGoles(partido: Partido, goles: CreateGolDto[], manager?: EntityManager): Promise<Gol[]> {
    const golesRepo = manager?.getRepository(Gol) ?? this.golesRepository;
    if (!goles || goles.length === 0) {
      // Si no se envían autores, simplemente limpiamos los previousgoles y retornamos []
      await golesRepo.delete({ partidoId: partido.id });
      return [];
    }

    // ── Validar que la suma de goles coincide con el marcador ────────────────
    // Los autogoles cuentan para el equipo rival, así que debemos separarlos
    const golesEquipoLocal = goles.filter(
      (g) =>
        (g.tipo !== 'autogol' && g.equipoDelJugadorId === partido.equipoLocalId) ||
        (g.tipo === 'autogol' && g.equipoDelJugadorId === partido.equipoVisitanteId),
    ).length;

    const golesEquipoVisitante = goles.filter(
      (g) =>
        (g.tipo !== 'autogol' && g.equipoDelJugadorId === partido.equipoVisitanteId) ||
        (g.tipo === 'autogol' && g.equipoDelJugadorId === partido.equipoLocalId),
    ).length;

    if (
      golesEquipoLocal !== partido.golesLocal ||
      golesEquipoVisitante !== partido.golesVisitante
    ) {
      throw new BadRequestException(
        `La suma de goles no coincide con el marcador. ` +
        `Marcador: ${partido.golesLocal}-${partido.golesVisitante}. ` +
        `Autores registrados: local=${golesEquipoLocal}, visitante=${golesEquipoVisitante}.`,
      );
    }

    // ── Eliminar goles previos del partido (idempotente) ─────────────────────
    await golesRepo.delete({ partidoId: partido.id });

    // ── Crear cada gol ───────────────────────────────────────────────────────
    const nuevosGoles = goles.map((g) => {
      /**
       * Equipo beneficiario:
       * - Normal/Penal → el equipo del jugador anota.
       * - Autogol      → el equipo CONTRARIO anota.
       */
      const equipoBeneficiarioId =
        g.tipo === 'autogol'
          ? (g.equipoDelJugadorId === partido.equipoLocalId
              ? partido.equipoVisitanteId
              : partido.equipoLocalId)
          : g.equipoDelJugadorId;

      return golesRepo.create({
        partidoId: partido.id,
        jugadorId: g.jugadorId,
        equipoId: equipoBeneficiarioId,
        campeonatoId: partido.campeonatoId,
        categoriaId: partido.categoriaId,
        minuto: g.minuto ?? null,
        tipo: g.tipo ?? 'normal',
        activo: true,
      });
    });

    return golesRepo.save(nuevosGoles);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TABLA DE GOLEADORES POR CATEGORÍA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calcula la tabla de goleadores para un campeonato y categoría.
   *
   * LÓGICA:
   * - Se agrupan los goles activos por jugador.
   * - Los autogoles NO cuentan en el marcador personal del jugador
   *   (aparecen informativamente en la columna 'autogoles').
   * - Se ordena: total DESC, luego nombre del jugador ASC (desempate).
   *
   * @param campeonatoId  - ID del campeonato
   * @param categoriaId   - ID de la categoría
   */
  async getGoleadoresPorCategoria(
    campeonatoId: number,
    categoriaId: number,
  ): Promise<FilaGoleador[]> {
    const goles = await this.golesRepository.find({
      where: { campeonatoId, categoriaId, activo: true },
      relations: ['jugador', 'jugador.equipo', 'equipo'],
      order: { id: 'ASC' },
    });

    // Mapa jugadorId → fila de estadísticas
    const mapa = new Map<number, Omit<FilaGoleador, 'posicion'>>();
    const equipoActualJugador = new Map<number, { id: number; nombre: string }>();
    const ultimoEquipoAnotador = new Map<number, { id: number; nombre: string }>();

    for (const gol of goles) {
      const key = gol.jugadorId;

      if (gol.jugador?.equipoId && gol.jugador.equipo) {
        equipoActualJugador.set(key, {
          id: gol.jugador.equipoId,
          nombre: gol.jugador.equipo.nombre,
        });
      }
      if (gol.tipo !== 'autogol' && gol.equipo) {
        ultimoEquipoAnotador.set(key, { id: gol.equipo.id, nombre: gol.equipo.nombre });
      }

      if (!mapa.has(key)) {
        mapa.set(key, {
          jugadorId: gol.jugadorId,
          jugadorNombre: gol.jugador?.nombre ?? `Jugador #${gol.jugadorId}`,
          equipoId: gol.equipo?.id ?? gol.equipoId,
          equipoNombre: gol.equipo?.nombre ?? `Equipo #${gol.equipoId}`,
          total: 0,
          penales: 0,
          autogoles: 0,
          numeroCancha: null, // se rellena después con la query de habilitaciones
        });
      }

      const fila = mapa.get(key)!;

      if (gol.tipo === 'autogol') {
        // Autogol: no suma al total personal pero queda registrado
        fila.autogoles++;
      } else {
        fila.total++;
        if (gol.tipo === 'penal') {
          fila.penales++;
        }
      }
    }

    // Obtener números de camiseta de las habilitaciones del campeonato/categoría
    const jugadorIds = Array.from(mapa.keys());
    const habilitaciones = jugadorIds.length > 0
      ? await this.jugadorCampeonatoRepository.find({
          where: {
            campeonatoId,
            categoriaId,
            jugadorId: In(jugadorIds),
            activo: true,
            estado: 'habilitado',
          },
          relations: ['equipo'],
          order: { id: 'ASC' },
        })
      : [];
    const habilitacionActual = new Map<number, JugadorCampeonato>();
    for (const habilitacion of habilitaciones) {
      habilitacionActual.set(habilitacion.jugadorId, habilitacion);
    }
    const numerosActuales = await this.cambiosDorsalService.resolverNumerosActuales(habilitaciones);

    const idsEquiposActuales = Array.from(new Set(
      Array.from(equipoActualJugador.values()).map((equipo) => equipo.id),
    ));
    const inscripcionesActuales = idsEquiposActuales.length > 0
      ? await this.inscripcionesRepository.find({
          where: {
            campeonatoId,
            categoriaId,
            equipoId: In(idsEquiposActuales),
            estado: 'confirmada',
            activo: true,
          },
          select: ['equipoId'],
        })
      : [];
    const equiposInscritosEnCategoria = new Set(
      inscripcionesActuales.map((inscripcion) => inscripcion.equipoId),
    );

    for (const fila of mapa.values()) {
      const habilitacion = habilitacionActual.get(fila.jugadorId);
      const equipoJugador = equipoActualJugador.get(fila.jugadorId);
      const ultimoEquipo = ultimoEquipoAnotador.get(fila.jugadorId);

      if (habilitacion?.equipo) {
        fila.equipoId = habilitacion.equipoId;
        fila.equipoNombre = habilitacion.equipo.nombre;
        fila.numeroCancha = numerosActuales.get(habilitacion.id) ?? habilitacion.numeroCancha ?? null;
      } else if (equipoJugador && equiposInscritosEnCategoria.has(equipoJugador.id)) {
        fila.equipoId = equipoJugador.id;
        fila.equipoNombre = equipoJugador.nombre;
        fila.numeroCancha = null;
      } else if (ultimoEquipo) {
        fila.equipoId = ultimoEquipo.id;
        fila.equipoNombre = ultimoEquipo.nombre;
        fila.numeroCancha = null;
      }
    }

    // Ordenar: total DESC, luego nombre ASC
    const lista = Array.from(mapa.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.jugadorNombre.localeCompare(b.jugadorNombre);
    });

    // Asignar posición y número de camiseta
    return lista.map((fila, index) => ({
      posicion: index + 1,
      ...fila,
      numeroCancha: fila.numeroCancha,
    }));
  }

  /**
   * Consulta paginada del historial individual de goles.
   *
   * El campo goles.equipo_id representa al equipo beneficiado. Para un
   * autogol se reconstruye el equipo real del jugador usando los dos equipos
   * del partido, evitando presentar el autogol como si perteneciera al rival.
   */
  async getHistorial(filtros: ConsultarHistorialGolesDto, usuario: any) {
    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    if (usuario.role !== 'master' && !usuario.ligaId) {
      throw new ForbiddenException('El usuario no tiene una liga asociada.');
    }

    const base = this.golesRepository
      .createQueryBuilder('gol')
      .leftJoinAndSelect('gol.jugador', 'jugador')
      .leftJoinAndSelect('gol.equipo', 'equipoBeneficiado')
      .leftJoinAndSelect('gol.categoria', 'categoria')
      .leftJoinAndSelect('gol.partido', 'partido')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .leftJoinAndSelect('partido.campeonato', 'campeonato')
      .where('gol.campeonatoId = :campeonatoId', {
        campeonatoId: filtros.campeonatoId,
      });

    if (filtros.categoriaId) {
      base.andWhere('gol.categoriaId = :categoriaId', {
        categoriaId: filtros.categoriaId,
      });
    }
    if (usuario.role !== 'master') {
      base.andWhere('campeonato.ligaId = :ligaUsuarioId', {
        ligaUsuarioId: usuario.ligaId,
      });
    }

    // Las opciones no dependen de los filtros avanzados para que un filtro
    // seleccionado nunca desaparezca al aplicar la consulta.
    const registrosParaOpciones = await base.clone().orderBy('gol.id', 'ASC').getMany();

    const consulta = base.clone();
    if (filtros.etapa) {
      consulta.andWhere('partido.etapa = :etapa', { etapa: filtros.etapa });
    }
    if (filtros.jornada) {
      consulta.andWhere('partido.jornada = :jornada', { jornada: filtros.jornada });
    }
    if (filtros.jugadorId) {
      consulta.andWhere('gol.jugadorId = :jugadorId', { jugadorId: filtros.jugadorId });
    }
    if (filtros.tipo) {
      consulta.andWhere('gol.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('partido.fechaPartido >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde,
      });
    }
    if (filtros.fechaHasta) {
      consulta.andWhere('partido.fechaPartido <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta,
      });
    }
    if (filtros.equipoId) {
      consulta.andWhere(
        `(
          (gol.tipo <> 'autogol' AND gol.equipoId = :equipoId)
          OR
          (gol.tipo = 'autogol' AND (
            (gol.equipoId = partido.equipoLocalId AND partido.equipoVisitanteId = :equipoId)
            OR
            (gol.equipoId = partido.equipoVisitanteId AND partido.equipoLocalId = :equipoId)
          ))
        )`,
        { equipoId: filtros.equipoId },
      );
    }

    const estado = filtros.estado ?? 'activos';
    if (estado === 'activos') consulta.andWhere('gol.activo = true');
    if (estado === 'inactivos') consulta.andWhere('gol.activo = false');

    consulta
      .orderBy('partido.fechaPartido', 'DESC', 'NULLS LAST')
      .addOrderBy('partido.jornada', 'DESC')
      .addOrderBy('gol.minuto', 'ASC', 'NULLS LAST')
      .addOrderBy('gol.id', 'DESC');

    const todosFiltrados = await consulta.clone().getMany();
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 20;
    const registrosPagina = await consulta
      .clone()
      .skip((pagina - 1) * limite)
      .take(limite)
      .getMany();

    const items = registrosPagina.map((gol) => this.mapearHistorialGol(gol));
    const total = todosFiltrados.length;

    return {
      items,
      total,
      pagina,
      limite,
      totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
      resumen: {
        registros: total,
        golesJugador: todosFiltrados.filter((gol) => gol.tipo !== 'autogol').length,
        penales: todosFiltrados.filter((gol) => gol.tipo === 'penal').length,
        autogoles: todosFiltrados.filter((gol) => gol.tipo === 'autogol').length,
      },
      opciones: this.construirOpcionesHistorial(registrosParaOpciones),
    };
  }

  private mapearHistorialGol(gol: Gol): HistorialGolItem {
    const partido = gol.partido;
    const equipoJugador = this.resolverEquipoJugador(gol);
    const rival = equipoJugador?.id === partido?.equipoLocalId
      ? partido?.equipoVisitante
      : partido?.equipoLocal;

    return {
      id: gol.id,
      partidoId: gol.partidoId,
      campeonatoId: gol.campeonatoId,
      campeonatoNombre: partido?.campeonato?.nombre ?? `Campeonato #${gol.campeonatoId}`,
      categoriaId: gol.categoriaId,
      categoriaNombre: gol.categoria?.nombre ?? partido?.categoria?.nombre ?? `Categoria #${gol.categoriaId}`,
      etapa: partido?.etapa ?? '',
      jornada: partido?.jornada ?? 0,
      fechaPartido: partido?.fechaPartido ?? null,
      horaPartido: partido?.horaPartido ?? null,
      jugadorId: gol.jugadorId,
      jugadorNombre: gol.jugador?.nombre ?? `Jugador #${gol.jugadorId}`,
      equipoJugadorId: equipoJugador?.id ?? 0,
      equipoJugadorNombre: equipoJugador?.nombre ?? 'Equipo no identificado',
      equipoBeneficiadoId: gol.equipoId,
      equipoBeneficiadoNombre: gol.equipo?.nombre ?? `Equipo #${gol.equipoId}`,
      rivalId: rival?.id ?? 0,
      rivalNombre: rival?.nombre ?? 'Rival no identificado',
      localNombre: partido?.equipoLocal?.nombre ?? '',
      visitanteNombre: partido?.equipoVisitante?.nombre ?? '',
      golesLocal: partido?.golesLocal ?? null,
      golesVisitante: partido?.golesVisitante ?? null,
      minuto: gol.minuto,
      tipo: gol.tipo,
      activo: gol.activo,
    };
  }

  private resolverEquipoJugador(gol: Gol): { id: number; nombre: string } | null {
    if (gol.tipo !== 'autogol') {
      return gol.equipo ? { id: gol.equipo.id, nombre: gol.equipo.nombre } : null;
    }

    const partido = gol.partido;
    if (!partido) return null;
    if (gol.equipoId === partido.equipoLocalId && partido.equipoVisitante) {
      return { id: partido.equipoVisitante.id, nombre: partido.equipoVisitante.nombre };
    }
    if (gol.equipoId === partido.equipoVisitanteId && partido.equipoLocal) {
      return { id: partido.equipoLocal.id, nombre: partido.equipoLocal.nombre };
    }
    return null;
  }

  private construirOpcionesHistorial(goles: Gol[]) {
    const etapas = new Set<string>();
    const jornadas = new Set<number>();
    const jornadasPorEtapa = new Map<string, Set<number>>();
    const equipos = new Map<number, string>();
    const jugadores = new Map<number, { nombre: string; equipoIds: Set<number> }>();

    for (const gol of goles) {
      if (gol.partido?.etapa) etapas.add(gol.partido.etapa);
      if (gol.partido?.jornada) {
        jornadas.add(gol.partido.jornada);
        if (gol.partido.etapa) {
          if (!jornadasPorEtapa.has(gol.partido.etapa)) {
            jornadasPorEtapa.set(gol.partido.etapa, new Set<number>());
          }
          jornadasPorEtapa.get(gol.partido.etapa)!.add(gol.partido.jornada);
        }
      }
      const equipoJugador = this.resolverEquipoJugador(gol);
      if (equipoJugador) equipos.set(equipoJugador.id, equipoJugador.nombre);
      if (gol.jugador) {
        if (!jugadores.has(gol.jugadorId)) {
          jugadores.set(gol.jugadorId, {
            nombre: gol.jugador.nombre,
            equipoIds: new Set<number>(),
          });
        }
        if (equipoJugador) jugadores.get(gol.jugadorId)!.equipoIds.add(equipoJugador.id);
      }
    }

    return {
      etapas: Array.from(etapas).sort((a, b) => a.localeCompare(b)),
      jornadas: Array.from(jornadas).sort((a, b) => a - b),
      jornadasPorEtapa: Object.fromEntries(
        Array.from(jornadasPorEtapa, ([etapa, valores]) => [
          etapa,
          Array.from(valores).sort((a, b) => a - b),
        ]),
      ),
      equipos: Array.from(equipos, ([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      jugadores: Array.from(jugadores, ([id, datos]) => ({
        id,
        nombre: datos.nombre,
        equipoIds: Array.from(datos.equipoIds).sort((a, b) => a - b),
      }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OBTENER GOLES DE UN PARTIDO (para mostrar en detalle de resultado)
  // ─────────────────────────────────────────────────────────────────────────

  async getGolesPorPartido(partidoId: number): Promise<Gol[]> {
    return this.golesRepository.find({
      where: { partidoId, activo: true },
      relations: ['jugador', 'equipo'],
      order: { minuto: 'ASC' },
    });
  }
}
