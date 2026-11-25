import { Module } from "@nestjs/common";

import { KpisController } from "./kpis.controller";
import { KpisService } from "./kpis.service";
import { KpisCapturaService } from "./kpis-captura.service";
import { KpisAccessGuard } from "./kpis-access.guard";
@Module({
  controllers: [KpisController],
  providers: [KpisService, KpisCapturaService, KpisAccessGuard],
  exports: [KpisService],
})
export class KpisModule {}
