import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Gol } from './entities/gol.entity';
import { CreateGolDto } from './dto/create-gol.dto';
import { Partido } from '../partidos/entities/partido.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';

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

@Injectable()
export class GolesService {
  constructor(
    @InjectRepository(Gol)
    private readonly golesRepository: Repository<Gol>,
    @InjectRepository(JugadorCampeonato)
    private readonly jugadorCampeonatoRepository: Repository<JugadorCampeonato>,
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
  async registrarGoles(partido: Partido, goles: CreateGolDto[]): Promise<Gol[]> {
    if (!goles || goles.length === 0) {
      // Si no se envían autores, simplemente limpiamos los previousgoles y retornamos []
      await this.golesRepository.delete({ partidoId: partido.id });
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
    await this.golesRepository.delete({ partidoId: partido.id });

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

      return this.golesRepository.create({
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

    return this.golesRepository.save(nuevosGoles);
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
      relations: ['jugador', 'equipo'],
    });

    // Mapa jugadorId → fila de estadísticas
    const mapa = new Map<number, Omit<FilaGoleador, 'posicion'>>();

    for (const gol of goles) {
      const key = gol.jugadorId;

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
          where: { campeonatoId, jugadorId: In(jugadorIds) },
          select: ['jugadorId', 'numeroCancha'],
          order: { id: 'ASC' },
        })
      : [];
    const numMap = new Map<number, number | null>(
      habilitaciones.map((h) => [h.jugadorId, h.numeroCancha ?? null]),
    );

    // Ordenar: total DESC, luego nombre ASC
    const lista = Array.from(mapa.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.jugadorNombre.localeCompare(b.jugadorNombre);
    });

    // Asignar posición y número de camiseta
    return lista.map((fila, index) => ({
      posicion: index + 1,
      ...fila,
      numeroCancha: numMap.get(fila.jugadorId) ?? null,
    }));
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
