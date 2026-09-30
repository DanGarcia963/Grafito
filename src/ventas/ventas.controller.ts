import { UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { Controller, Post, Body, Get } from '@nestjs/common';
import { VentasService } from './ventas.service';

@UseGuards(AuthGuard)
@Areas('ventas', 'produccion', 'calidad')
@Controller('api/ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Areas('ventas')
  @Post('crear')
  async crearVenta(@Body() body: any) {
    return this.ventasService.crearOrdenVenta(body);
  }

 @Get('test')
  async test() {
    return this.ventasService.obtenerTodasLasOrdenes();
  }
}