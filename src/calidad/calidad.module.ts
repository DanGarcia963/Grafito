import { Module } from '@nestjs/common';
import { CalidadController } from './calidad.controller';
import { CalidadService } from './calidad.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CalidadController],
  providers: [CalidadService, PrismaService],
})
export class CalidadModule {}