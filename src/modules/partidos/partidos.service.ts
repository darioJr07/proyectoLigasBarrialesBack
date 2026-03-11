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

@Injectable()
export class PartidosService {
  constructor(
    @InjectRepository(Partido)
    private partidosRepository: Repository<Partido>,
  ) {}

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
            equipoVisitanteId: visitante,
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
              equipoVisitanteId: visitante,
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

    return query
      .orderBy('partido.jornada', 'ASC')
      .addOrderBy('partido.fechaPartido', 'ASC')
      .getMany();
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

    return query
      .orderBy('partido.jornada', 'ASC')
      .addOrderBy('partido.fechaPartido', 'ASC', 'NULLS LAST')
      .getMany();
  }

  /**
   * Devuelve las etapas distintas que existen en los partidos de un campeonato/categoría.
   * Útil para poblar dinámicamente el selector de etapa en la tabla de posiciones.
   */
  async getEtapas(campeonatoId: number, categoriaId: number): Promise<string[]> {
    const result = await this.partidosRepository
      .createQueryBuilder('partido')
      .select('DISTINCT partido.etapa', 'etapa')
      .where('partido.campeonatoId = :campeonatoId', { campeonatoId })
      .andWhere('partido.categoriaId = :categoriaId', { categoriaId })
      .andWhere('partido.activo = :activo', { activo: true })
      .orderBy('partido.etapa', 'ASC')
      .getRawMany();
    return result.map((r) => r.etapa);
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
    return this.partidosRepository.find({
      where: { campeonatoId, categoriaId, jornada, etapa, activo: true },
      order: { fechaPartido: 'ASC' },
    });
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
    return partido;
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

    if (dto.equipoLocalId !== undefined && dto.equipoVisitanteId !== undefined) {
      if (dto.equipoLocalId === dto.equipoVisitanteId) {
        throw new BadRequestException(
          'El equipo local y visitante no pueden ser el mismo.',
        );
      }
    }

    Object.assign(partido, dto);
    return this.partidosRepository.save(partido);
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

    partido.golesLocal = dto.golesLocal;
    partido.golesVisitante = dto.golesVisitante;
    partido.bonificacionLocal = dto.bonificacionLocal ?? 0;
    partido.bonificacionVisitante = dto.bonificacionVisitante ?? 0;
    partido.sancionado = dto.sancionado ?? 'ninguno';
    partido.estado = 'jugado';
    if (dto.observaciones) partido.observaciones = dto.observaciones;

    return this.partidosRepository.save(partido);
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

    // Soft delete de todos
    for (const p of partidos) {
      p.activo = false;
    }
    await this.partidosRepository.save(partidos);

    return {
      message: `Fixture eliminado correctamente.`,
      eliminados: partidos.length,
    };
  }
}
