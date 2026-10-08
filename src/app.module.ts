import { CostosModule } from './costos/costos.module';
import { SeguridadModule } from './seguridad/seguridad.module';
import { KpisModule } from './kpis/kpis.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { InvestigacionModule } from './investigacion/id.module';
import { TrazabilidadModule } from './trazabilidad/trazabilidad.module';
import { VentasModule } from './ventas/ventas.module';
import { CalidadModule } from './calidad/calidad.module';
import { ProductionModule } from './production/production.module';
import { LotesProducer } from './lotes.producer';
import { LotesProcessor } from './lotes.processor';
import { AppController } from './app.controller';
import { redisConnection } from './config/runtime';

const queueEnabled = process.env.REDIS_ENABLED === 'true';
@Module({
  imports: [SeguridadModule, KpisModule, PrismaModule, AuthModule, CostosModule, TrazabilidadModule, InvestigacionModule,
    VentasModule, ProductionModule, CalidadModule,
    ...(queueEnabled ? [BullModule.forRoot({ connection: redisConnection() }),
      BullModule.registerQueue({ name: 'cola-lotes' })] : []),
  ],
  controllers: [AppController],
  providers: queueEnabled ? [LotesProducer, LotesProcessor] : [],
})
export class AppModule {}
