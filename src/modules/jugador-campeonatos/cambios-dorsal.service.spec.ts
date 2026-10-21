import { BadRequestException } from '@nestjs/common';
import { CambiosDorsalService } from './cambios-dorsal.service';

describe('CambiosDorsalService', () => {
  let service: CambiosDorsalService;
  let cambioRepo: Record<string, jest.Mock>;
  let habilitacionRepo: Record<string, jest.Mock>;
  let etapaRepo: Record<string, jest.Mock>;
  let partidoRepo: Record<string, jest.Mock>;

  const habilitacion = {
    id: 5,
    campeonatoId: 2,
    categoriaId: 3,
    equipoId: 4,
    numeroCancha: 10,
    estado: 'habilitado',
    activo: true,
    campeonato: { id: 2, ligaId: 9 },
    jugador: { id: 8, nombre: 'Jugador Uno' },
    equipo: { id: 4, nombre: 'Equipo Uno' },
    categoria: { id: 3, nombre: 'Máxima' },
  };
  const etapa = {
    id: 7,
    campeonatoId: 2,
    categoriaId: 3,
    nombre: 'segunda_etapa',
    orden: 2,
    estado: 'actual',
    activo: true,
  };

  beforeEach(() => {
    cambioRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(valor => valor),
      save: jest.fn(async valor => ({ id: 20, ...valor, etapa })),
    };
    habilitacionRepo = {
      find: jest.fn().mockResolvedValue([habilitacion]),
      findOne: jest.fn().mockResolvedValue(habilitacion),
    };
    etapaRepo = {
      find: jest.fn().mockResolvedValue([etapa]),
      findOne: jest.fn().mockResolvedValue(etapa),
      create: jest.fn(valor => valor),
      save: jest.fn(async valor => ({ id: 7, ...valor })),
    };
    partidoRepo = { find: jest.fn().mockResolvedValue([]) };
    service = new CambiosDorsalService(
      cambioRepo as any,
      habilitacionRepo as any,
      etapaRepo as any,
      partidoRepo as any,
    );
  });

  it('mantiene el dorsal original antes de la vigencia y usa el nuevo desde la jornada indicada', async () => {
    cambioRepo.find.mockResolvedValue([{
      jugadorCampeonatoId: 5,
      etapaCompetenciaId: 7,
      numeroCancha: 18,
      jornadaDesde: 2,
      activo: true,
    }]);

    const jornadaUno = await service.resolverNumerosParaContexto(
      [habilitacion as any],
      'segunda_etapa',
      1,
    );
    const jornadaDos = await service.resolverNumerosParaContexto(
      [habilitacion as any],
      'segunda_etapa',
      2,
    );

    expect(jornadaUno.get(5)).toBe(10);
    expect(jornadaDos.get(5)).toBe(18);
  });

  it('registra el cambio desde la jornada 2 cuando ya se jugó la jornada 1', async () => {
    partidoRepo.find.mockResolvedValue([
      { etapa: 'segunda_etapa', jornada: 1, estado: 'jugado' },
      { etapa: 'segunda_etapa', jornada: 2, estado: 'programado' },
    ]);

    const resultado = await service.registrar(5, {
      etapaCompetenciaId: 7,
      numeroCancha: 18,
      jornadaDesde: 2,
      motivo: 'Cambio reglamentario',
    }, { role: 'directivo_liga', ligaId: 9, userId: 11 });

    expect(resultado).toEqual(expect.objectContaining({
      numeroCancha: 18,
      jornadaDesde: 2,
      registradoPor: 11,
    }));
  });

  it('bloquea el cambio cuando la tercera jornada ya fue jugada', async () => {
    partidoRepo.find.mockResolvedValue([
      { etapa: 'segunda_etapa', jornada: 3, estado: 'jugado' },
    ]);

    await expect(service.registrar(5, {
      etapaCompetenciaId: 7,
      numeroCancha: 18,
      jornadaDesde: 3,
      motivo: 'Fuera de plazo',
    }, { role: 'directivo_liga', ligaId: 9, userId: 11 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('recupera las etapas de fixtures antiguos cuando aún no están configuradas', async () => {
    etapaRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([etapa]);
    partidoRepo.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ nombre: 'segunda_etapa' }]),
    }));

    const opciones = await service.obtenerOpciones(
      5,
      { role: 'directivo_liga', ligaId: 9, userId: 11 },
    );

    expect(etapaRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'segunda_etapa',
      estado: 'actual',
      activo: true,
    }));
    expect(opciones.etapas).toHaveLength(1);
  });

  it('libera el dorsal original desde la jornada en que inicia el cambio', async () => {
    habilitacionRepo.find.mockResolvedValue([habilitacion]);
    partidoRepo.find.mockResolvedValue([
      { etapa: 'segunda_etapa', jornada: 1, estado: 'jugado' },
      { etapa: 'segunda_etapa', jornada: 2, estado: 'programado' },
    ]);
    cambioRepo.find.mockResolvedValue([{
      jugadorCampeonatoId: 5,
      etapaCompetenciaId: 7,
      numeroCancha: 22,
      jornadaDesde: 2,
      activo: true,
    }]);

    await expect(service.validarDorsalParaHabilitacion({
      campeonatoId: 2,
      categoriaId: 3,
      equipoId: 4,
      numeroCancha: 10,
    })).resolves.toBeUndefined();
  });

  it('reserva el nuevo dorsal desde su jornada de vigencia', async () => {
    habilitacionRepo.find.mockResolvedValue([habilitacion]);
    partidoRepo.find.mockResolvedValue([
      { etapa: 'segunda_etapa', jornada: 1, estado: 'jugado' },
      { etapa: 'segunda_etapa', jornada: 2, estado: 'programado' },
    ]);
    cambioRepo.find.mockResolvedValue([{
      jugadorCampeonatoId: 5,
      etapaCompetenciaId: 7,
      numeroCancha: 22,
      jornadaDesde: 2,
      activo: true,
    }]);

    await expect(service.validarDorsalParaHabilitacion({
      campeonatoId: 2,
      categoriaId: 3,
      equipoId: 4,
      numeroCancha: 22,
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
