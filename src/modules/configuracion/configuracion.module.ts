import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionSistema } from './entities/configuracion-sistema.entity';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';
import { ModuloHabilitadoGuard } from './guards/modulo-habilitado.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionSistema])],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, ModuloHabilitadoGuard],
  exports: [ConfiguracionService, ModuloHabilitadoGuard],
})
export class ConfiguracionModule {}
