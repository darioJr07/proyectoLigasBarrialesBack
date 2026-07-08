import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampeonatosService } from './campeonatos.service';
import { CampeonatosController } from './campeonatos.controller';
import { Campeonato } from './entities/campeonato.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { TablaPosicionesModule } from '../tabla-posiciones/tabla-posiciones.module';
import { DerramasModule } from '../derramas/derramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campeonato, Inscripcion, Categoria]),
    TablaPosicionesModule,
    DerramasModule,
  ],
  controllers: [CampeonatosController],
  providers: [CampeonatosService],
  exports: [CampeonatosService, TypeOrmModule],
})
export class CampeonatosModule implements OnModuleInit {
  constructor(private readonly campeonatosService: CampeonatosService) {}

  async onModuleInit() {
    // Ejecutar corrección de estados al iniciar la aplicación
    console.log('🔧 Ejecutando corrección automática de estados de campeonatos...');
    try {
      await this.campeonatosService.corregirEstadosInicial();
      console.log('✅ Corrección de estados completada');
    } catch (error) {
      console.error('❌ Error al corregir estados:', error.message);
    }
  }
}
