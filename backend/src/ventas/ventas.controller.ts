import { Controller, Post, Body, Get } from '@nestjs/common';
import { VentasService } from './ventas.service';

@Controller('api/ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post('crear')
  async crearVenta(@Body() body: any) {
    return this.ventasService.crearOrdenVenta(body);
  }

 @Get('test')
  async test() {
    return this.ventasService.obtenerTodasLasOrdenes();
  }
}