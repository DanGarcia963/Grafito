import { Module } from '@nestjs/common';
import { LogisticaController } from './logistica.controller';
import { LogisticaService } from './logistica.service';
@Module({controllers:[LogisticaController],providers:[LogisticaService]})
export class LogisticaModule {}
