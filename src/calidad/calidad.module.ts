import { Module } from '@nestjs/common';
import { CalidadController } from './calidad.controller';
import { CalidadService } from './calidad.service';

@Module({
  controllers: [CalidadController],
  providers: [CalidadService],
})
export class CalidadModule {}