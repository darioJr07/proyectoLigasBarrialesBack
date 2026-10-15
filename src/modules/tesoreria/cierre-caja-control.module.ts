import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CierreCajaTesoreria } from './entities/cierre-caja-tesoreria.entity';
import { CierreCajaControlService } from './cierre-caja-control.service';

@Module({
  imports: [TypeOrmModule.forFeature([CierreCajaTesoreria])],
  providers: [CierreCajaControlService],
  exports: [CierreCajaControlService],
})
export class CierreCajaControlModule {}
