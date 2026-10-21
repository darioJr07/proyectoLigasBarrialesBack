import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Partido } from '../partidos/entities/partido.entity';
import { EtapaCompetencia } from '../partidos/entities/etapa-competencia.entity';
import { JugadorCampeonato } from './entities/jugador-campeonato.entity';
import { CambioDorsalEtapa } from './entities/cambio-dorsal-etapa.entity';
import { RegistrarCambioDorsalDto } from './dto/registrar-cambio-dorsal.dto';

@Injectable()
export class CambiosDorsalService {
  static readonly JORNADA_LIMITE = 3;

  constructor(
    @InjectRepository(CambioDorsalEtapa)
    private readonly cambioRepo: Repository<CambioDorsalEtapa>,
    @InjectRepository(JugadorCampeonato)
    private readonly jugadorCampeonatoRepo: Repository<JugadorCampeonato>,
    @InjectRepository(EtapaCompetencia)
    private readonly etapaRepo: Repository<EtapaCompetencia>,
    @InjectRepository(Partido)
    private readonly partidoRepo: Repository<Partido>,
  ) {}

  async obtenerOpciones(jugadorCampeonatoId: number, usuario: any) {
    const habilitacion = await this.obtenerHabilitacionAutorizada(jugadorCampeonatoId, usuario, false);
    const etapas = await this.obtenerEtapasDisponibles(habilitacion);
    const partidos = await this.partidosEquipo(habilitacion);
    const cambios = await this.cambioRepo.find({
      where: { jugadorCampeonatoId, activo: true },
      order: { creadoEn: 'DESC' },
    });

    return {
      jornadaLimite: CambiosDorsalService.JORNADA_LIMITE,
      habilitacion: {
        id: habilitacion.id,
        numeroCancha: habilitacion.numeroCancha,
        jugador: habilitacion.jugador,
        equipo: habilitacion.equipo,
        campeonato: habilitacion.campeonato,
        categoria: habilitacion.categoria,
      },
      etapas: etapas.map(etapa => {
        const jornadasJugadas = partidos
          .filter(partido => partido.etapa === etapa.nombre && partido.estado === 'jugado')
          .map(partido => partido.jornada);
        const ultimaJornadaJugada = jornadasJugadas.length ? Math.max(...jornadasJugadas) : 0;
        const cambioActivo = cambios.find(cambio => cambio.etapaCompetenciaId === etapa.id) ?? null;
        return {
          id: etapa.id,
          nombre: etapa.nombre,
          orden: etapa.orden,
          estado: etapa.estado,
          ultimaJornadaJugada,
          proximaJornadaSugerida: ultimaJornadaJugada + 1,
          puedeCambiar: etapa.estado !== 'finalizada'
            && ultimaJornadaJugada < CambiosDorsalService.JORNADA_LIMITE
            && !cambioActivo,
          cambioActivo,
        };
      }),
    };
  }

  async registrar(
    jugadorCampeonatoId: number,
    dto: RegistrarCambioDorsalDto,
    usuario: any,
  ): Promise<CambioDorsalEtapa> {
    const habilitacion = await this.obtenerHabilitacionAutorizada(jugadorCampeonatoId, usuario, true);
    const etapa = await this.etapaRepo.findOne({
      where: {
        id: dto.etapaCompetenciaId,
        campeonatoId: habilitacion.campeonatoId,
        categoriaId: habilitacion.categoriaId,
        activo: true,
      },
    });
    if (!etapa) throw new BadRequestException('La etapa no corresponde a esta habilitación');
    if (etapa.estado === 'finalizada') {
      throw new BadRequestException('No se puede cambiar el dorsal en una etapa finalizada');
    }
    if (dto.numeroCancha === habilitacion.numeroCancha) {
      throw new BadRequestException('El nuevo dorsal debe ser diferente al dorsal original');
    }

    const partidos = await this.partidosEquipo(habilitacion);
    const jugadosEtapa = partidos.filter(
      partido => partido.etapa === etapa.nombre && partido.estado === 'jugado',
    );
    const ultimaJornadaJugada = jugadosEtapa.length
      ? Math.max(...jugadosEtapa.map(partido => partido.jornada))
      : 0;
    if (ultimaJornadaJugada >= CambiosDorsalService.JORNADA_LIMITE) {
      throw new BadRequestException('El plazo para cambiar el dorsal terminó al completarse la jornada 3');
    }
    if (dto.jornadaDesde <= ultimaJornadaJugada) {
      throw new BadRequestException(
        `El cambio debe aplicarse desde una jornada posterior a la ${ultimaJornadaJugada}`,
      );
    }

    const cambioExistente = await this.cambioRepo.findOne({
      where: { jugadorCampeonatoId, etapaCompetenciaId: etapa.id, activo: true },
    });
    if (cambioExistente) {
      throw new BadRequestException('El jugador ya tiene un cambio de dorsal activo en esta etapa');
    }

    await this.validarDorsalDisponible(habilitacion, etapa, dto.numeroCancha, dto.jornadaDesde, partidos);

    const cambio = this.cambioRepo.create({
      jugadorCampeonatoId,
      etapaCompetenciaId: etapa.id,
      numeroCancha: dto.numeroCancha,
      jornadaDesde: dto.jornadaDesde,
      motivo: dto.motivo.trim(),
      registradoPor: usuario.userId ?? usuario.id ?? null,
      activo: true,
      anuladoPor: null,
      fechaAnulacion: null,
      motivoAnulacion: null,
    });
    return this.cambioRepo.save(cambio);
  }

  async anular(
    jugadorCampeonatoId: number,
    cambioId: number,
    motivo: string,
    usuario: any,
  ): Promise<CambioDorsalEtapa> {
    await this.obtenerHabilitacionAutorizada(jugadorCampeonatoId, usuario, true);
    const cambio = await this.cambioRepo.findOne({
      where: { id: cambioId, jugadorCampeonatoId, activo: true },
    });
    if (!cambio) throw new NotFoundException('Cambio de dorsal activo no encontrado');
    if (!motivo?.trim()) throw new BadRequestException('El motivo de anulación es obligatorio');

    cambio.activo = false;
    cambio.anuladoPor = usuario.userId ?? usuario.id ?? null;
    cambio.fechaAnulacion = new Date();
    cambio.motivoAnulacion = motivo.trim();
    return this.cambioRepo.save(cambio);
  }

  async adjuntarCambiosActivos(habilitaciones: JugadorCampeonato[]): Promise<any[]> {
    if (!habilitaciones.length) return habilitaciones;
    const cambios = await this.cambioRepo.find({
      where: { jugadorCampeonatoId: In(habilitaciones.map(item => item.id)), activo: true },
      order: { creadoEn: 'ASC' },
    });
    const porHabilitacion = new Map<number, CambioDorsalEtapa[]>();
    for (const cambio of cambios) {
      porHabilitacion.set(cambio.jugadorCampeonatoId, [
        ...(porHabilitacion.get(cambio.jugadorCampeonatoId) ?? []),
        cambio,
      ]);
    }
    return habilitaciones.map(habilitacion => ({
      ...habilitacion,
      cambiosDorsalActivos: porHabilitacion.get(habilitacion.id) ?? [],
    }));
  }

  async resolverNumerosParaContexto(
    habilitaciones: JugadorCampeonato[],
    etapaNombre: string,
    jornada: number,
  ): Promise<Map<number, number>> {
    const resultado = new Map(habilitaciones.map(item => [item.id, item.numeroCancha]));
    if (!habilitaciones.length) return resultado;

    const primera = habilitaciones[0];
    const etapa = await this.etapaRepo.findOne({
      where: {
        campeonatoId: primera.campeonatoId,
        categoriaId: primera.categoriaId,
        nombre: etapaNombre,
        activo: true,
      },
    });
    if (!etapa) return resultado;

    const cambios = await this.cambioRepo.find({
      where: {
        jugadorCampeonatoId: In(habilitaciones.map(item => item.id)),
        etapaCompetenciaId: etapa.id,
        activo: true,
      },
    });
    for (const cambio of cambios) {
      if (jornada >= cambio.jornadaDesde) {
        resultado.set(cambio.jugadorCampeonatoId, cambio.numeroCancha);
      }
    }
    return resultado;
  }

  /**
   * Devuelve el dorsal vigente de presentación para listados generales. Se usa
   * la excepción de la etapa marcada como actual; los documentos históricos de
   * un partido siempre deben usar resolverNumerosParaContexto.
   */
  async resolverNumerosActuales(
    habilitaciones: JugadorCampeonato[],
  ): Promise<Map<number, number>> {
    const resultado = new Map(habilitaciones.map(item => [item.id, item.numeroCancha]));
    if (!habilitaciones.length) return resultado;
    const cambios = await this.cambioRepo.find({
      where: {
        jugadorCampeonatoId: In(habilitaciones.map(item => item.id)),
        activo: true,
      },
    });
    for (const cambio of cambios) {
      if (cambio.etapa?.estado === 'actual') {
        resultado.set(cambio.jugadorCampeonatoId, cambio.numeroCancha);
      }
    }
    return resultado;
  }

  /**
   * Valida un dorsal para crear, corregir o aprobar una habilitación. Revisa
   * toda la parte pendiente de la etapa actual: así un dorsal original queda
   * libre cuando entra en vigencia el cambio, pero el dorsal nuevo se reserva
   * aunque su jornada de inicio todavía no se haya disputado.
   */
  async validarDorsalParaHabilitacion(params: {
    campeonatoId: number;
    categoriaId: number;
    equipoId: number;
    numeroCancha: number;
    excluirHabilitacionId?: number;
  }): Promise<void> {
    const habilitaciones = await this.jugadorCampeonatoRepo.find({
      where: {
        campeonatoId: params.campeonatoId,
        equipoId: params.equipoId,
        activo: true,
      },
    });
    const otras = habilitaciones.filter(item => item.id !== params.excluirHabilitacionId);
    if (!otras.length) return;

    const etapas = await this.obtenerEtapasDisponibles({
      campeonatoId: params.campeonatoId,
      categoriaId: params.categoriaId,
    } as JugadorCampeonato);
    const etapaActual = etapas.find(etapa => etapa.estado === 'actual');

    // Compatibilidad con campeonatos que todavía no tienen fixture o etapa:
    // se conserva exactamente la validación histórica por dorsal original.
    if (!etapaActual) {
      if (otras.some(item => item.numeroCancha === params.numeroCancha)) {
        throw new BadRequestException(
          `El número de camiseta ${params.numeroCancha} ya está asignado a otro jugador en este campeonato y equipo`,
        );
      }
      return;
    }

    const partidos = await this.partidosEquipo({
      campeonatoId: params.campeonatoId,
      categoriaId: params.categoriaId,
      equipoId: params.equipoId,
    } as JugadorCampeonato);
    const partidosEtapa = partidos.filter(partido => partido.etapa === etapaActual.nombre);
    const jornadasJugadas = partidosEtapa
      .filter(partido => partido.estado === 'jugado')
      .map(partido => partido.jornada);
    const jornadaInicial = jornadasJugadas.length
      ? Math.max(...jornadasJugadas) + 1
      : 1;
    const jornadaFinal = Math.max(
      CambiosDorsalService.JORNADA_LIMITE,
      ...partidosEtapa.map(partido => partido.jornada),
    );

    const cambios = await this.cambioRepo.find({
      where: {
        jugadorCampeonatoId: In(otras.map(item => item.id)),
        etapaCompetenciaId: etapaActual.id,
        activo: true,
      },
    });
    const cambioPorJugador = new Map(cambios.map(cambio => [cambio.jugadorCampeonatoId, cambio]));

    for (let jornada = jornadaInicial; jornada <= jornadaFinal; jornada++) {
      const ocupado = otras.some(habilitacion => {
        const cambio = cambioPorJugador.get(habilitacion.id);
        const dorsalEfectivo = cambio && jornada >= cambio.jornadaDesde
          ? cambio.numeroCancha
          : habilitacion.numeroCancha;
        return dorsalEfectivo === params.numeroCancha;
      });
      if (ocupado) {
        throw new BadRequestException(
          `El número de camiseta ${params.numeroCancha} ya está asignado a otro jugador en la jornada ${jornada}`,
        );
      }
    }
  }

  private async validarDorsalDisponible(
    habilitacion: JugadorCampeonato,
    etapa: EtapaCompetencia,
    numeroCancha: number,
    jornadaDesde: number,
    partidosEquipo: Partido[],
  ): Promise<void> {
    const companeros = await this.jugadorCampeonatoRepo.find({
      where: {
        campeonatoId: habilitacion.campeonatoId,
        categoriaId: habilitacion.categoriaId,
        equipoId: habilitacion.equipoId,
        estado: In(['pendiente', 'habilitado']),
        activo: true,
      },
    });
    const otros = companeros.filter(item => item.id !== habilitacion.id);
    if (!otros.length) return;
    const cambios = await this.cambioRepo.find({
      where: {
        jugadorCampeonatoId: In(otros.map(item => item.id)),
        etapaCompetenciaId: etapa.id,
        activo: true,
      },
    });
    const cambioPorJugador = new Map(cambios.map(cambio => [cambio.jugadorCampeonatoId, cambio]));
    const jornadasEtapa = partidosEquipo
      .filter(partido => partido.etapa === etapa.nombre)
      .map(partido => partido.jornada);
    const jornadaFinal = Math.max(CambiosDorsalService.JORNADA_LIMITE, ...jornadasEtapa);

    for (let jornada = jornadaDesde; jornada <= jornadaFinal; jornada++) {
      const ocupado = otros.find(companero => {
        const cambio = cambioPorJugador.get(companero.id);
        const efectivo = cambio && jornada >= cambio.jornadaDesde
          ? cambio.numeroCancha
          : companero.numeroCancha;
        return efectivo === numeroCancha;
      });
      if (ocupado) {
        throw new BadRequestException(
          `El dorsal ${numeroCancha} ya pertenece a otro jugador del equipo en la jornada ${jornada}`,
        );
      }
    }
  }

  private async partidosEquipo(habilitacion: JugadorCampeonato): Promise<Partido[]> {
    return this.partidoRepo.find({
      where: [
        {
          campeonatoId: habilitacion.campeonatoId,
          categoriaId: habilitacion.categoriaId,
          equipoLocalId: habilitacion.equipoId,
          activo: true,
        },
        {
          campeonatoId: habilitacion.campeonatoId,
          categoriaId: habilitacion.categoriaId,
          equipoVisitanteId: habilitacion.equipoId,
          activo: true,
        },
      ],
      order: { jornada: 'ASC' },
    });
  }

  /**
   * Los fixtures creados antes de incorporar etapas_competencia solo conservan
   * el nombre de la etapa en partidos. Al abrir este flujo se materializan esos
   * nombres para que puedan ser referenciados por el cambio de dorsal.
   */
  private async obtenerEtapasDisponibles(
    habilitacion: JugadorCampeonato,
  ): Promise<EtapaCompetencia[]> {
    const criterio = {
      campeonatoId: habilitacion.campeonatoId,
      categoriaId: habilitacion.categoriaId,
    };
    const configuradas = await this.etapaRepo.find({
      where: { ...criterio, activo: true },
      order: { orden: 'ASC', id: 'ASC' },
    });
    if (configuradas.length) return configuradas;

    const nombres = await this.partidoRepo
      .createQueryBuilder('partido')
      .select('partido.etapa', 'nombre')
      .addSelect('MIN(partido.id)', 'primerPartidoId')
      .where('partido.campeonatoId = :campeonatoId', {
        campeonatoId: habilitacion.campeonatoId,
      })
      .andWhere('partido.categoriaId = :categoriaId', {
        categoriaId: habilitacion.categoriaId,
      })
      .andWhere('partido.activo = :activo', { activo: true })
      .groupBy('partido.etapa')
      .orderBy('MIN(partido.id)', 'ASC')
      .getRawMany<{ nombre: string }>();
    if (!nombres.length) return [];

    const existentes = await this.etapaRepo.find({ where: criterio });
    const porNombre = new Map(existentes.map(etapa => [etapa.nombre, etapa]));
    for (let indice = 0; indice < nombres.length; indice++) {
      const nombre = nombres[indice].nombre;
      const existente = porNombre.get(nombre);
      await this.etapaRepo.save(this.etapaRepo.create({
        ...(existente ?? {}),
        ...criterio,
        nombre,
        orden: indice + 1,
        formato: existente?.formato ?? 'tabla_unica',
        estado: indice === nombres.length - 1 ? 'actual' : 'finalizada',
        activo: true,
      }));
    }

    return this.etapaRepo.find({
      where: { ...criterio, activo: true },
      order: { orden: 'ASC', id: 'ASC' },
    });
  }

  private async obtenerHabilitacionAutorizada(
    id: number,
    usuario: any,
    requiereGestion: boolean,
  ): Promise<JugadorCampeonato> {
    if (requiereGestion && !['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo de liga pueden cambiar dorsales');
    }
    const habilitacion = await this.jugadorCampeonatoRepo.findOne({ where: { id } });
    if (!habilitacion) throw new NotFoundException('Habilitación no encontrada');
    if (habilitacion.estado !== 'habilitado' || !habilitacion.activo) {
      throw new BadRequestException('El cambio de dorsal solo aplica a jugadores habilitados y activos');
    }
    if (usuario.role === 'directivo_liga' && habilitacion.campeonato?.ligaId !== usuario.ligaId) {
      throw new ForbiddenException('No tienes permisos para gestionar jugadores de otra liga');
    }
    if (usuario.role === 'dirigente_equipo' && habilitacion.equipoId !== usuario.equipoId) {
      throw new ForbiddenException('No tienes permisos para consultar este jugador');
    }
    return habilitacion;
  }
}
