import { Module } from '@nestjs/common';
import { TrazabilidadModule } from './trazabilidad/trazabilidad.module';
import { ManifiestosController } from './manifiestos.controller';
import { ManifiestosService } from './manifiestos.service';

@Module({
  imports: [TrazabilidadModule],
  controllers: [ManifiestosController],
  providers: [ManifiestosService],
})
export class ManifiestosModule {}
