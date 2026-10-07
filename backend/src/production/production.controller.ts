import { UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Query,
  Req,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { ProductionService } from './production.service';

@UseGuards(AuthGuard)
@Areas('produccion', 'calidad')
@Controller('api/produccion')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Areas('produccion', 'calidad', 'ventas') @Get('catalogos') catalogos() {
    return this.productionService.catalogos();
  }
  @Areas('produccion') @Get('existencias') stock() {
    return this.productionService.stock();
  }
  @Areas('produccion') @Post('ordenes') crearOrden(
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.productionService.crearOrden(b, r.usuario);
  }
  @Areas('produccion') @Post('lotes') iniciar(@Body() b: any, @Req() r: any) {
    return this.productionService.iniciarLote(b, r.usuario);
  }
  @Areas('produccion') @Post('lotes/:id/descargar') descargar(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.productionService.descargar(id, b, r.usuario);
  }
  @Areas('produccion') @Post('ubicaciones') ubicacion(@Body() b: any) {
    return this.productionService.ubicacion(b);
  }
  @Areas('produccion') @Post('recepciones') recibirMaterial(
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.productionService.recibirMaterial(b, r.usuario);
  }
  @Areas('produccion') @Post('ordenes/:id/vincular-venta') vincular(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.productionService.vincularVenta(id, b, r.usuario);
  }
  @Areas('produccion') @Post('inventario/:id/rezagado') rezagado(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.productionService.marcarRezagado(id, b, r.usuario);
  }
  @Areas('produccion') @Post('ordenes/:id/cerrar') cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.productionService.cerrarOrden(id, b, r.usuario);
  }
  @Get('test')
  async test() {
    return this.productionService.obtenerTodasLasOrdenesGrafito();
  }

  @Get('tanques')
  async getTanques(@Query('tipo') tipo: string) {
    return this.productionService.tanquesAreaProduccion(tipo);
  }

  @Areas('produccion')
  @Put('actualizar')
  async actualizar(
    @Body() body: { idLoteProduccion: number; tanqueId: number | null },
  ) {
    const result = await this.productionService.actualizarTanque(body);

    return {
      success: true,
      data: result,
    };
  }

  @Areas('produccion')
  @Put('actualizarEstatusTanque')
  async actualizarEstatusTanque(
    @Body()
    body: {
      tanqueId: number;
      estatus_proceso: string;
      idVentaOrigen?: number;
    },
  ) {
    const result = await this.productionService.actualizarEstatusTanque(body);

    return {
      success: true,
      data: result,
    };
  }

  @Areas('calidad')
  @Put('actualizarEstatusCalidad')
  async actualizarEstatusCalidad(
    @Body() body: { idLoteProduccion: number; estadoCalidad: 'LIBERADO' },
  ) {
    const result = await this.productionService.actualizarEstatusCalidad(body);

    return {
      success: true,
      data: result,
    };
  }

  // NUEVO ENDPOINT
  @Post('guardarBitacora')
  async guardarBitacora(
    @Body() body: { idLoteProduccion: number; registro: any },
  ) {
    const result = await this.productionService.agregarRegistroBitacora(body);

    return {
      success: true,
      data: result,
    };
  }
}
