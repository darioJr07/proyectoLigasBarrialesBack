import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SolicitudesHorarioService } from './solicitudes-horario.service';

describe('SolicitudesHorarioService', () => {
  const dto = {
    campeonatoId: 10,
    categoriaId: 5,
    etapa: 'segunda_etapa',
    equipoId: 20,
    partidoId: 100,
    fechaSolicitada: '2026-11-01',
    horaSolicitada: '10:00',
    motivo: 'Derecho reglamentario de la etapa',
  };

  function construir(vigente: any = null) {
    const solicitudes = {
      findOne: jest.fn().mockResolvedValue(vigente),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => ({ id: 1, ...data })),
    };
    const partidos = {
      findOne: jest.fn().mockResolvedValue({
        id: 100, campeonatoId: 10, categoriaId: 5, etapa: 'segunda_etapa',
        equipoLocalId: 20, equipoVisitanteId: 30, estado: 'programado',
        fechaPartido: null, horaPartido: null, activo: true,
      }),
    };
    const campeonatos = { findOne: jest.fn().mockResolvedValue({ id: 10, ligaId: 2, activo: true }) };
    return { service: new SolicitudesHorarioService(solicitudes as any, partidos as any, campeonatos as any) };
  }

  it('registra una solicitud pendiente para el equipo del dirigente', async () => {
    const { service } = construir();
    const resultado = await service.crear(dto, { id: 7, role: 'dirigente_equipo', ligaId: 2, equipoId: 20 });
    expect(resultado).toEqual(expect.objectContaining({ estado: 'pendiente', equipoId: 20, partidoId: 100 }));
  });

  it('impide que un dirigente solicite por otro equipo', async () => {
    const { service } = construir();
    await expect(service.crear(dto, { id: 7, role: 'dirigente_equipo', ligaId: 2, equipoId: 30 }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impide una segunda solicitud vigente para el mismo equipo y etapa', async () => {
    const { service } = construir({ id: 9, estado: 'aprobada' });
    await expect(service.crear(dto, { id: 2, role: 'directivo_liga', ligaId: 2 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite al directivo aprobar una solicitud pendiente', async () => {
    const solicitud: any = { id: 4, ...dto, ligaId: 2, estado: 'pendiente' };
    const solicitudes = { findOne: jest.fn().mockResolvedValue(solicitud), save: jest.fn(async (data: any) => data) };
    const partidos = { findOne: jest.fn().mockResolvedValue({ id: 100, estado: 'programado', fechaPartido: null, horaPartido: null }) };
    const campeonatos = { findOne: jest.fn().mockResolvedValue({ id: 10, ligaId: 2, activo: true }) };
    const service = new SolicitudesHorarioService(solicitudes as any, partidos as any, campeonatos as any);
    const resultado = await service.resolver(4, { decision: 'aprobar' }, { id: 2, role: 'directivo_liga', ligaId: 2 });
    expect(resultado.estado).toBe('aprobada');
    expect(resultado.resueltoPor).toBe(2);
  });
});
