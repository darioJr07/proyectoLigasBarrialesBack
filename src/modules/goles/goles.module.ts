import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gol } from './entities/gol.entity';
import { GolesService } from './goles.service';
import { GolesController } from './goles.controller';

/**
 * Módulo de Goles
 *
 * Se exporta GolesService para que PartidosModule pueda inyectarlo
 * y registrar los goles al guardar un resultado.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Gol])],
  controllers: [GolesController],
  providers: [GolesService],
  exports: [GolesService],
})
export class GolesModule {}
