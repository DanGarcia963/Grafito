import { AuthModule } from './auth/auth.module';
import { InvestigacionModule } from './investigacion/id.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TrazabilidadModule } from './trazabilidad/trazabilidad.module';
import { LotesProducer } from './lotes.producer';
import { LotesProcessor } from './lotes.processor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { VentasModule } from './ventas/ventas.module';

import { CalidadModule } from './calidad/calidad.module';
import { ProductionModule} from './production/production.module';


@Module({
imports: [AuthModule, TrazabilidadModule, InvestigacionModule,
    BullModule.forRoot({
      connection: {
        host: '127.0.0.1', // Usar 127.0.0.1 explicitamente en lugar de 'localhost'
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'cola-lotes',
    }),VentasModule, ProductionModule, CalidadModule ,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, LotesProducer, LotesProcessor],
})
export class AppModule {}