import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigVocalia } from './entities/config-vocalia.entity';
import { CobroPartido } from './entities/cobro-partido.entity';
import { MovimientoTesoreria } from './entities/movimiento-tesoreria.entity';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';
import { TesoreriaService } from './tesoreria.service';
import { TesoreriaController } from './tesoreria.controller';
import { DerramasModule } from '../derramas/derramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigVocalia, CobroPartido, MovimientoTesoreria, Campeonato]),
    DerramasModule,   // ← necesario para inyectar DerramasService en TesoreriaService
  ],
  controllers: [TesoreriaController],
  providers: [TesoreriaService],
  exports: [TesoreriaService],  // ← exportado para que InscripcionesModule lo use
})
export class TesoreriaModule {}
