import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigVocalia } from './entities/config-vocalia.entity';
import { CobroPartido } from './entities/cobro-partido.entity';
import { MovimientoTesoreria } from './entities/movimiento-tesoreria.entity';
import { InicioOperativoTesoreria } from './entities/inicio-operativo-tesoreria.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { DerramaEquipo } from '../derramas/entities/derrama-equipo.entity';
import { GarantiaEquipo } from '../garantias/entities/garantia-equipo.entity';
import { TesoreriaService } from './tesoreria.service';
import { TesoreriaController } from './tesoreria.controller';
import { DerramasModule } from '../derramas/derramas.module';
import { RecibosTesoreriaModule } from '../recibos-tesoreria/recibos-tesoreria.module';
import { CierreCajaTesoreria } from './entities/cierre-caja-tesoreria.entity';
import { CierreCajaControlModule } from './cierre-caja-control.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigVocalia,
      CobroPartido,
      MovimientoTesoreria,
      InicioOperativoTesoreria,
      Campeonato,
      DerramaEquipo,
      GarantiaEquipo,
      CierreCajaTesoreria,
    ]),
    DerramasModule,   // ← necesario para inyectar DerramasService en TesoreriaService
    RecibosTesoreriaModule,
    CierreCajaControlModule,
  ],
  controllers: [TesoreriaController],
  providers: [TesoreriaService],
  exports: [TesoreriaService],  // ← exportado para que InscripcionesModule lo use
})
export class TesoreriaModule {}
