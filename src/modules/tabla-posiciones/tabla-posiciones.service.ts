import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partido } from '../partidos/entities/partido.entity';
import { EtapaGrupo } from '../partidos/entities/etapa-grupo.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';

export interface FilaPosicion {
  posicion: number;
  equipoId: number;
  equipoNombre: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  puntos: number;
  puntosBonificacion: number;
  puntosDescuento: number;
  tieneSancion: boolean;
}

type FilaAcumulada = Omit<FilaPosicion, 'posicion' | 'dg'>;

@Injectable()
export class TablaPosicionesService {
  constructor(
    @InjectRepository(Partido)
    private readonly partidosRepository: Repository<Partido>,
    @InjectRepository(Sancion)
    private readonly sancionesRepository: Repository<Sancion>,
    @InjectRepository(EtapaGrupo)
    private readonly gruposRepository: Repository<EtapaGrupo>,
  ) {}

  async calcular(
    campeonatoId: number,
    categoriaId: number,
    etapa: string,
    grupoId?: number,
  ): Promise<FilaPosicion[]> {
    const partidos = await this.partidosRepository
      .createQueryBuilder('partido')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoria_id = :categoriaId', { categoriaId })
      .andWhere('partido.etapa = :etapa', { etapa })
      .andWhere('partido.activo = true')
      .andWhere("partido.estado != 'cancelado'")
      .getMany();

    const mapa = new Map<number, FilaAcumulada>();
    const getOrCreate = (id: number, nombre: string): FilaAcumulada => {
      if (!mapa.has(id)) {
        mapa.set(id, {
          equipoId: id,
          equipoNombre: nombre,
          pj: 0, pg: 0, pe: 0, pp: 0,
          gf: 0, gc: 0,
          puntos: 0,
          puntosBonificacion: 0,
          puntosDescuento: 0,
          tieneSancion: false,
        });
      }
      return mapa.get(id)!;
    };

    if (grupoId !== undefined) {
      const grupo = await this.gruposRepository.findOne({
        where: { id: grupoId, activo: true },
        relations: ['etapa', 'equipos', 'equipos.equipo', 'equipos.bonificaciones'],
      });
      if (
        !grupo ||
        grupo.etapa.campeonatoId !== campeonatoId ||
        grupo.etapa.categoriaId !== categoriaId ||
        grupo.etapa.nombre !== etapa
      ) return [];

      for (const miembro of grupo.equipos.filter((item) => item.activo)) {
        const fila = getOrCreate(miembro.equipoId, miembro.equipo?.nombre ?? 'Equipo');
        const puntosIniciales = (miembro.bonificaciones ?? [])
          .filter((bonificacion) => bonificacion.activo)
          .reduce((total, bonificacion) => total + Number(bonificacion.puntos), 0);
        fila.puntosBonificacion = puntosIniciales;
        fila.puntos = puntosIniciales;
      }
    } else {
      // Permite mostrar la tabla desde el inicio, aunque todavía no haya resultados.
      for (const partido of partidos) {
        if (partido.equipoLocalId && partido.equipoLocal) {
          getOrCreate(partido.equipoLocalId, partido.equipoLocal.nombre);
        }
        if (partido.equipoVisitanteId && partido.equipoVisitante) {
          getOrCreate(partido.equipoVisitanteId, partido.equipoVisitante.nombre);
        }
      }
    }

    for (const partido of partidos) {
      if (partido.estado !== 'jugado') continue;
      if (!partido.equipoLocalId || !partido.equipoVisitanteId) continue;
      const local = mapa.get(partido.equipoLocalId);
      const visitante = mapa.get(partido.equipoVisitanteId);
      if (!local && !visitante) continue;

      const gl = partido.golesLocal ?? 0;
      const gv = partido.golesVisitante ?? 0;
      if (local) {
        local.gf += gl; local.gc += gv; local.pj++;
        if (partido.sancionado === 'local') {
          local.tieneSancion = true; local.pp++;
        } else if (partido.sancionado === 'visitante' || gl > gv) {
          local.pg++; local.puntos += 3;
        } else if (gl === gv) {
          local.pe++; local.puntos += 1;
        } else local.pp++;
        local.puntos += partido.bonificacionLocal ?? 0;
      }
      if (visitante) {
        visitante.gf += gv; visitante.gc += gl; visitante.pj++;
        if (partido.sancionado === 'visitante') {
          visitante.tieneSancion = true; visitante.pp++;
        } else if (partido.sancionado === 'local' || gv > gl) {
          visitante.pg++; visitante.puntos += 3;
        } else if (gv === gl) {
          visitante.pe++; visitante.puntos += 1;
        } else visitante.pp++;
        visitante.puntos += partido.bonificacionVisitante ?? 0;
      }
    }

    const sanciones = await this.sancionesRepository
      .createQueryBuilder('sancion')
      .innerJoin('sancion.partido', 'partido')
      .where('sancion.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('sancion.categoria_id = :categoriaId', { categoriaId })
      .andWhere('sancion.activo = true')
      .andWhere('sancion.puntos_descuento_aplicado > 0')
      .andWhere('partido.etapa = :etapa', { etapa })
      .getMany();
    for (const sancion of sanciones) {
      if (!sancion.equipoId) continue;
      const fila = mapa.get(sancion.equipoId);
      if (!fila) continue;
      const descuento = Number(sancion.puntosDescuentoAplicado);
      fila.puntos -= descuento;
      fila.puntosDescuento += descuento;
      fila.tieneSancion = true;
    }

    const tabla: FilaPosicion[] = Array.from(mapa.values()).map((fila) => ({
      ...fila,
      dg: fila.gf - fila.gc,
      posicion: 0,
    }));
    tabla.sort((a, b) =>
      b.puntos - a.puntos ||
      b.dg - a.dg ||
      b.gf - a.gf ||
      a.equipoNombre.localeCompare(b.equipoNombre),
    );
    return tabla.map((fila, indice) => ({ ...fila, posicion: indice + 1 }));
  }
}
