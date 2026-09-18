import { Controller, Post, Body, Get, Put, Query, Param, ParseIntPipe } from '@nestjs/common';
import { CalidadService } from './calidad.service';

@Controller('api/calidad')
export class CalidadController {
  constructor(private readonly calidadService: CalidadService) {}

  @Get('obtenerParametros')
  async obtenerParametros() {
    const result = await this.calidadService.obtenerParametrosCalidad();
    return { success: true, data: result };
  }

  @Get('obtenerMuestras')
  async obtenerMuestras(){
    const result = await this.calidadService.obtenerTodasLasMuestras();
    return {success: true, data: result}
  }

    @Get(':muestraID/especificaciones')
  async buscarEspecificacionesMuestra(
    @Param('muestraID', ParseIntPipe) muestraID: number,
  ) {
    return await this.calidadService.buscarEspecificacionesMuestra(muestraID);
  }

    @Get('obtenerMuestrasDictaminadas')
  async obtenerMuestrasDictaminadas(){
    const result = await this.calidadService.obtenerTodasMuestrasConDictamen();
    return {success: true, data: result}
  }


@Post('crearResultado')
async crearResultado(@Body() body: any) {
  return this.calidadService.crearResultadosMuestraCalidad(body);
}

    @Post('agregarEspecifi')
  async crearVenta(@Body() body: any) {
    return this.calidadService.agregarEspecifProduct(body);
  }

// Opción A: Pasar el body directo si la función del servicio espera { idMuestra, dictamen }
@Put('actualizarEstadoMuestra')
async actualizarEstadoMuestra(@Body() body: { idMuestra: number; dictamen: string; tipoMuestra: string; observaciones: string }) {
  return this.calidadService.actualizarEstadoMuestra(body);
}

@Get('buscarAnalistas')
  async buscarAnalistas(@Query('q') query: string) {
    // Si no enviaron término de búsqueda o está vacío, retornamos lista vacía
    if (!query || query.trim() === '') {
      return { success: true, analistas: [] };
    }

    return await this.calidadService.buscarAnalistas(query.trim());
  }
  

}