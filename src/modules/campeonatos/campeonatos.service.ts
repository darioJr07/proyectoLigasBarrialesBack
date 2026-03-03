import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campeonato } from './entities/campeonato.entity';
import { CreateCampeonatoDto } from './dto/create-campeonato.dto';
import { UpdateCampeonatoDto } from './dto/update-campeonato.dto';

@Injectable()
export class CampeonatosService {
  constructor(
    @InjectRepository(Campeonato)
    private campeonatosRepository: Repository<Campeonato>,
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
    return await this.campeonatosRepository.save(campeonato);
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
}
