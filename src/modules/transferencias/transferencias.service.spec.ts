import { BadRequestException } from '@nestjs/common';
import { TransferenciasService } from './transferencias.service';
import { Transferencia } from './entities/transferencia.entity';
import { Jugador } from '../jugadores/entities/jugador.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { JugadorCampeonato } from '../jugador-campeonatos/entities/jugador-campeonato.entity';

describe('TransferenciasService - reglas criticas', () => {
  let service: TransferenciasService;
  let transferenciaRepo: Record<string, jest.Mock>;
  let jugadorRepo: Record<string, jest.Mock>;
  let campeonatoRepo: Record<string, jest.Mock>;
  let equipoRepo: Record<string, jest.Mock>;
  let habilitacionRepo: Record<string, jest.Mock>;
  let inscripcionRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    transferenciaRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn((value) => value),
    };
    jugadorRepo = { findOne: jest.fn() };
    campeonatoRepo = { findOne: jest.fn() };
    equipoRepo = { findOne: jest.fn() };
    habilitacionRepo = { findOne: jest.fn(), update: jest.fn() };
    inscripcionRepo = { findOne: jest.fn() };
    dataSource = { transaction: jest.fn() };

    service = new TransferenciasService(
      transferenciaRepo as any,
      jugadorRepo as any,
      campeonatoRepo as any,
      equipoRepo as any,
      habilitacionRepo as any,
      inscripcionRepo as any,
      dataSource as any,
    );
  });

  it('bloquea una segunda transferencia en proceso para el mismo jugador y campeonato', async () => {
    campeonatoRepo.findOne.mockResolvedValue({ id: 5, ligaId: 1, activo: true });
    jugadorRepo.findOne.mockResolvedValue({ id: 4, equipoId: 10, activo: true });
    equipoRepo.findOne
      .mockResolvedValueOnce({ id: 10, ligaId: 1, activo: true })
      .mockResolvedValueOnce({ id: 20, ligaId: 1, activo: true });
    inscripcionRepo.findOne.mockResolvedValue({ id: 30, estado: 'confirmada', activo: true });
    transferenciaRepo.findOne.mockResolvedValue({
      id: 90,
      jugadorId: 4,
      campeonatoId: 5,
      activo: true,
      estadoEquipoOrigen: 'pendiente',
      estadoDirectivo: 'pendiente',
    });

    await expect(
      service.create(
        { jugadorId: 4, campeonatoId: 5, equipoDestinoId: 20 },
        { role: 'dirigente_equipo', equipoId: 20, userId: 300 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transferenciaRepo.save).not.toHaveBeenCalled();
  });

  it('cambia de equipo y da de baja la ficha anterior dentro de la transaccion final', async () => {
    const inicial = {
      id: 90,
      jugadorId: 4,
      campeonatoId: 5,
      equipoOrigenId: 10,
      equipoDestinoId: 20,
      estadoEquipoOrigen: 'aprobado',
      estadoDirectivo: 'pendiente',
      activo: true,
      campeonato: { id: 5, ligaId: 1 },
    };
    const cargada = {
      ...inicial,
      estadoDirectivo: 'aprobado',
      jugador: { id: 4, equipoId: 20 },
    };
    transferenciaRepo.findOne
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce(cargada);

    const txTransferenciaRepo = {
      findOne: jest.fn().mockResolvedValue({ ...inicial }),
      save: jest.fn(async (value) => value),
    };
    const txJugadorRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 4, equipoId: 10, activo: true }),
      save: jest.fn(async (value) => value),
    };
    const txInscripcionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, estado: 'confirmada', activo: true }),
    };
    const txHabilitacionRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Transferencia) return txTransferenciaRepo;
        if (entity === Jugador) return txJugadorRepo;
        if (entity === Inscripcion) return txInscripcionRepo;
        if (entity === JugadorCampeonato) return txHabilitacionRepo;
        throw new Error('Repositorio inesperado');
      }),
    };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    await service.aprobarPorDirectivo(
      90,
      { observaciones: 'Aprobada' },
      { role: 'directivo_liga', ligaId: 1, userId: 200 },
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txJugadorRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, equipoId: 20 }),
    );
    expect(txHabilitacionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        jugadorId: 4,
        campeonatoId: 5,
        equipoId: 10,
        activo: true,
      }),
      expect.objectContaining({ activo: false, estado: 'baja' }),
    );
  });

  it('conserva una transferencia rechazada como historial activo', async () => {
    const pendiente = {
      id: 91,
      jugadorId: 4,
      campeonatoId: 5,
      equipoOrigenId: 10,
      equipoDestinoId: 20,
      estadoEquipoOrigen: 'pendiente',
      estadoDirectivo: 'pendiente',
      activo: true,
    };
    const rechazada = {
      ...pendiente,
      estadoEquipoOrigen: 'rechazado',
      observaciones: 'No autorizado',
    };
    transferenciaRepo.findOne
      .mockResolvedValueOnce({ ...pendiente })
      .mockResolvedValueOnce(rechazada);
    transferenciaRepo.save.mockImplementation(async (value) => value);

    const result = await service.rechazarPorEquipoOrigen(
      91,
      { observaciones: 'No autorizado' },
      { role: 'dirigente_equipo', equipoId: 10, userId: 301 },
    );

    expect(transferenciaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 91,
        estadoEquipoOrigen: 'rechazado',
        activo: true,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 91, activo: true }));
  });

  it('revierte la aprobacion final si el equipo destino ya no esta inscrito', async () => {
    const inicial = {
      id: 92,
      jugadorId: 4,
      campeonatoId: 5,
      equipoOrigenId: 10,
      equipoDestinoId: 20,
      estadoEquipoOrigen: 'aprobado',
      estadoDirectivo: 'pendiente',
      activo: true,
      campeonato: { id: 5, ligaId: 1 },
    };
    transferenciaRepo.findOne.mockResolvedValueOnce(inicial);

    const txTransferenciaRepo = {
      findOne: jest.fn().mockResolvedValue({ ...inicial }),
      save: jest.fn(async (value) => value),
    };
    const txJugadorRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 4, equipoId: 10, activo: true }),
      save: jest.fn(),
    };
    const txInscripcionRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const txHabilitacionRepo = { update: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Transferencia) return txTransferenciaRepo;
        if (entity === Jugador) return txJugadorRepo;
        if (entity === Inscripcion) return txInscripcionRepo;
        if (entity === JugadorCampeonato) return txHabilitacionRepo;
        throw new Error('Repositorio inesperado');
      }),
    };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    await expect(
      service.aprobarPorDirectivo(
        92,
        {},
        { role: 'directivo_liga', ligaId: 1, userId: 200 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(txJugadorRepo.save).not.toHaveBeenCalled();
    expect(txHabilitacionRepo.update).not.toHaveBeenCalled();
  });
});
