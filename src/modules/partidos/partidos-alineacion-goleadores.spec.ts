import { BadRequestException } from '@nestjs/common';
import { PartidosService } from './partidos.service';

describe('PartidosService - goleadores contra alineacion', () => {
  const crearServicio = (alineacion: any[]) => {
    const actaRepository = { find: jest.fn().mockResolvedValue(alineacion) };
    const service = new PartidosService(
      {} as any,
      {} as any,
      actaRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return service as any;
  };

  const partido = { id: 50, equipoLocalId: 10, equipoVisitanteId: 20 };

  it('acepta como goleador a quien jugo y fue expulsado', async () => {
    const service = crearServicio([
      { partidoId: 50, jugadorId: 7, equipoId: 10, estado: 'expulsado', activo: true },
    ]);

    await expect(
      service.validarAutoresConAlineacion(partido, [
        { jugadorId: 7, equipoDelJugadorId: 10, tipo: 'normal' },
      ]),
    ).resolves.toBeUndefined();
  });

  it('rechaza como goleador a quien no jugo', async () => {
    const service = crearServicio([
      { partidoId: 50, jugadorId: 8, equipoId: 10, estado: 'no_jugo', activo: true },
    ]);

    await expect(
      service.validarAutoresConAlineacion(partido, [
        { jugadorId: 8, equipoDelJugadorId: 10, tipo: 'normal' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mantiene compatibilidad con partidos historicos sin planilla digital', async () => {
    const service = crearServicio([]);

    await expect(
      service.validarAutoresConAlineacion(partido, [
        { jugadorId: 9, equipoDelJugadorId: 10, tipo: 'normal' },
      ]),
    ).resolves.toBeUndefined();
  });
});
