import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Derrama } from './entities/derrama.entity';
import { DerramaEquipo } from './entities/derrama-equipo.entity';
import { MovimientoTesoreria } from '../tesoreria/entities/movimiento-tesoreria.entity';
import { DerramasService } from './derramas.service';
import { DerramasController } from './derramas.controller';
import { RecibosTesoreriaModule } from '../recibos-tesoreria/recibos-tesoreria.module';
import { CierreCajaControlModule } from '../tesoreria/cierre-caja-control.module';

@Module({
  imports: [
    // Registramos las entidades propias + MovimientoTesoreria del módulo de tesorería.
    // Importar directamente la entidad evita dependencia circular con TesoreriaModule.
    TypeOrmModule.forFeature([Derrama, DerramaEquipo, MovimientoTesoreria]),
    RecibosTesoreriaModule,
    CierreCajaControlModule,
  ],
  controllers: [DerramasController],
  providers: [DerramasService],
  // Exportamos el servicio para que CampeonatosModule y TesoreriaModule lo usen
  exports: [DerramasService],
})
export class DerramasModule {}
