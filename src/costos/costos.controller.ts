import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { CostosService } from './costos.service';

@Controller('api/costos')
@UseGuards(AuthGuard)
@Areas('costos')
export class CostosController {
  constructor(private readonly costos: CostosService) {}

  @Get('formulas')
  formulas() {
    return this.costos.formulas();
  }

  @Post('formulas/:id/precio')
  emitirPrecio(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    return this.costos.emitirPrecio(id, body, req.usuario);
  }
}
