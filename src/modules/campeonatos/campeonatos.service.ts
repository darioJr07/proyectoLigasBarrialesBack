import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Campeonato } from './entities/campeonato.entity';
import { CreateCampeonatoDto } from './dto/create-campeonato.dto';
import { UpdateCampeonatoDto } from './dto/update-campeonato.dto';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { TablaPosicionesService } from '../tabla-posiciones/tabla-posiciones.service';
import { DerramasService } from '../derramas/derramas.service';

export interface MovimientoPreview {
  equipoId: number;
  equipoNombre: string;
  categoriaOrigenId: number;
  categoriaOrigenNombre: string;
  categoriaDestinoId: number | null;
  categoriaDestinoNombre: string;
  motivo: 'ascenso' | 'descenso';
  posicion: number;
  advertencia?: string;
}

@Injectable()
export class CampeonatosService {
  constructor(
    @InjectRepository(Campeonato)
    private campeonatosRepository: Repository<Campeonato>,
    @InjectRepository(Inscripcion)
    private inscripcionesRepository: Repository<Inscripcion>,
    @InjectRepository(Categoria)
    private categoriasRepository: Repository<Categoria>,
    private tablaPosicionesService: TablaPosicionesService,
    private derramasService: DerramasService,
  ) {}

  /**
   * Crear un nuevo campeonato
   * Solo master y directivo_liga pueden crear campeonatos
   */
  async create(
    createCampeonatoDto: CreateCampeonatoDto,
    usuario: any,
  ): Promise<Campeonato> {
    // Validar que directivo_liga solo pueda crear campeonatos de su liga
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== createCampeonatoDto.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para crear campeonatos en esta liga',
      );
    }

    // Validar fechas
    const inicio = new Date(createCampeonatoDto.fechaInicio);
    const fin = new Date(createCampeonatoDto.fechaFin);
    const limiteInscripcion = new Date(createCampeonatoDto.fechaLimiteInscripcion);

    if (fin <= inicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    if (limiteInscripcion >= inicio) {
      throw new BadRequestException(
        'La fecha límite de inscripción debe ser anterior a la fecha de inicio',
      );
    }

    const campeonato = this.campeonatosRepository.create(createCampeonatoDto);
    return await this.campeonatosRepository.save(campeonato);
  }

  /**
   * Actualizar automáticamente los estados de los campeonatos según las fechas
   * - Si pasó la fecha de inicio y está en 'inscripcion_abierta' → 'en_curso'
   * - Si pasó la fecha fin y está en 'en_curso' → 'finalizado'
   */
  private async actualizarEstadosAutomaticos(): Promise<void> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Usar solo la fecha sin hora

    // Buscar campeonatos que necesitan actualización de estado
    const campeonatosAbiertos = await this.campeonatosRepository
      .createQueryBuilder('campeonato')
      .where('campeonato.activo = :activo', { activo: true })
      .andWhere('campeonato.estado IN (:...estados)', { 
        estados: ['inscripcion_abierta', 'en_curso'] 
      })
      .getMany();

    const actualizaciones: Promise<any>[] = [];

    for (const campeonato of campeonatosAbiertos) {
      const fechaInicio = new Date(campeonato.fechaInicio);
      const fechaFin = new Date(campeonato.fechaFin);
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(0, 0, 0, 0);

      let nuevoEstado: string | null = null;

      // Cambiar de 'inscripcion_abierta' a 'en_curso' si pasó la fecha de inicio
      if (campeonato.estado === 'inscripcion_abierta' && hoy >= fechaInicio) {
        nuevoEstado = 'en_curso';
      }
      // Cambiar de 'en_curso' a 'finalizado' si pasó la fecha fin
      else if (campeonato.estado === 'en_curso' && hoy > fechaFin) {
        nuevoEstado = 'finalizado';
      }

      if (nuevoEstado) {
        campeonato.estado = nuevoEstado as any;
        actualizaciones.push(this.campeonatosRepository.save(campeonato));
      }
    }

    if (actualizaciones.length > 0) {
      await Promise.all(actualizaciones);
      console.log(`✅ Estados actualizados: ${actualizaciones.length} campeonatos`);
    }
  }

  /**
   * Obtener todos los campeonatos filtrados por rol
   */
  async findAll(usuario: any): Promise<Campeonato[]> {
    // Actualizar estados automáticamente antes de consultar
    await this.actualizarEstadosAutomaticos();

    const query = this.campeonatosRepository
      .createQueryBuilder('campeonato')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .where('campeonato.activo = :activo', { activo: true });

    // Filtrar por liga si es directivo_liga
    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId) {
        return [];
      }
      query.andWhere('campeonato.ligaId = :ligaId', { ligaId: usuario.ligaId });
    }

    // Filtrar por liga del equipo si es dirigente_equipo
    if (usuario.role === 'dirigente_equipo') {
      if (!usuario.equipoId) {
        return [];
      }
      // Obtener ligaId del equipo del usuario (requiere join adicional)
      query
        .leftJoin('equipos', 'equipo', 'equipo.id = :equipoId', { equipoId: usuario.equipoId })
        .andWhere('campeonato.ligaId = equipo.ligaId');
    }

    return await query.getMany();
  }

  /**
   * Obtener campeonatos de una liga específica
   */
  async findByLiga(ligaId: number, usuario: any): Promise<Campeonato[]> {
    // Actualizar estados automáticamente antes de consultar
    await this.actualizarEstadosAutomaticos();

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== ligaId) {
      throw new ForbiddenException('No tienes permisos para ver campeonatos de esta liga');
    }

    return await this.campeonatosRepository.find({
      where: { ligaId, activo: true },
    });
  }

  /**
   * Obtener un campeonato por ID
   */
  async findOne(id: number, usuario: any): Promise<Campeonato> {
    // Actualizar estados automáticamente antes de consultar
    await this.actualizarEstadosAutomaticos();

    const campeonato = await this.campeonatosRepository.findOne({
      where: { id },
    });

    if (!campeonato) {
      throw new NotFoundException(`Campeonato con ID ${id} no encontrado`);
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para ver este campeonato');
    }

    return campeonato;
  }

  /**
   * Actualizar un campeonato
   */
  async update(
    id: number,
    updateCampeonatoDto: UpdateCampeonatoDto,
    usuario: any,
  ): Promise<Campeonato> {
    const campeonato = await this.findOne(id, usuario);

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para editar este campeonato');
    }

    // Validar cambio de ligaId
    if (updateCampeonatoDto.ligaId && updateCampeonatoDto.ligaId !== campeonato.ligaId) {
      if (usuario.role === 'directivo_liga') {
        throw new ForbiddenException('No puedes cambiar el campeonato a otra liga');
      }
    }

    Object.assign(campeonato, updateCampeonatoDto);
    // Forzar la relación eager para que TypeORM use el FK actualizado al guardar
    if (updateCampeonatoDto.ligaId !== undefined) {
      campeonato.liga = updateCampeonatoDto.ligaId
        ? ({ id: updateCampeonatoDto.ligaId } as any)
        : (null as any);
    }
    return await this.campeonatosRepository.save(campeonato);
  }

  /**
   * Soft delete - deshabilitar campeonato
   */
  async remove(id: number, usuario: any): Promise<void> {
    const campeonato = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para eliminar este campeonato');
    }

    campeonato.activo = false;
    await this.campeonatosRepository.save(campeonato);
  }

  /**
   * Cambiar estado de un campeonato
   */
  async cambiarEstado(
    id: number,
    estado: 'inscripcion_abierta' | 'en_curso' | 'finalizado' | 'cancelado',
    usuario: any,
  ): Promise<Campeonato> {
    const campeonato = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para cambiar el estado de este campeonato');
    }

    campeonato.estado = estado;
    const saved = await this.campeonatosRepository.save(campeonato);

    // Al finalizar un campeonato, cerrar todas sus derramas activas
    // y marcar los saldos pendientes como 'arrastrado'
    if (estado === 'finalizado') {
      await this.derramasService.cerrarPorCampeonato(id);
    }

    return saved;
  }

  /**
   * Ejecutar actualización manual de estados (útil para administradores)
   */
  async actualizarEstadosMasivo(usuario: any): Promise<{ mensaje: string; actualizados: number }> {
    if (usuario.role !== 'master') {
      throw new ForbiddenException('Solo el master puede ejecutar actualizaciones masivas');
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const campeonatosAbiertos = await this.campeonatosRepository
      .createQueryBuilder('campeonato')
      .where('campeonato.activo = :activo', { activo: true })
      .andWhere('campeonato.estado IN (:...estados)', { 
        estados: ['inscripcion_abierta', 'en_curso'] 
      })
      .getMany();

    let contador = 0;

    for (const campeonato of campeonatosAbiertos) {
      const fechaInicio = new Date(campeonato.fechaInicio);
      const fechaFin = new Date(campeonato.fechaFin);
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(0, 0, 0, 0);

      let actualizado = false;

      if (campeonato.estado === 'inscripcion_abierta' && hoy >= fechaInicio) {
        campeonato.estado = 'en_curso';
        actualizado = true;
      } else if (campeonato.estado === 'en_curso' && hoy > fechaFin) {
        campeonato.estado = 'finalizado';
        actualizado = true;
      }

      if (actualizado) {
        await this.campeonatosRepository.save(campeonato);
        contador++;
      }
    }

    return {
      mensaje: `Actualización completada. ${contador} campeonatos actualizados.`,
      actualizados: contador,
    };
  }

  /**
   * Corregir estados incorrectos de campeonatos (sin requerir autenticación - para uso interno)
   * Vuelve a 'inscripcion_abierta' los campeonatos cuya fechaInicio es futura
   */
  async corregirEstadosInicial(): Promise<{ mensaje: string; corregidos: number }> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar campeonatos en estado 'en_curso' o 'finalizado' pero con fechaInicio futura
    const campeonatosIncorrectos = await this.campeonatosRepository
      .createQueryBuilder('campeonato')
      .where('campeonato.activo = :activo', { activo: true })
      .andWhere('campeonato.estado IN (:...estados)', { 
        estados: ['en_curso', 'finalizado'] 
      })
      .getMany();

    let contador = 0;

    for (const campeonato of campeonatosIncorrectos) {
      const fechaInicio = new Date(campeonato.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);

      // Si la fecha de inicio es futura, volver a 'inscripcion_abierta'
      if (hoy < fechaInicio) {
        campeonato.estado = 'inscripcion_abierta';
        await this.campeonatosRepository.save(campeonato);
        contador++;
      }
    }

    return {
      mensaje: `Corrección completada. ${contador} campeonatos corregidos a 'inscripcion_abierta'.`,
      corregidos: contador,
    };
  }

  /**
   * Corregir estados incorrectos de campeonatos
   * Vuelve a 'inscripcion_abierta' los campeonatos cuya fechaInicio es futura
   */
  async corregirEstados(usuario: any): Promise<{ mensaje: string; corregidos: number }> {
    if (usuario.role !== 'master') {
      throw new ForbiddenException('Solo el master puede ejecutar correcciones');
    }

    return await this.corregirEstadosInicial();
  }

  /**
   * Previsualiza los ascensos y descensos que se procesarían al finalizar
   * la temporada de un campeonato, basándose en la tabla de posiciones de
   * la etapa indicada.
   *
   * No realiza cambios en la BD — solo calcula y devuelve el listado.
   */
  async previewAscensosDescensos(
    campeonatoId: number,
    etapa: string,
    usuario: any,
  ): Promise<MovimientoPreview[]> {
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id: campeonatoId },
    });
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado');

    if (
      usuario.role === 'directivo_liga' &&
      usuario.ligaId !== campeonato.ligaId
    ) {
      throw new ForbiddenException('No tienes permisos sobre este campeonato');
    }

    const categorias = await this.categoriasRepository.find({
      where: { campeonatoId, activo: true },
      order: { orden: 'ASC' } as any,
    });

    const movimientos: MovimientoPreview[] = [];

    for (const categoria of categorias) {
      const tabla = await this.tablaPosicionesService.calcular(
        campeonatoId,
        categoria.id,
        etapa,
      );
      if (tabla.length === 0) continue;

      // ── Descensos: los últimos N de esta categoría → categoría inferior (orden + 1) ──
      if (categoria.equiposDescienden > 0) {
        const inferior = categorias.find((c) => c.orden === categoria.orden + 1);
        const bajando = tabla.slice(
          Math.max(0, tabla.length - categoria.equiposDescienden),
        );
        for (const fila of bajando) {
          movimientos.push({
            equipoId: fila.equipoId,
            equipoNombre: fila.equipoNombre,
            categoriaOrigenId: categoria.id,
            categoriaOrigenNombre: categoria.nombre,
            categoriaDestinoId: inferior?.id ?? null,
            categoriaDestinoNombre: inferior?.nombre ?? '⚠️ Sin categoría inferior',
            motivo: 'descenso',
            posicion: fila.posicion,
            advertencia: inferior ? undefined : 'No existe categoría inferior configurada',
          });
        }
      }

      // ── Ascensos: los primeros N de esta categoría → categoría superior (orden - 1) ──
      if (categoria.equiposAscienden > 0) {
        const superior = categorias.find((c) => c.orden === categoria.orden - 1);
        const subiendo = tabla.slice(0, categoria.equiposAscienden);
        for (const fila of subiendo) {
          movimientos.push({
            equipoId: fila.equipoId,
            equipoNombre: fila.equipoNombre,
            categoriaOrigenId: categoria.id,
            categoriaOrigenNombre: categoria.nombre,
            categoriaDestinoId: superior?.id ?? null,
            categoriaDestinoNombre: superior?.nombre ?? '⚠️ Sin categoría superior',
            motivo: 'ascenso',
            posicion: fila.posicion,
            advertencia: superior ? undefined : 'No existe categoría superior configurada',
          });
        }
      }
    }

    return movimientos;
  }

  /**
   * Procesa en lote los ascensos y descensos al finalizar la temporada.
   *
   * Para cada movimiento del preview:
   * 1. Marca la inscripción 'confirmada' del equipo como 'transferida'.
   * 2. Crea una nueva inscripción 'confirmada' en la categoría destino.
   *
   * Al finalizar cambia el estado del campeonato a 'finalizado'.
   */
  async procesarAscensosDescensos(
    campeonatoId: number,
    etapa: string,
    usuario: any,
  ): Promise<{
    procesados: number;
    saltados: number;
    detalle: MovimientoPreview[];
  }> {
    if (usuario.role !== 'master' && usuario.role !== 'directivo_liga') {
      throw new ForbiddenException(
        'Solo master o directivo_liga pueden procesar ascensos y descensos',
      );
    }

    const movimientos = await this.previewAscensosDescensos(
      campeonatoId,
      etapa,
      usuario,
    );

    let procesados = 0;
    let saltados = 0;
    const procesadosIds = new Set<number>(); // equipoIds ya procesados en esta llamada

    for (const mov of movimientos) {
      // Omitir si no hay categoría destino válida
      if (!mov.categoriaDestinoId) {
        saltados++;
        continue;
      }

      // Evitar doble procesamiento del mismo equipo
      if (procesadosIds.has(mov.equipoId)) {
        saltados++;
        continue;
      }

      // Buscar inscripción confirmada actual
      const inscripcionActual = await this.inscripcionesRepository.findOne({
        where: {
          campeonatoId,
          equipoId: mov.equipoId,
          estado: 'confirmada',
          activo: true,
        },
      });

      if (!inscripcionActual) {
        saltados++;
        continue;
      }

      // 1. Marcar como transferida
      inscripcionActual.estado = 'transferida';
      inscripcionActual.motivo = mov.motivo;
      inscripcionActual.categoriaOrigenId = mov.categoriaOrigenId;
      await this.inscripcionesRepository.save(inscripcionActual);

      // 2. Crear nueva inscripción confirmada en destino
      const nueva = this.inscripcionesRepository.create({
        campeonatoId,
        equipoId: mov.equipoId,
        categoriaId: mov.categoriaDestinoId,
        estado: 'confirmada',
        fechaInscripcion: new Date(),
        observaciones: `Procesado automáticamente: ${mov.motivo} desde ${mov.categoriaOrigenNombre}`,
        motivo: null,
        categoriaOrigenId: null,
        activo: true,
      });
      await this.inscripcionesRepository.save(nueva);

      procesadosIds.add(mov.equipoId);
      procesados++;
    }

    // Cambiar campeonato a finalizado
    await this.campeonatosRepository.update(campeonatoId, {
      estado: 'finalizado',
    });

    return { procesados, saltados, detalle: movimientos };
  }
}
