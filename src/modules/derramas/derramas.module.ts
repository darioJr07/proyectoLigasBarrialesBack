import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Derrama } from './entities/derrama.entity';
import { DerramaEquipo } from './entities/derrama-equipo.entity';
import { MovimientoTesoreria } from '../tesoreria/entities/movimiento-tesoreria.entity';
import { DerramasService } from './derramas.service';
import { DerramasController } from './derramas.controller';

@Module({
  imports: [
    // Registramos las entidades propias + MovimientoTesoreria del módulo de tesorería.
    // Importar directamente la entidad evita dependencia circular con TesoreriaModule.
    TypeOrmModule.forFeature([Derrama, DerramaEquipo, MovimientoTesoreria]),
  ],
  controllers: [DerramasController],
  providers: [DerramasService],
  // Exportamos el servicio para que CampeonatosModule y TesoreriaModule lo usen
  exports: [DerramasService],
})
export class DerramasModule {}
