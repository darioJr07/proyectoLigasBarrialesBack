import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReciboTesoreria } from './entities/recibo-tesoreria.entity';
import { RecibosTesoreriaController } from './recibos-tesoreria.controller';
import { RecibosTesoreriaService } from './recibos-tesoreria.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReciboTesoreria])],
  controllers: [RecibosTesoreriaController],
  providers: [RecibosTesoreriaService],
  exports: [RecibosTesoreriaService],
})
export class RecibosTesoreriaModule {}
