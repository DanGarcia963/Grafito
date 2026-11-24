import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { PortalClienteService } from './portal-cliente.service';

@UseGuards(AuthGuard)
@Areas('cliente', 'produccion')
@Controller('api/portal-cliente')
export class PortalClienteController {
  constructor(private readonly portal: PortalClienteService) {}

  @Get('clientes')
  @Areas('produccion')
  @Header('Cache-Control', 'private, no-store')
  clientes() {
    return this.portal.clientes();
  }

  @Get('entregas-semanales')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  entregasSemanales(@Req() req: any, @Query() query: {
    clienteId?: string; anio?: string;
  }) {
    return this.portal.entregasSemanales(req.usuario, query);
  }

  @Get('resumen')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  resumen(@Req() req: any, @Query() query: {
    clienteId?: string; desde?: string; hasta?: string;
  }) {
    return this.portal.resumen(req.usuario, query);
  }
}
