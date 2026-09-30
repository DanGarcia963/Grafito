import { Module } from '@nestjs/common';
import { InvestigacionService } from './id.service';
import { InvestigacionController } from './id.controller';
@Module({providers:[InvestigacionService],controllers:[InvestigacionController]})
export class InvestigacionModule {}
