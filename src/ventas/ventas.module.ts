import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
import { CorreoModule } from '../correo/correo.module';

@Module({
  imports: [CorreoModule],
  controllers: [VentasController, CrmController],
  providers: [VentasService, CrmService],
})
export class VentasModule {}
