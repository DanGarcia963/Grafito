import { Module } from '@nestjs/common';
import { CostosController } from './costos.controller';
import { CostosService } from './costos.service';

@Module({
  controllers: [CostosController],
  providers: [CostosService],
})
export class CostosModule {}
