import { Global, Module } from '@nestjs/common';
import { EventsGateway } from '../events.gateway';
import { TrazabilidadService } from './trazabilidad.service';
import { TrazabilidadController } from './trazabilidad.controller';
@Global()
@Module({ providers: [EventsGateway, TrazabilidadService], exports: [EventsGateway, TrazabilidadService], controllers: [TrazabilidadController] })
export class TrazabilidadModule {}
