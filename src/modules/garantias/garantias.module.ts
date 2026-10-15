import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GarantiaEquipo } from './entities/garantia-equipo.entity';
import { PrestamoFondo } from './entities/prestamo-fondo.entity';
import { MovimientoTesoreria } from '../tesoreria/entities/movimiento-tesoreria.entity';
import { GarantiasService } from './garantias.service';
import { GarantiasController } from './garantias.controller';
import { RecibosTesoreriaModule } from '../recibos-tesoreria/recibos-tesoreria.module';
import { CierreCajaControlModule } from '../tesoreria/cierre-caja-control.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GarantiaEquipo, PrestamoFondo, MovimientoTesoreria]),
    RecibosTesoreriaModule,
    CierreCajaControlModule,
  ],
  controllers: [GarantiasController],
  providers: [GarantiasService],
  exports: [GarantiasService],
})
export class GarantiasModule {}
