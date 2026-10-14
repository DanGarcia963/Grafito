import { Module } from '@nestjs/common';
import { SeguridadController } from './seguridad.controller';
import { SeguridadService } from './seguridad.service';
import { AlertasVencimientoService } from './alertas-vencimiento.service';

@Module({
  controllers: [SeguridadController],
  providers: [SeguridadService, AlertasVencimientoService],
})
export class SeguridadModule {}
