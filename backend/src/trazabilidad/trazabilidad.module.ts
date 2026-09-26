import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { TrazabilidadService } from './trazabilidad.service';
import { TrazabilidadController } from './trazabilidad.controller';
@Global()
@Module({ providers: [PrismaService, EventsGateway, TrazabilidadService], exports: [EventsGateway, TrazabilidadService], controllers: [TrazabilidadController] })
export class TrazabilidadModule {}
