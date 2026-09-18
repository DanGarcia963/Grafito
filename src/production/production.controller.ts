import { Controller, Post, Body, Get, Put, Query } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller('api/produccion')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('test')
  async test() {
    return this.productionService.obtenerTodasLasOrdenesGrafito();
  }

  @Get('tanques')
  async getTanques(@Query('tipo') tipo: string) { // <-- CAMBIADO A @Query
    return this.productionService.tanquesAreaProduccion(tipo);
  }

  @Put('actualizar')
  async actualizar(@Body() body: { idLoteProduccion: number; tanqueId: number | null }) {
    const result = await this.productionService.actualizarTanque(body);
    return { success: true, data: result };
  }

  @Put('actualizarEstatusTanque')
  async actualizarEstatusTanque(@Body() body: { tanqueId: number; estatus_proceso: string, idVentaOrigen?: number }) {
    const result = await this.productionService.actualizarEstatusTanque(body);
    return { success: true, data: result };
  }

  @Put('actualizarEstatusCalidad')
  async actualizarEstatusCalidad(@Body() body: { idLoteProduccion: number; estadoCalidad: 'LIBERADO' }) {
    const result = await this.productionService.actualizarEstatusCalidad(body);
    return { success: true, data: result };
  }
}