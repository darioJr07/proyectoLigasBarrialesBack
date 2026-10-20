import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partido } from './entities/partido.entity';
import { CreatePartidoDto } from './dto/create-partido.dto';
import { UpdatePartidoDto } from './dto/update-partido.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { GolesService } from '../goles/goles.service';
import { SancionesService } from '../sanciones/sanciones.service';
import { Gol } from '../goles/entities/gol.entity';
import { ActaAlineacion } from '../acta-partido/entities/acta-alineacion.entity';
import { ActaIncidencia } from '../acta-partido/entities/acta-incidencia.entity';
import { EtapaCompetencia, FormatoEtapa } from './entities/etapa-competencia.entity';
import { EtapaGrupo } from './entities/etapa-grupo.entity';
import { EtapaGrupoEquipo } from './entities/etapa-grupo-equipo.entity';
import { EtapaGrupoBonificacion } from './entities/etapa-grupo-bonificacion.entity';
import { GenerarFixtureDto, GrupoFixtureDto } from './dto/generar-fixture.dto';

@Injectable()
export class PartidosService {
  constructor(
    @InjectRepository(Partido)
    private partidosRepository: Repository<Partido>,
    @InjectRepository(Gol) private golesRepository: Repository<Gol>,
    @InjectRepository(ActaAlineacion) private actaRepository: Repository<ActaAlineacion>,
    @InjectRepository(ActaIncidencia) private incidenciaRepository: Repository<ActaIncidencia>,
    @InjectRepository(EtapaCompetencia) private etapasRepository: Repository<EtapaCompetencia>,
    @InjectRepository(EtapaGrupo) private gruposRepository: Repository<EtapaGrupo>,
    @InjectRepository(EtapaGrupoEquipo) private gruposEquiposRepository: Repository<EtapaGrupoEquipo>,
    @InjectRepository(EtapaGrupoBonificacion) private bonificacionesEtapaRepository: Repository<EtapaGrupoBonificacion>,
    private readonly golesService: GolesService,
    private readonly sancionesService: SancionesService,
  ) {}

  async generarFixture(dto: GenerarFixtureDto, usuario: any) {
    if (dto.formato === 'grupos_cruce_descansos') {
      return this.generarFixtureGrupos(dto, usuario);
    }

    if (!dto.equipoIds?.length) {
      throw new BadRequestException('Debes seleccionar los equipos del fixture.');
    }

    const resultado = await this.generarFixtureRoundRobin(
      dto.campeonatoId,
      dto.categoriaId,
      dto.equipoIds,
      dto.etapa,
      dto.conRevancha ?? false,
      usuario,
    );
    await this.registrarEtapa(
      dto.campeonatoId,
      dto.categoriaId,
      dto.etapa || 'primera_etapa',
      'tabla_unica',
      dto.marcarComoActual ?? true,
    );
    return resultado;
  }

  private async registrarEtapa(
    campeonatoId: number,
    categoriaId: number,
    nombre: string,
    formato: FormatoEtapa,
    marcarComoActual: boolean,
  ): Promise<EtapaCompetencia> {
    await this.sincronizarEtapasExistentes(campeonatoId, categoriaId);
    let etapa = await this.etapasRepository.findOne({
      where: { campeonatoId, categoriaId, nombre },
    });
    const total = await this.etapasRepository.count({ where: { campeonatoId, categoriaId, activo: true } });

    if (marcarComoActual) {
      await this.etapasRepository
        .createQueryBuilder()
        .update(EtapaCompetencia)
        .set({ estado: 'finalizada' })
        .where('campeonato_id = :campeonatoId', { campeonatoId })
        .andWhere('categoria_id = :categoriaId', { categoriaId })
        .andWhere("estado = 'actual'")
        .execute();
    }

    etapa = this.etapasRepository.create({
      ...(etapa ?? {}),
      campeonatoId,
      categoriaId,
      nombre,
      formato,
      orden: etapa?.orden ?? total + 1,
      estado: marcarComoActual ? 'actual' : (etapa?.estado ?? 'pendiente'),
      activo: true,
    });
    return this.etapasRepository.save(etapa);
  }

  private async sincronizarEtapasExistentes(campeonatoId: number, categoriaId: number): Promise<void> {
    const existentes = await this.partidosRepository
      .createQueryBuilder('partido')
      .select('partido.etapa', 'nombre')
      .addSelect('MIN(partido.id)', 'primerPartidoId')
      .where('partido.campeonato_id = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoria_id = :categoriaId', { categoriaId })
      .andWhere('partido.activo = true')
      .groupBy('partido.etapa')
      .orderBy('MIN(partido.id)', 'ASC')
      .getRawMany<{ nombre: string }>();
    const configuradas = await this.etapasRepository.find({ where: { campeonatoId, categoriaId } });
    const nombresConfigurados = new Set(configuradas.map((etapa) => etapa.nombre));
    let orden = configuradas.reduce((maximo, etapa) => Math.max(maximo, etapa.orden), 0);
    for (const fila of existentes) {
      if (nombresConfigurados.has(fila.nombre)) continue;
      orden++;
      await this.etapasRepository.save(this.etapasRepository.create({
        campeonatoId,
        categoriaId,
        nombre: fila.nombre,
        orden,
        formato: 'tabla_unica',
        estado: 'finalizada',
        activo: true,
      }));
    }
  }

  private crearRondasGrupo(equipoIds: number[]) {
    const rotacion: Array<number | null> = [...equipoIds];
    if (rotacion.length % 2 !== 0) rotacion.push(null);
    const cantidad = rotacion.length;
    const rondas: Array<{ partidos: Array<[number, number]>; descanso: number | null }> = [];

    for (let ronda = 0; ronda < cantidad - 1; ronda++) {
      const partidos: Array<[number, number]> = [];
      let descanso: number | null = null;
      for (let i = 0; i < cantidad / 2; i++) {
        const a = rotacion[i];
        const b = rotacion[cantidad - 1 - i];
        if (a === null || b === null) descanso = a ?? b;
        else partidos.push(ronda % 2 === 0 ? [a, b] : [b, a]);
      }
      rondas.push({ partidos, descanso });
      const ultimo = rotacion.pop() ?? null;
      rotacion.splice(1, 0, ultimo);
    }
    return rondas;
  }

  private validarGruposFixture(grupos: GrupoFixtureDto[]) {
    if (grupos.length !== 2) {
      throw new BadRequestException('La liguilla con cruce de descansos requiere exactamente dos grupos.');
    }
    const nombres = grupos.map((grupo) => grupo.nombre.trim().toLowerCase());
    if (new Set(nombres).size !== nombres.length) {
      throw new BadRequestException('Los nombres de los grupos no pueden repetirse.');
    }
    if (grupos.some((grupo) => grupo.equipos.length < 3 || grupo.equipos.length % 2 === 0)) {
      throw new BadRequestException('Cada grupo debe tener una cantidad impar de al menos 3 equipos.');
    }
    if (grupos[0].equipos.length !== grupos[1].equipos.length) {
      throw new BadRequestException('Los dos grupos deben tener la misma cantidad de equipos.');
    }
    const ids = grupos.flatMap((grupo) => grupo.equipos.map((equipo) => Number(equipo.equipoId)));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un equipo no puede pertenecer a los dos grupos.');
    }
  }

  private async generarFixtureGrupos(dto: GenerarFixtureDto, usuario: any) {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException('Solo master o directivo_liga pueden generar el fixture.');
    }
    const grupos = dto.grupos ?? [];
    this.validarGruposFixture(grupos);
    const etapaNombre = dto.etapa?.trim() || 'liguilla';
    const existentes = await this.partidosRepository.count({
      where: { campeonatoId: dto.campeonatoId, categoriaId: dto.categoriaId, etapa: etapaNombre, activo: true },
    });
    if (existentes > 0) {
      throw new BadRequestException('Ya existe un fixture para esta categoría y etapa.');
    }
    await this.sincronizarEtapasExistentes(dto.campeonatoId, dto.categoriaId);

    const rondasA = this.crearRondasGrupo(grupos[0].equipos.map((equipo) => Number(equipo.equipoId)));
    const rondasB = this.crearRondasGrupo(grupos[1].equipos.map((equipo) => Number(equipo.equipoId)));
    const ordenEquipoMap = new Map<number, number>(
      grupos.flatMap((grupo) => grupo.equipos).map((equipo, indice) => [Number(equipo.equipoId), indice + 1]),
    );
    const partidosBase: Array<{ local: number; visitante: number; jornada: number }> = [];
    rondasA.forEach((rondaA, indice) => {
      const rondaB = rondasB[indice];
      [...rondaA.partidos, ...rondaB.partidos].forEach(([local, visitante]) => {
        partidosBase.push({ local, visitante, jornada: indice + 1 });
      });
      if (!rondaA.descanso || !rondaB.descanso) {
        throw new BadRequestException('No fue posible determinar los equipos libres para el cruce intergrupal.');
      }
      partidosBase.push({
        local: indice % 2 === 0 ? rondaA.descanso : rondaB.descanso,
        visitante: indice % 2 === 0 ? rondaB.descanso : rondaA.descanso,
        jornada: indice + 1,
      });
    });

    const jornadasIda = rondasA.length;
    if (dto.conRevancha) {
      const partidosIda = [...partidosBase];
      const partidosPorJornada = partidosIda.length / jornadasIda;
      partidosIda.reverse().forEach((partido, indice) => {
        const jornadaIda = jornadasIda - Math.floor(indice / partidosPorJornada);
        partidosBase.push({
          local: partido.visitante,
          visitante: partido.local,
          jornada: jornadasIda + jornadaIda,
        });
      });
    }

    return this.partidosRepository.manager.transaction(async (manager) => {
      const repoEtapa = manager.getRepository(EtapaCompetencia);
      const repoGrupo = manager.getRepository(EtapaGrupo);
      const repoMiembro = manager.getRepository(EtapaGrupoEquipo);
      const repoBonificacion = manager.getRepository(EtapaGrupoBonificacion);
      const repoPartido = manager.getRepository(Partido);

      if (dto.marcarComoActual ?? true) {
        await repoEtapa
          .createQueryBuilder()
          .update(EtapaCompetencia)
          .set({ estado: 'finalizada' })
          .where('campeonato_id = :campeonatoId', { campeonatoId: dto.campeonatoId })
          .andWhere('categoria_id = :categoriaId', { categoriaId: dto.categoriaId })
          .andWhere("estado = 'actual'")
          .execute();
      }
      const totalEtapas = await repoEtapa.count({
        where: { campeonatoId: dto.campeonatoId, categoriaId: dto.categoriaId, activo: true },
      });
      const etapa = await repoEtapa.save(repoEtapa.create({
        campeonatoId: Number(dto.campeonatoId),
        categoriaId: Number(dto.categoriaId),
        nombre: etapaNombre,
        orden: totalEtapas + 1,
        formato: 'grupos_cruce_descansos',
        estado: (dto.marcarComoActual ?? true) ? 'actual' : 'pendiente',
      }));

      for (let indiceGrupo = 0; indiceGrupo < grupos.length; indiceGrupo++) {
        const entradaGrupo = grupos[indiceGrupo];
        const grupo = await repoGrupo.save(repoGrupo.create({
          etapaCompetenciaId: etapa.id,
          nombre: entradaGrupo.nombre.trim(),
          orden: indiceGrupo + 1,
        }));
        for (let indiceEquipo = 0; indiceEquipo < entradaGrupo.equipos.length; indiceEquipo++) {
          const entradaEquipo = entradaGrupo.equipos[indiceEquipo];
          const miembro = await repoMiembro.save(repoMiembro.create({
            grupoId: grupo.id,
            equipoId: Number(entradaEquipo.equipoId),
            orden: indiceEquipo + 1,
          }));
          const bonificaciones = (entradaEquipo.bonificaciones ?? []).map((bonificacion) =>
            repoBonificacion.create({
              grupoEquipoId: miembro.id,
              puntos: Number(bonificacion.puntos),
              etapaOrigen: bonificacion.etapaOrigen?.trim() || null,
              posicionOrigen: bonificacion.posicionOrigen ?? null,
              motivo: bonificacion.motivo.trim(),
              creadoPorId: usuario.sub ?? usuario.id ?? null,
            }),
          );
          if (bonificaciones.length) await repoBonificacion.save(bonificaciones);
        }
      }

      const partidos = partidosBase.map((partido) => repoPartido.create({
        campeonatoId: Number(dto.campeonatoId),
        categoriaId: Number(dto.categoriaId),
        equipoLocalId: partido.local,
        equipoLocalOrden: ordenEquipoMap.get(partido.local) ?? null,
        equipoVisitanteId: partido.visitante,
        equipoVisitanteOrden: ordenEquipoMap.get(partido.visitante) ?? null,
        etapa: etapaNombre,
        jornada: partido.jornada,
        estado: 'programado',
      }));
      const guardados = await repoPartido.save(partidos);
      return {
        totalPartidos: guardados.length,
        totalJornadas: dto.conRevancha ? jornadasIda * 2 : jornadasIda,
        partidos: guardados,
        etapa,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR PARTIDO INDIVIDUAL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea un partido individual.
   * Valida que los dos equipos no sean el mismo.
   * Solo master y directivo_liga pueden crear partidos.
   */
  async create(dto: CreatePartidoDto, usuario: any): Promise<Partido> {
    if (dto.equipoLocalId === dto.equipoVisitanteId) {
      throw new BadRequestException(
        'El equipo local y visitante no pueden ser el mismo.',
      );
    }

    const partido = this.partidosRepository.create({
      campeonatoId: Number(dto.campeonatoId),
      categoriaId: Number(dto.categoriaId),
      equipoLocalId: Number(dto.equipoLocalId),
      equipoVisitanteId: Number(dto.equipoVisitanteId),
      etapa: dto.etapa || 'primera_etapa',
      jornada: Number(dto.jornada),
      fechaPartido: dto.fechaPartido ? (new Date(dto.fechaPartido) as any) : undefined,
      horaPartido: dto.horaPartido || undefined,
      cancha: dto.cancha || undefined,
      observaciones: dto.observaciones || undefined,
      estado: 'programado',
    });

    return this.partidosRepository.save(partido);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GENERACIÓN AUTOMÁTICA DE FIXTURE (TODOS CONTRA TODOS)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera automáticamente el fixture de todos contra todos (round-robin)
   * para una categoría de un campeonato.
   *
   * ALGORITMO ROUND-ROBIN:
   * Con N equipos:
   *   - Si N es impar, se agrega un "BYE" (equipo libre) para facilitar el cálculo.
   *   - Se generan N-1 jornadas de ida (si N par) o N jornadas (si N impar).
   *   - Cada jornada tiene N/2 partidos.
   *   - En cada jornada, se rotan los equipos excepto el primero (fijo).
   *
   * Ejemplo con 4 equipos (A, B, C, D) — 3 jornadas:
   *   Jornada 1: A-D, B-C
   *   Jornada 2: A-C, D-B
   *   Jornada 3: A-B, C-D
   *
   * Con 14 equipos (como tu liga): 13 jornadas de ida, 7 partidos por jornada.
   * Con revancha: 26 jornadas en total (13 ida + 13 vuelta).
   *
   * @param campeonatoId  - ID del campeonato
   * @param categoriaId   - ID de la categoría (Máxima, Primera, etc.)
   * @param equipoIds     - Array de IDs de los equipos inscritos (cualquier cantidad)
   * @param etapa         - Nombre de la etapa (por defecto 'primera_etapa')
   * @param conRevancha   - Si true, genera ida Y vuelta (roles local/visitante se invierten)
   * @param usuario       - Usuario autenticado (para validar permisos)
   */
  async generarFixtureRoundRobin(
    campeonatoId: number,
    categoriaId: number,
    equipoIds: number[],
    etapa: string = 'primera_etapa',
    conRevancha: boolean = false,
    usuario: any,
  ): Promise<{ totalPartidos: number; totalJornadas: number; partidos: Partido[] }> {
    // Solo master y directivo_liga pueden generar fixture
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden generar el fixture.',
      );
    }

    if (equipoIds.length < 2) {
      throw new BadRequestException(
        'Se necesitan al menos 2 equipos para generar el fixture.',
      );
    }

    // Verificar que no existan partidos previos para esta categoría/etapa
    const existentes = await this.partidosRepository.count({
      where: { campeonatoId, categoriaId, etapa, activo: true },
    });

    if (existentes > 0) {
      throw new BadRequestException(
        `Ya existe un fixture generado para esta categoría y etapa. ` +
        `Si deseas regenerarlo, usa primero el endpoint de eliminar fixture.`,
      );
    }

    // ─── Preparar equipos ────────────────────────────────────────────────────

    // Copiar el array para no modificar el original
    let equipos: (number | null)[] = [...equipoIds];
    const ordenEquipoMap = new Map<number, number>(
      equipoIds.map((equipoId, index) => [equipoId, index + 1]),
    );

    /**
     * Si la cantidad de equipos es IMPAR, se agrega un "BYE" (null).
     * El BYE representa la fecha libre de un equipo.
     * Ejemplo: 13 equipos → se agrega BYE → 14 equipos → 13 jornadas.
     */
    if (equipos.length % 2 !== 0) {
      equipos.push(null);
    }

    const n = equipos.length;
    const jornadasIda = n - 1;       // Jornadas de la primera vuelta (ida)
    const partidosPorJornada = n / 2;

    const partidos: Partido[] = [];

    // ─── Generar jornadas de IDA ─────────────────────────────────────────────

    /**
     * ROTACIÓN ROUND-ROBIN:
     * - El equipo en índice 0 queda FIJO toda la vuelta.
     * - Los demás equipos rotan en sentido horario cada jornada.
     *
     * Índice 0 vs índice N-1  (queda fijo el 0)
     * Índice 1 vs índice N-2
     * Índice 2 vs índice N-3
     * ... etc.
     */
    // Guardamos un snapshot del estado del array al inicio de cada jornada
    // para poder generar la vuelta en orden espejo (inverso)
    const snapshotsPorJornada: (number | null)[][] = [];

    for (let jornada = 1; jornada <= jornadasIda; jornada++) {
      // Guardar snapshot ANTES de jugar/rotar esta jornada
      snapshotsPorJornada.push([...equipos]);

      for (let i = 0; i < partidosPorJornada; i++) {
        const local = equipos[i];
        const visitante = equipos[n - 1 - i];

        // BYE = jornada libre, no se genera partido
        if (local === null || visitante === null) continue;

        partidos.push(
          this.partidosRepository.create({
            campeonatoId: Number(campeonatoId),
            categoriaId: Number(categoriaId),
            equipoLocalId: local,
            equipoLocalOrden: ordenEquipoMap.get(local) ?? null,
            equipoVisitanteId: visitante,
            equipoVisitanteOrden: ordenEquipoMap.get(visitante) ?? null,
            etapa,
            jornada,
            estado: 'programado',
          }),
        );
      }

      // Rotar todos excepto el primero
      const ultimo = equipos.pop() ?? null;
      equipos.splice(1, 0, ultimo);
    }

    // ─── Generar jornadas de VUELTA (revancha - fecha espejo) ────────────────

    if (conRevancha) {
      /**
       * FECHA ESPEJO: la vuelta empieza contra el último rival de la ida
       * y termina contra el primero. Se recorren los snapshots de la ida
       * en orden INVERSO, invirtiendo local y visitante.
       *
       * Ejemplo con 4 equipos, ida jornadas 1-3, vuelta jornadas 4-6:
       *   Vuelta jornada 4: espejo invertido de ida jornada 3
       *   Vuelta jornada 5: espejo invertido de ida jornada 2
       *   Vuelta jornada 6: espejo invertido de ida jornada 1
       */
      for (let idx = jornadasIda - 1; idx >= 0; idx--) {
        // jornadaVuelta va de (jornadasIda+1) hasta (jornadasIda*2)
        const jornadaVuelta = 2 * jornadasIda - idx;
        const snap = snapshotsPorJornada[idx];

        for (let i = 0; i < partidosPorJornada; i++) {
          // Invertimos roles respecto a la ida
          const local = snap[n - 1 - i];
          const visitante = snap[i];

          if (local === null || visitante === null) continue;

          partidos.push(
            this.partidosRepository.create({
              campeonatoId: Number(campeonatoId),
              categoriaId: Number(categoriaId),
              equipoLocalId: local,
              equipoLocalOrden: ordenEquipoMap.get(local) ?? null,
              equipoVisitanteId: visitante,
              equipoVisitanteOrden: ordenEquipoMap.get(visitante) ?? null,
              etapa,
              jornada: jornadaVuelta,
              estado: 'programado',
            }),
          );
        }
      }
    }

    // ─── Guardar en BD ───────────────────────────────────────────────────────

    const savedPartidos = await this.partidosRepository.save(partidos);

    const totalJornadas = conRevancha ? jornadasIda * 2 : jornadasIda;

    return {
      totalPartidos: savedPartidos.length,
      totalJornadas,
      partidos: savedPartidos,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTAR PARTIDOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lista todos los partidos activos.
   * Filtra por rol:
   *   - master: ve todos los partidos.
   *   - directivo_liga: solo partidos de campeonatos de su liga.
   *   - dirigente_equipo: solo partidos donde participa su equipo.
   */
  async findAll(usuario: any): Promise<Partido[]> {
    const query = this.partidosRepository
      .createQueryBuilder('partido')
      .leftJoinAndSelect('partido.campeonato', 'campeonato')
      .leftJoinAndSelect('partido.categoria', 'categoria')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .where('partido.activo = :activo', { activo: true });

    if (usuario.role === 'directivo_liga') {
      // Solo partidos de campeonatos de su liga
      query.andWhere('liga.id = :ligaId', { ligaId: usuario.ligaId });
    } else if (usuario.role === 'dirigente_equipo') {
      // Solo partidos donde su equipo participa (como local o visitante)
      query.andWhere(
        '(equipoLocal.id = :equipoId OR equipoVisitante.id = :equipoId)',
        { equipoId: usuario.equipoId },
      );
    }

    const partidos = await query
      .orderBy('partido.jornada', 'ASC')
      .addOrderBy('partido.fechaPartido', 'ASC')
      .getMany();

    return this.agregarEstadoPlanilla(partidos);
  }

  /**
   * Lista partidos por campeonato y opcionalmente categoría y/o etapa.
   * Útil para mostrar el fixture de una categoría específica.
   * Si el usuario es dirigente_equipo, solo devuelve los partidos de su equipo.
   */
  async findByCampeonato(
    campeonatoId: number,
    categoriaId?: number | undefined,
    etapa?: string | undefined,
    usuario?: any,
  ): Promise<Partido[]> {
    const query = this.partidosRepository
      .createQueryBuilder('partido')
      .leftJoinAndSelect('partido.campeonato', 'campeonato')
      .leftJoinAndSelect('partido.categoria', 'categoria')
      .leftJoinAndSelect('partido.equipoLocal', 'equipoLocal')
      .leftJoinAndSelect('partido.equipoVisitante', 'equipoVisitante')
      .where('partido.campeonatoId = :campeonatoId', { campeonatoId })
      .andWhere('partido.activo = :activo', { activo: true });

    if (categoriaId !== undefined) {
      query.andWhere('partido.categoriaId = :categoriaId', { categoriaId });
    }
    if (etapa !== undefined) {
      query.andWhere('partido.etapa = :etapa', { etapa });
    }

    // Filtrar solo partidos del equipo si el rol es dirigente_equipo
    if (usuario?.role === 'dirigente_equipo' && usuario.equipoId) {
      query.andWhere(
        '(equipoLocal.id = :equipoId OR equipoVisitante.id = :equipoId)',
        { equipoId: usuario.equipoId },
      );
    }

    const partidos = await query
      .orderBy('partido.jornada', 'ASC')
      .addOrderBy('partido.fechaPartido', 'ASC', 'NULLS LAST')
      .getMany();

    return this.agregarEstadoPlanilla(partidos);
  }

  /**
   * Devuelve las etapas distintas que existen en los partidos de un campeonato/categoría.
   * Útil para poblar dinámicamente el selector de etapa en la tabla de posiciones.
   */
  async getEtapas(campeonatoId: number, categoriaId: number): Promise<string[]> {
    const configuradas = await this.etapasRepository.find({
      where: { campeonatoId, categoriaId, activo: true },
      order: { orden: 'ASC', id: 'ASC' },
    });
    if (configuradas.length) return configuradas.map((etapa) => etapa.nombre);

    const result = await this.partidosRepository
      .createQueryBuilder('partido')
      .select('partido.etapa', 'etapa')
      .addSelect('MIN(partido.id)', 'primerPartidoId')
      .where('partido.campeonatoId = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoriaId = :categoriaId', { categoriaId })
      .andWhere('partido.activo = :activo', { activo: true })
      .groupBy('partido.etapa')
      .orderBy('MIN(partido.id)', 'ASC')
      .getRawMany();
    return result.map((r) => r.etapa);
  }

  async getEtapasDetalle(campeonatoId: number, categoriaId: number) {
    const etapas = await this.etapasRepository.find({
      where: { campeonatoId, categoriaId, activo: true },
      relations: ['grupos', 'grupos.equipos', 'grupos.equipos.equipo', 'grupos.equipos.bonificaciones'],
      order: { orden: 'ASC', id: 'ASC' },
    });
    if (etapas.length) {
      return etapas.map((etapa) => ({
        id: etapa.id,
        nombre: etapa.nombre,
        orden: etapa.orden,
        formato: etapa.formato,
        estado: etapa.estado,
        grupos: (etapa.grupos ?? [])
          .filter((grupo) => grupo.activo)
          .sort((a, b) => a.orden - b.orden)
          .map((grupo) => ({
            id: grupo.id,
            nombre: grupo.nombre,
            orden: grupo.orden,
            equipos: (grupo.equipos ?? [])
              .filter((miembro) => miembro.activo)
              .sort((a, b) => a.orden - b.orden)
              .map((miembro) => ({
                equipoId: miembro.equipoId,
                equipoNombre: miembro.equipo?.nombre ?? '',
                puntosBonificacion: (miembro.bonificaciones ?? [])
                  .filter((bonificacion) => bonificacion.activo)
                  .reduce((total, bonificacion) => total + Number(bonificacion.puntos), 0),
                bonificaciones: (miembro.bonificaciones ?? []).filter((bonificacion) => bonificacion.activo),
              })),
          })),
      }));
    }

    const nombres = await this.getEtapas(campeonatoId, categoriaId);
    return nombres.map((nombre, indice) => ({
      id: null,
      nombre,
      orden: indice + 1,
      formato: 'tabla_unica',
      estado: indice === nombres.length - 1 ? 'actual' : 'finalizada',
      grupos: [],
    }));
  }

  /**
   * Lista partidos de una jornada específica dentro de un campeonato y categoría.
   */
  async findByJornada(
    campeonatoId: number,
    categoriaId: number,
    jornada: number,
    etapa: string = 'primera_etapa',
  ): Promise<Partido[]> {
    const partidos = await this.partidosRepository.find({
      where: { campeonatoId, categoriaId, jornada, etapa, activo: true },
      order: { fechaPartido: 'ASC' },
    });
    return this.agregarEstadoPlanilla(partidos);
  }

  /**
   * Obtiene el detalle de un partido por su ID.
   * Lanza NotFoundException si no existe.
   */
  async findOne(id: number): Promise<Partido> {
    const partido = await this.partidosRepository.findOne({
      where: { id, activo: true },
      relations: ['campeonato'],
    });
    if (!partido) {
      throw new NotFoundException(`Partido #${id} no encontrado.`);
    }
    return (await this.agregarEstadoPlanilla([partido]))[0];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTUALIZAR PARTIDO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza datos del partido (fecha, hora, cancha, observaciones, etc.).
   * No permite actualizar el resultado directamente desde este método
   * (usar registrarResultado en su lugar).
   */
  async update(id: number, dto: UpdatePartidoDto, usuario: any): Promise<Partido> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden modificar partidos.',
      );
    }

    const partido = await this.findOne(id);

    if (partido.estado === 'jugado' && dto.estado && dto.estado !== 'jugado') {
      throw new BadRequestException('Un partido jugado no puede cambiarse de estado desde la edición normal. Use el flujo de anulación cuando esté disponible.');
    }
    const cambiaEquipos = (dto.equipoLocalId !== undefined && dto.equipoLocalId !== partido.equipoLocalId) || (dto.equipoVisitanteId !== undefined && dto.equipoVisitanteId !== partido.equipoVisitanteId);
    if (cambiaEquipos && await this.tieneInformacionRelacionada(partido)) {
      throw new BadRequestException('No se pueden cambiar los equipos de un partido con resultado, goles, acta o incidencias registradas.');
    }

    if (dto.equipoLocalId !== undefined && dto.equipoVisitanteId !== undefined) {
      if (dto.equipoLocalId === dto.equipoVisitanteId) {
        throw new BadRequestException(
          'El equipo local y visitante no pueden ser el mismo.',
        );
      }
    }

    const pasaASuspendido = dto.estado === 'suspendido' && partido.estado !== 'suspendido';
    Object.assign(partido, dto);
    return this.partidosRepository.manager.transaction(async (manager) => {
      const partidoGuardado = await manager.getRepository(Partido).save(partido);
      if (pasaASuspendido && partidoGuardado.equipoLocalId && partidoGuardado.equipoVisitanteId) {
        await this.sancionesService.procesarPartidoSuspendido(
          partidoGuardado.campeonatoId,
          partidoGuardado.equipoLocalId,
          partidoGuardado.equipoVisitanteId,
          partidoGuardado.id,
          manager,
        );
      }
      return partidoGuardado;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRAR RESULTADO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra el resultado de un partido jugado.
   * Cambia el estado del partido a 'jugado'.
   * Solo master y directivo_liga pueden registrar resultados.
   *
   * Las bonificaciones son opcionales y se usan para:
   *   - Puntos extra en la liguilla.
   *   - Bonificaciones para los 3 primeros de Máxima en la primera etapa.
   */
  async registrarResultado(
    id: number,
    dto: RegistrarResultadoDto,
    usuario: any,
  ): Promise<Partido> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden registrar resultados.',
      );
    }

    const partido = await this.findOne(id);

    if (partido.estado === 'cancelado') {
      throw new BadRequestException(
        'No se puede registrar resultado de un partido cancelado.',
      );
    }

    // Capturamos si el partido YA estaba jugado ANTES de modificarlo.
    // Esto nos permite saber si es un primer registro (false) o una edición (true).
    // Si es edición, no volvemos a contar partidos cumplidos en las sanciones
    // para evitar que una sanción de 3 partidos se descuente 2 veces con 1 partido real.
    const eraJugado = partido.estado === 'jugado';

    const resultadoPorExpulsion = dto.resultadoAdministrativoPorExpulsion ?? false;
    if (resultadoPorExpulsion && !['local', 'visitante'].includes(dto.sancionado ?? 'ninguno')) {
      throw new BadRequestException(
        'Para registrar un resultado por equipo expulsado debe indicar si el sancionado es local o visitante.',
      );
    }

    partido.golesLocal = dto.golesLocal;
    partido.golesVisitante = dto.golesVisitante;
    partido.bonificacionLocal = dto.bonificacionLocal ?? 0;
    partido.bonificacionVisitante = dto.bonificacionVisitante ?? 0;
    partido.sancionado = dto.sancionado ?? 'ninguno';
    partido.resultadoAdministrativoPorExpulsion = resultadoPorExpulsion;
    partido.estado = 'jugado';
    if (dto.observaciones) partido.observaciones = dto.observaciones;

    return this.partidosRepository.manager.transaction(async (manager) => {
      const partidoGuardado = await manager.getRepository(Partido).save(partido);

    // Registrar goles individuales si se enviaron autores
    // Se hace DESPUÉS de guardar el partido para que golesLocal/golesVisitante
    // estén disponibles al validar la suma en GolesService
    if (dto.autoresGoles && dto.autoresGoles.length > 0) {
      await this.golesService.registrarGoles(partidoGuardado, dto.autoresGoles, manager);
    }

    if (partidoGuardado.equipoLocalId && partidoGuardado.equipoVisitanteId) {
      if (partidoGuardado.resultadoAdministrativoPorExpulsion) {
        const equipoExpulsadoId = partidoGuardado.sancionado === 'local'
          ? partidoGuardado.equipoLocalId
          : partidoGuardado.equipoVisitanteId;
        const equipoRivalId = partidoGuardado.sancionado === 'local'
          ? partidoGuardado.equipoVisitanteId
          : partidoGuardado.equipoLocalId;

        // Si se corrige un resultado ya guardado, se elimina cualquier
        // cumplimiento previo del equipo expulsado antes de contar al rival.
        await this.sancionesService.revertirCumplimientosEquipoExpulsado(
          partidoGuardado.campeonatoId,
          equipoExpulsadoId,
          partidoGuardado.id,
          manager,
        );
        await this.sancionesService.procesarResultadoEquipoExpulsado(
          partidoGuardado.campeonatoId,
          equipoRivalId,
          partidoGuardado.id,
          manager,
        );
      } else {
        await this.sancionesService.procesarPartidosCumplidos(
          partidoGuardado.campeonatoId,
          partidoGuardado.equipoLocalId,
          partidoGuardado.equipoVisitanteId,
          partidoGuardado.id,
          manager,
        );
      }
    }

      return partidoGuardado;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ELIMINAR PARTIDO (SOFT DELETE)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Soft delete: marca el partido como inactivo en lugar de eliminarlo.
   * Esto preserva el historial para auditoría.
   */
  async remove(id: number, usuario: any): Promise<{ message: string }> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden eliminar partidos.',
      );
    }

    const partido = await this.findOne(id);
    if (await this.tieneInformacionRelacionada(partido)) throw new BadRequestException('No se puede eliminar un partido con resultado, goles, acta o incidencias registradas.');
    partido.activo = false;
    await this.partidosRepository.save(partido);
    return { message: `Partido #${id} eliminado correctamente.` };
  }

  /**
   * Elimina TODOS los partidos de una categoría y etapa.
   * Útil para regenerar el fixture si hubo un error.
   * PRECAUCIÓN: esto borra todos los partidos de la etapa indicada.
   */
  async eliminarFixture(
    campeonatoId: number,
    categoriaId: number,
    etapa: string,
    usuario: any,
  ): Promise<{ message: string; eliminados: number }> {
    if (!['master', 'directivo_liga'].includes(usuario.role)) {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden eliminar el fixture.',
      );
    }

    const partidos = await this.partidosRepository.find({
      where: { campeonatoId, categoriaId, etapa, activo: true },
    });

    if (partidos.length === 0) {
      throw new NotFoundException(
        'No se encontraron partidos para la categoría y etapa indicadas.',
      );
    }
    for (const partido of partidos) if (await this.tieneInformacionRelacionada(partido)) throw new BadRequestException('No se puede eliminar el fixture porque contiene partidos con resultado, goles, acta o incidencias.');

    // Soft delete de todos. La configuración de la etapa sí se elimina para
    // que el fixture (incluidos grupos y bonificaciones) pueda regenerarse.
    for (const p of partidos) {
      p.activo = false;
    }
    await this.partidosRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Partido).save(partidos);
      const repoEtapa = manager.getRepository(EtapaCompetencia);
      const configuracion = await repoEtapa.findOne({
        where: { campeonatoId, categoriaId, nombre: etapa },
      });
      if (configuracion) {
        const eraActual = configuracion.estado === 'actual';
        await repoEtapa.delete(configuracion.id);
        if (eraActual) {
          const anterior = await repoEtapa.findOne({
            where: { campeonatoId, categoriaId, activo: true },
            order: { orden: 'DESC', id: 'DESC' },
          });
          if (anterior) {
            anterior.estado = 'actual';
            await repoEtapa.save(anterior);
          }
        }
      }
    });

    return {
      message: `Fixture eliminado correctamente.`,
      eliminados: partidos.length,
    };
  }

  private async tieneInformacionRelacionada(partido: Partido): Promise<boolean> {
    if (partido.estado === 'jugado' || partido.golesLocal != null || partido.golesVisitante != null) return true;
    const [goles, actas, incidencias] = await Promise.all([
      this.golesRepository.count({ where: { partidoId: partido.id } }),
      this.actaRepository.count({ where: { partidoId: partido.id } }),
      this.incidenciaRepository.count({ where: { partidoId: partido.id, activo: true } }),
    ]);
    return goles > 0 || actas > 0 || incidencias > 0;
  }

  /**
   * Agrega un dato de lectura para la interfaz sin modificar el esquema de BD.
   * Se consulta en bloque para evitar una consulta por cada partido listado.
   */
  private async agregarEstadoPlanilla(partidos: Partido[]): Promise<Partido[]> {
    if (partidos.length === 0) return partidos;

    const partidoIds = partidos.map((partido) => partido.id);
    const registros = await this.actaRepository
      .createQueryBuilder('acta')
      .select('acta.partidoId', 'partidoId')
      .where('acta.partidoId IN (:...partidoIds)', { partidoIds })
      .groupBy('acta.partidoId')
      .getRawMany<{ partidoId: string }>();
    const idsConPlanilla = new Set(registros.map((registro) => Number(registro.partidoId)));

    return partidos.map((partido) => {
      partido.plantillaGuardada = idsConPlanilla.has(partido.id);
      return partido;
    });
  }
}
