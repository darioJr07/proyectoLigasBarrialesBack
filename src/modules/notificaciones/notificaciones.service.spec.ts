import { NotFoundException } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  let notificacionesRepo: Record<string, jest.Mock>;
  let usuariosRepo: Record<string, jest.Mock>;
  let service: NotificacionesService;

  beforeEach(() => {
    notificacionesRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
    };
    usuariosRepo = { createQueryBuilder: jest.fn() };
    service = new NotificacionesService(notificacionesRepo as any, usuariosRepo as any);
  });

  it('lista exclusivamente las notificaciones del usuario autenticado', async () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1, usuarioId: 7 }], 1]),
    };
    notificacionesRepo.createQueryBuilder.mockReturnValue(query);
    notificacionesRepo.count.mockResolvedValue(1);

    const resultado = await service.listar(
      { userId: 7, role: 'master', ligaId: null, equipoId: null },
      { estado: 'no_leidas', page: 1, limit: 20 },
    );

    expect(query.where).toHaveBeenCalledWith(
      'notificacion.usuario_id = :usuarioId',
      { usuarioId: 7 },
    );
    expect(query.andWhere).toHaveBeenCalledWith('notificacion.leida = false');
    expect(notificacionesRepo.count).toHaveBeenCalledWith({
      where: { usuarioId: 7, leida: false },
    });
    expect(resultado).toMatchObject({ total: 1, noLeidas: 1 });
  });

  it('impide marcar como leida una notificacion de otro usuario', async () => {
    notificacionesRepo.findOne.mockResolvedValue(null);

    await expect(service.marcarLeida(30, { userId: 7 }))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(notificacionesRepo.findOne).toHaveBeenCalledWith({
      where: { id: 30, usuarioId: 7 },
    });
    expect(notificacionesRepo.save).not.toHaveBeenCalled();
  });

  it('incluye master sin liga y directivo de la liga como destinatarios administrativos', async () => {
    const usuariosQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, ligaId: null, equipoId: null, rol: { nombre: 'master' } },
        { id: 2, ligaId: 9, equipoId: null, rol: { nombre: 'directivo_liga' } },
      ]),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 10 }, { id: 11 }] }),
    };
    usuariosRepo.createQueryBuilder.mockReturnValue(usuariosQuery);
    notificacionesRepo.createQueryBuilder.mockReturnValue(insertQuery);

    const creadas = await service.notificarAdministradoresLiga({
      tipo: 'habilitacion_solicitada',
      titulo: 'Solicitud',
      mensaje: 'Nueva solicitud',
      ligaId: 9,
      claveEvento: 'habilitacion:20:solicitud',
    });

    expect(usuariosQuery.andWhere).toHaveBeenCalledWith(
      '(rol.nombre = :master OR (rol.nombre = :directivo AND usuario.liga_id = :ligaId))',
      { master: 'master', directivo: 'directivo_liga', ligaId: 9 },
    );
    expect(insertQuery.values).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ usuarioId: 1, ligaId: 9 }),
      expect.objectContaining({ usuarioId: 2, ligaId: 9 }),
    ]));
    expect(creadas).toBe(2);
  });
});
