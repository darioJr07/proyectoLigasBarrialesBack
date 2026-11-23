import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../auth/entities/usuario.entity';
import { Notificacion } from './entities/notificacion.entity';

export interface CrearNotificacionInput {
  tipo: string;
  titulo: string;
  mensaje: string;
  ligaId?: number | null;
  equipoId?: number | null;
  ruta?: string | null;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  claveEvento?: string | null;
  excluirUsuarioId?: number | null;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionesRepo: Repository<Notificacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  async listar(usuario: any, filtros: {
    estado?: string;
    tipo?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const usuarioId = this.obtenerUsuarioId(usuario);
    const page = Math.max(1, Number(filtros.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filtros.limit) || 20));
    const query = this.notificacionesRepo.createQueryBuilder('notificacion')
      .where('notificacion.usuario_id = :usuarioId', { usuarioId });

    if (filtros.estado === 'leidas') query.andWhere('notificacion.leida = true');
    if (filtros.estado === 'no_leidas') query.andWhere('notificacion.leida = false');
    if (filtros.tipo?.trim()) {
      query.andWhere('notificacion.tipo = :tipo', { tipo: filtros.tipo.trim() });
    }

    const [items, total] = await query
      .orderBy('notificacion.creado_en', 'DESC')
      .addOrderBy('notificacion.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const noLeidas = await this.notificacionesRepo.count({
      where: { usuarioId, leida: false },
    });

    return { items, total, noLeidas, page, limit };
  }

  async contarNoLeidas(usuario: any) {
    const usuarioId = this.obtenerUsuarioId(usuario);
    return {
      noLeidas: await this.notificacionesRepo.count({ where: { usuarioId, leida: false } }),
    };
  }

  async marcarLeida(id: number, usuario: any): Promise<Notificacion> {
    const usuarioId = this.obtenerUsuarioId(usuario);
    const notificacion = await this.notificacionesRepo.findOne({ where: { id, usuarioId } });
    if (!notificacion) throw new NotFoundException('Notificación no encontrada');
    if (!notificacion.leida) {
      notificacion.leida = true;
      notificacion.fechaLectura = new Date();
      await this.notificacionesRepo.save(notificacion);
    }
    return notificacion;
  }

  async marcarTodasLeidas(usuario: any) {
    const usuarioId = this.obtenerUsuarioId(usuario);
    const resultado = await this.notificacionesRepo.createQueryBuilder()
      .update(Notificacion)
      .set({ leida: true, fechaLectura: new Date() })
      .where('usuario_id = :usuarioId', { usuarioId })
      .andWhere('leida = false')
      .execute();
    return { actualizadas: resultado.affected ?? 0 };
  }

  async notificarAdministradoresLiga(input: CrearNotificacionInput): Promise<number> {
    if (!input.ligaId) return 0;
    try {
      const usuarios = await this.usuariosRepo.createQueryBuilder('usuario')
        .innerJoinAndSelect('usuario.rol', 'rol')
        .where('usuario.activo = true')
        .andWhere('(rol.nombre = :master OR (rol.nombre = :directivo AND usuario.liga_id = :ligaId))', {
          master: 'master',
          directivo: 'directivo_liga',
          ligaId: input.ligaId,
        })
        .getMany();
      return this.crearParaUsuarios(usuarios, input);
    } catch (error) {
      this.registrarError(error, input);
      return 0;
    }
  }

  async notificarEquipo(equipoId: number, input: CrearNotificacionInput): Promise<number> {
    try {
      const usuarios = await this.usuariosRepo.createQueryBuilder('usuario')
        .innerJoinAndSelect('usuario.rol', 'rol')
        .where('usuario.activo = true')
        .andWhere('rol.nombre = :rol', { rol: 'dirigente_equipo' })
        .andWhere('usuario.equipo_id = :equipoId', { equipoId })
        .getMany();
      return this.crearParaUsuarios(usuarios, { ...input, equipoId });
    } catch (error) {
      this.registrarError(error, input);
      return 0;
    }
  }

  async notificarEquipos(equipoIds: number[], input: CrearNotificacionInput): Promise<number> {
    let creadas = 0;
    for (const equipoId of [...new Set(equipoIds.filter(Boolean))]) {
      creadas += await this.notificarEquipo(equipoId, input);
    }
    return creadas;
  }

  private async crearParaUsuarios(
    usuarios: Usuario[],
    input: CrearNotificacionInput,
  ): Promise<number> {
    const destinatarios = usuarios.filter((usuario) => usuario.id !== input.excluirUsuarioId);
    if (!destinatarios.length) return 0;
    const valores = destinatarios.map((usuario) => ({
      usuarioId: usuario.id,
      ligaId: input.ligaId ?? usuario.ligaId ?? null,
      equipoId: input.equipoId ?? usuario.equipoId ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje,
      ruta: input.ruta ?? null,
      referenciaTipo: input.referenciaTipo ?? null,
      referenciaId: input.referenciaId ?? null,
      claveEvento: input.claveEvento ? `${input.claveEvento}:u${usuario.id}` : null,
      leida: false,
      fechaLectura: null,
    }));
    const resultado = await this.notificacionesRepo.createQueryBuilder()
      .insert()
      .into(Notificacion)
      .values(valores)
      .orIgnore()
      .execute();
    return resultado.identifiers.length;
  }

  private obtenerUsuarioId(usuario: any): number {
    return Number(usuario?.userId ?? usuario?.id);
  }

  private registrarError(error: unknown, input: CrearNotificacionInput): void {
    const mensaje = error instanceof Error ? error.message : String(error);
    this.logger.error(`No se pudo registrar la notificación ${input.tipo}: ${mensaje}`);
  }
}
