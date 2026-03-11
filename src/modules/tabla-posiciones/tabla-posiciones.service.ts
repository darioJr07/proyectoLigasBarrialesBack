import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partido } from '../partidos/entities/partido.entity';

/**
 * Fila de la tabla de posiciones para un equipo.
 */
export interface FilaPosicion {
  posicion: number;
  equipoId: number;
  equipoNombre: string;
  pj: number;   // Partidos Jugados
  pg: number;   // Partidos Ganados
  pe: number;   // Partidos Empatados
  pp: number;   // Partidos Perdidos
  gf: number;   // Goles a Favor
  gc: number;   // Goles en Contra
  dg: number;   // Diferencia de Goles (gf - gc)
  puntos: number; // Puntos totales (incluye bonificaciones)
  tieneSancion: boolean; // true si el equipo fue sancionado al menos 1 vez en la etapa
}

@Injectable()
export class TablaPosicionesService {
  constructor(
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
  ) {}

  /**
   * Calcula la tabla de posiciones para un campeonato, categoría y etapa.
   *
   * LÓGICA DE PUNTOS:
   * - Victoria: 3 pts | Empate: 1 pt | Derrota: 0 pts
   * - Sanción administrativa 'local': local recibe 0 pts, visitante recibe 3 pts
   *   (independientemente del marcador; los goles no se tocan)
   * - Sanción administrativa 'visitante': visitante recibe 0 pts, local recibe 3 pts
   * - Bonificaciones: se suman ENCIMA del resultado (para liguillas y primera etapa)
   * - Partidos con equipos BYE (null) se omiten
   *
   * CRITERIOS DE DESEMPATE (en orden):
   * 1. Puntos
   * 2. Diferencia de goles
   * 3. Goles a favor
   * 4. Orden alfabético del nombre (como último criterio determinístico)
   */
  async calcular(
    campeonatoId: number,
    categoriaId: number,
    etapa: string,
  ): Promise<FilaPosicion[]> {
    // Traemos todos los partidos jugados de esta categoría/etapa con sus equipos
    const partidos = await this.partidosRepository.find({
      where: { campeonatoId, categoriaId, etapa, estado: 'jugado', activo: true },
      relations: ['equipoLocal', 'equipoVisitante'],
    });

    // Mapa equipoId → fila de estadísticas
    const mapa = new Map<number, Omit<FilaPosicion, 'posicion' | 'dg'>>();
    // Set de equipos sancionados en esta etapa
    const equiposSancionados = new Set<number>();

    // Helper: obtiene o crea la fila de un equipo
    const getOrCreate = (id: number, nombre: string) => {
      if (!mapa.has(id)) {
        mapa.set(id, {
          equipoId: id,
          equipoNombre: nombre,
          pj: 0, pg: 0, pe: 0, pp: 0,
          gf: 0, gc: 0,
          puntos: 0,
          tieneSancion: false,
        });
      }
      return mapa.get(id)!;
    };

    for (const p of partidos) {
      // Omitir partidos BYE (algún equipo es null)
      if (!p.equipoLocalId || !p.equipoVisitanteId) continue;
      if (!p.equipoLocal || !p.equipoVisitante) continue;

      const local = getOrCreate(p.equipoLocalId, p.equipoLocal.nombre);
      const visitante = getOrCreate(p.equipoVisitanteId, p.equipoVisitante.nombre);

      const gl = p.golesLocal ?? 0;        // goles del local
      const gv = p.golesVisitante ?? 0;    // goles del visitante
      const bonusL = p.bonificacionLocal ?? 0;
      const bonusV = p.bonificacionVisitante ?? 0;

      // ── Goles siempre reflejan lo ocurrido en el campo ──
      local.gf += gl;    local.gc += gv;
      visitante.gf += gv; visitante.gc += gl;
      local.pj++;        visitante.pj++;

      // ── Resultado administrativo (considera sanción) ──
      if (p.sancionado === 'local') {
        // El local fue sancionado → pierde administrativamente
        equiposSancionados.add(p.equipoLocalId);
        local.tieneSancion = true;
        local.pp++;
        visitante.pg++;
        local.puntos += 0;
        visitante.puntos += 3;
      } else if (p.sancionado === 'visitante') {
        // El visitante fue sancionado → pierde administrativamente
        equiposSancionados.add(p.equipoVisitanteId);
        visitante.tieneSancion = true;
        local.pg++;
        visitante.pp++;
        local.puntos += 3;
        visitante.puntos += 0;
      } else {
        // Resultado normal del campo
        if (gl > gv) {
          local.pg++;    visitante.pp++;
          local.puntos += 3;
        } else if (gl === gv) {
          local.pe++;    visitante.pe++;
          local.puntos += 1;
          visitante.puntos += 1;
        } else {
          local.pp++;    visitante.pg++;
          visitante.puntos += 3;
        }
      }

      // ── Bonificaciones se suman encima del resultado ──
      local.puntos += bonusL;
      visitante.puntos += bonusV;
    }

    // Calcular diferencia de goles y ordenar
    const tabla: FilaPosicion[] = Array.from(mapa.values()).map((f, i) => ({
      ...f,
      dg: f.gf - f.gc,
      posicion: 0, // se asigna abajo
    }));

    // Ordenar: 1° Puntos · 2° DG · 3° GF · 4° Nombre alfabético
    tabla.sort(
      (a, b) =>
        b.puntos - a.puntos ||
        b.dg - a.dg ||
        b.gf - a.gf ||
        a.equipoNombre.localeCompare(b.equipoNombre),
    );

    // Asignar posición final
    return tabla.map((f, i) => ({ ...f, posicion: i + 1 }));
  }
}
