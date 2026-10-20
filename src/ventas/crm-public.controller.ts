import { Body, Controller, Post } from '@nestjs/common';
import { CrmService } from './crm.service';

/// Acciones iniciadas por el cliente desde un enlace de respuesta de cotización.
/// El token de un solo uso sustituye la sesión interna, así que este controller
/// no debe recibir AuthGuard ni Areas.
@Controller('api/public/crm')
export class CrmPublicController {
  constructor(private readonly crm: CrmService) {}

  @Post('cotizaciones/responder') responderCotizacion(@Body() body: any) {
    return this.crm.responderCotizacion(body);
  }
}
