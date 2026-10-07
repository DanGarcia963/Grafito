import { UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import { CrmService } from './crm.service';
import { idValido } from '../investigacion/id.logic';
import { VentasService } from './ventas.service';

@UseGuards(AuthGuard)
@Areas('ventas', 'produccion', 'calidad')
@Controller('api/ventas')
export class VentasController {
  constructor(
    private readonly ventasService: VentasService,
    private readonly crm: CrmService,
  ) {}

  @Areas('ventas')
  @Post('crear')
  async crearVenta(@Body() body: any, @Req() req: any) {
    return this.crm.confirmar(idValido(body.oportunidad_id), body, req.usuario);
  }

  @Get('test')
  async test(@Req() req: any) {
    return this.ventasService.obtenerTodasLasOrdenes(req.usuario);
  }
}
