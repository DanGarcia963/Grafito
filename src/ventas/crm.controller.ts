import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import type { Usuario } from '../auth/auth.service';
import { CrmService } from './crm.service';

@Controller('api/ventas/crm/oportunidades')
@UseGuards(AuthGuard)
@Areas('ventas')
export class CrmController {
  constructor(private readonly crm: CrmService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  listar(
    @Req() req: { usuario: Usuario },
    @Query() query: Record<string, unknown>,
  ) {
    return this.crm.listar(req.usuario, query);
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detalle(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { usuario: Usuario },
  ) {
    return this.crm.detalle(id, req.usuario);
  }
  @Post(':id/seguimiento')
  guardar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() req: { usuario: Usuario },
  ) {
    return this.crm.guardar(id, body, req.usuario);
  }
}
