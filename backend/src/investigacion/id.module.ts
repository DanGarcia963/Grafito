import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InvestigacionService } from './id.service';
import { InvestigacionController } from './id.controller';
@Module({providers:[PrismaService,InvestigacionService],controllers:[InvestigacionController]})
export class InvestigacionModule {}
