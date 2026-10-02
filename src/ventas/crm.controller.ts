import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard, Areas } from '../auth/auth.guard';
import { CrmService } from './crm.service';
const archivo = () =>
  FileInterceptor('documento', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
@Controller('api/ventas/crm')
@UseGuards(AuthGuard)
@Areas('ventas')
export class CrmController {
  constructor(private crm: CrmService) {}
  @Get('cuentas') cuentas(@Req() r: any, @Query('q') q: string) {
    return this.crm.cuentas(r.usuario, q);
  }
  @Post('cuentas') guardarCuenta(@Req() r: any, @Body() b: any) {
    return this.crm.guardarCuenta(b, r.usuario);
  }
  @Get('cuentas/:id') cuenta(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
  ) {
    return this.crm.cuenta(id, r.usuario);
  }
  @Get('metricas') metricas(@Req() r: any, @Query() q: any) {
    return this.crm.metricas(r.usuario, q);
  }
  @Areas('ventas', 'id')
  @Get('oportunidades')
  @Header('Cache-Control', 'private, no-store')
  listar(@Req() r: any, @Query() q: any) {
    return this.crm.listar(r.usuario, q);
  }
  @Post('oportunidades') crear(@Req() r: any, @Body() b: any) {
    return this.crm.crear(b, r.usuario);
  }
  @Areas('ventas', 'id')
  @Get('oportunidades/:id')
  @Header('Cache-Control', 'private, no-store')
  detalle(@Param('id', ParseIntPipe) id: number, @Req() r: any) {
    return this.crm.detalle(id, r.usuario);
  }
  @Post('oportunidades/:id/seguimiento') guardar(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.guardar(id, b, r.usuario);
  }
  @Post('oportunidades/:id/muestras') asociar(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.asociar(id, b, r.usuario);
  }
  @Areas('id')
  @Post('oportunidades/:id/reportes')
  @UseInterceptors(archivo())
  reporte(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
    @UploadedFile() f: any,
  ) {
    return this.crm.reporte(id, b, f, r.usuario);
  }
  @Areas('id') @Post('oportunidades/:id/reportes/:rid/anular') anular(
    @Param('id', ParseIntPipe) id: number,
    @Param('rid', ParseIntPipe) rid: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.anularReporte(id, rid, b, r.usuario);
  }
  @Post('oportunidades/:id/cotizaciones') @UseInterceptors(archivo()) cotizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
    @UploadedFile() f: any,
  ) {
    return this.crm.cotizar(id, b, f, r.usuario);
  }
  @Post('oportunidades/:id/cotizaciones/:cid/estado') estado(
    @Param('id', ParseIntPipe) id: number,
    @Param('cid', ParseIntPipe) cid: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.estadoCotizacion(id, cid, b, r.usuario);
  }
  @Post('oportunidades/:id/confirmar') confirmar(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.confirmar(id, b, r.usuario);
  }
  @Get('ordenes') ordenes(@Req() r: any) {
    return this.crm.ordenes(r.usuario);
  }
  @Post('ordenes/:id/produccion') produccion(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.produccion(id, b, r.usuario);
  }
  @Post('ordenes/:id/cancelar') cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.crm.cancelarOrden(id, b, r.usuario);
  }
  @Areas('ventas', 'id') @Get('documentos/:tipo/:id') async documento(
    @Param('tipo') tipo: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() r: any,
    @Res() res: Response,
  ) {
    const f = await this.crm.documento(
      tipo === 'cotizacion' ? 'cotizacion' : 'reporte',
      id,
      r.usuario,
    );
    res.setHeader('Content-Type', f.tipo_mime!);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(f.nombre_archivo!)}`,
    );
    res.send(Buffer.from(f.contenido!));
  }
}
