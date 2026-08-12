import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { Sancion } from '../sanciones/entities/sancion.entity';
import { ActaIncidencia } from '../acta-partido/entities/acta-incidencia.entity';
import { CobroPartido } from '../tesoreria/entities/cobro-partido.entity';

@Injectable()
export class DashboardService {
  constructor(@InjectRepository(Campeonato) private campeonatos: Repository<Campeonato>, @InjectRepository(Partido) private partidos: Repository<Partido>, @InjectRepository(Sancion) private sanciones: Repository<Sancion>, @InjectRepository(ActaIncidencia) private incidencias: Repository<ActaIncidencia>, @InjectRepository(CobroPartido) private cobros: Repository<CobroPartido>) {}
  async resumen(usuario: any) {
    const where: any = { estado: 'en_curso', activo: true };
    if (usuario.role !== 'master') where.ligaId = usuario.ligaId;
    const campeonato = await this.campeonatos.findOne({ where, order: { id: 'DESC' } });
    if (!campeonato) return { campeonato: null, partidosPendientes: 0, sancionesActivas: 0, incidenciasPendientes: 0, cobrosPendientes: 0 };
    const [partidosPendientes, sancionesActivas, incidenciasPendientes, cobrosPendientes] = await Promise.all([
      this.partidos.count({ where: { campeonatoId: campeonato.id, estado: 'programado', activo: true } }),
      this.sanciones.count({ where: { campeonatoId: campeonato.id, suspensionActiva: true, activo: true } }),
      this.incidencias.count({ where: { campeonatoId: campeonato.id, estadoResolucion: 'pendiente', activo: true } }),
      ['master', 'directivo_liga', 'tesoreria'].includes(usuario.role) ? this.cobros.count({ where: { campeonatoId: campeonato.id, estado: 'pendiente' } }) : 0,
    ]);
    return { campeonato: { id: campeonato.id, nombre: campeonato.nombre }, partidosPendientes, sancionesActivas, incidenciasPendientes, cobrosPendientes };
  }
}
