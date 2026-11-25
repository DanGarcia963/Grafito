import {
  Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, Req,
  Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { LogisticaService } from './logistica.service';

@UseGuards(AuthGuard)
@Areas('logistica','almacen','produccion','calidad','ventas','contaduria','cliente')
@Controller('api/logistica')
export class LogisticaController {
  constructor(private readonly logistica: LogisticaService) {}

  @Areas('logistica','almacen','produccion','ventas','contaduria')
  @Get('catalogos')
  catalogos(@Req() r: any) { return this.logistica.catalogos(r.usuario); }

  @Areas('logistica','almacen','produccion','ventas')
  @Get('candidatos')
  candidatos(@Query('ovId',ParseIntPipe) ovId:number,@Req() r:any) {
    return this.logistica.candidatosEntrega(ovId,r.usuario);
  }

  @Areas('logistica','almacen','produccion','calidad')
  @Get('contenedores')
  @Header('Cache-Control','private, no-store')
  contenedores(@Req() r: any, @Query('loteId') loteId?: string) {
    return this.logistica.contenedores(r.usuario,loteId);
  }

  @Areas('almacen','calidad')
  @Post('contenedores/conciliar')
  conciliar(@Req() r: any, @Body() b: Record<string,unknown>) {
    return this.logistica.conciliarContenedores(b,r.usuario);
  }

  @Areas('logistica')
  @Post('vehiculos')
  vehiculo(@Req() r: any, @Body() b: Record<string,unknown>) {
    return this.logistica.vehiculoNuevo(b,r.usuario);
  }

  @Areas('logistica')
  @Post('viajes')
  viaje(@Req() r: any, @Body() b: Record<string,unknown>) {
    return this.logistica.viajeNuevo(b,r.usuario);
  }

  @Areas('logistica')
  @Post('entregas')
  entrega(@Req() r: any, @Body() b: Record<string,unknown>) {
    return this.logistica.entregaNueva(b,r.usuario);
  }

  @Areas('logistica','almacen')
  @Post('entregas/:id/preparar')
  preparar(@Param('id',ParseIntPipe) id:number,@Req() r:any,@Body() b: Record<string,unknown>) {
    return this.logistica.prepararEntrega(id,b,r.usuario);
  }

  @Areas('almacen')
  @Post('viajes/:id/cargar')
  cargar(@Param('id',ParseIntPipe) id:number,@Req() r:any,@Body() b: Record<string,unknown>) {
    return this.logistica.confirmarCarga(id,b,r.usuario);
  }

  @Areas('logistica','almacen')
  @Post('viajes/:id/despachar')
  despachar(@Param('id',ParseIntPipe) id:number,@Req() r:any) {
    return this.logistica.despacharViaje(id,r.usuario);
  }

  @Areas('logistica','almacen','cliente')
  @Post('entregas/:id/confirmar')
  @UseInterceptors(FileInterceptor('comprobante',{limits:{fileSize:10*1024*1024,files:1}}))
  confirmar(@Param('id',ParseIntPipe) id:number,@Req() r:any,
    @Body() b: Record<string,unknown>,@UploadedFile() f:Express.Multer.File|undefined) {
    return this.logistica.confirmarRecepcion(id,b,f,r.usuario);
  }

  @Areas('logistica')
  @Post('entregas/:id/cancelar')
  cancelarEntrega(@Param('id',ParseIntPipe) id:number,@Req() r:any,@Body() b: Record<string,unknown>) {
    return this.logistica.cancelarEntrega(id,b,r.usuario);
  }

  @Areas('logistica')
  @Post('viajes/:id/cancelar')
  cancelarViaje(@Param('id',ParseIntPipe) id:number,@Req() r:any,@Body() b: Record<string,unknown>) {
    return this.logistica.cancelarViaje(id,b,r.usuario);
  }

  @Areas('logistica','almacen','produccion','ventas','contaduria','cliente')
  @Get('entregas')
  @Header('Cache-Control','private, no-store')
  listar(@Req() r: any) { return this.logistica.listar(r.usuario); }

  @Areas('logistica','almacen','produccion','ventas','contaduria')
  @Get('conciliacion')
  conciliacion(@Req() r: any) { return this.logistica.conciliacionComercial(r.usuario); }

  @Areas('logistica','almacen','produccion','ventas','contaduria','cliente')
  @Get('entregas/:id/comprobante')
  @Header('Cache-Control','private, no-store')
  @Header('X-Content-Type-Options','nosniff')
  async comprobante(@Param('id',ParseIntPipe) id:number,@Req() r:any,
    @Res({passthrough:true}) response: Response) {
    const f=await this.logistica.obtenerComprobante(id,r.usuario);
    response.setHeader('Content-Type','application/pdf');
    response.setHeader('Content-Disposition',
      "attachment; filename*=UTF-8''" + encodeURIComponent(f.nombre));
    return new StreamableFile(f.buffer,{type:f.mime,length:f.buffer.length});
  }
}
