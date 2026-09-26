import { UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { Controller, Get, Query } from '@nestjs/common';
import { TrazabilidadService } from './trazabilidad.service';
@UseGuards(AuthGuard)
@Areas('produccion', 'calidad')
@Controller('api/trazabilidad')
export class TrazabilidadController {
 constructor(private readonly tiempos: TrazabilidadService) {}
 @Get('tramos') consultar(@Query() q: { entidad?: string; id?: string; loteId?: string; desde?: string; hasta?: string; pagina?: string }) { return this.tiempos.consultar(q); }
 @Get('eventos') eventos(@Query('entidad') entidad: string, @Query('id') id: string) { return this.tiempos.historial(entidad, id); }
}
