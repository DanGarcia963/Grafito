import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard, Areas } from '../auth/auth.guard';
import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  Put,
  Query,
  Param,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Req,
  Res,
  StreamableFile,
  Header,
  UseGuards,
} from '@nestjs/common';
import { CalidadService } from './calidad.service';

@UseGuards(AuthGuard)
@Areas('produccion', 'calidad')
@Controller('api/calidad')
export class CalidadController {
  constructor(private readonly calidadService: CalidadService) {}

  @Get('obtenerParametros')
  async obtenerParametros() {
    const result = await this.calidadService.obtenerParametrosCalidad();
    return { success: true, data: result };
  }

  @Get('obtenerMuestras')
  async obtenerMuestras() {
    const result = await this.calidadService.obtenerTodasLasMuestras();
    return { success: true, data: result };
  }

  @Get(':muestraID/especificaciones')
  async buscarEspecificacionesMuestra(
    @Param('muestraID', ParseIntPipe) muestraID: number,
  ) {
    return await this.calidadService.buscarEspecificacionesMuestra(muestraID);
  }

  @Get('obtenerMuestrasDictaminadas')
  async obtenerMuestrasDictaminadas() {
    const result =
      await this.calidadService.obtenerTodasMuestrasConDictamen();

    return { success: true, data: result };
  }

  @Areas('calidad')
  @Get('certificados/pendientes')
  certificadosPendientes() {
    return this.calidadService.obtenerMuestrasPendientesCertificado();
  }

  @Areas('calidad')
  @Post('muestras/:id/certificado')
  @UseInterceptors(
    FileInterceptor('documento', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (file.mimetype !== 'application/pdf')
          return callback(
            new BadRequestException('Solo se permiten certificados PDF.'),
            false,
          );
        callback(null, true);
      },
    }),
  )
  subirCertificado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @UploadedFile() documento: Express.Multer.File | undefined,
    @Req() request: any,
  ) {
    return this.calidadService.subirCertificadoCalidad(
      id,
      body,
      documento,
      request.usuario,
    );
  }

  @Areas('calidad')
  @Get('muestras/:id/certificado')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async descargarCertificado(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const documento = await this.calidadService.obtenerDocumentoCertificado(id);
    response.setHeader('Content-Type', documento.mime);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(documento.nombre)}`,
    );
    return new StreamableFile(documento.buffer, {
      type: documento.mime,
      length: documento.buffer.length,
    });
  }

  @Post('crearResultado')
  async crearResultado(@Body() body: any) {
    throw new BadRequestException('Usa POST finalizarAnalisis para guardar resultados y dictamen en una transacción.');
  }

  @Areas('calidad') @Post('agregarEspecifi')
  async crearVenta(@Body() body: any) {
    return this.calidadService.agregarEspecifProduct(body);
  }

  @Put('actualizarEstadoMuestra')
  async actualizarEstadoMuestra(
    @Body()
    body: {
      idMuestra: number;
      dictamen: string;
      tipoMuestra: string;
      observaciones: string;
    },
  ) {
    throw new BadRequestException('Usa POST finalizarAnalisis para guardar resultados y dictamen en una transacción.');
  }

  // Cambio exclusivo del estado de una muestra.
  @Areas('calidad') @Put('actualizarEstatusMuestra')
  async actualizarEstatusMuestra(@Body() body: unknown) {
    return this.calidadService.actualizarEstatusMuestra(body);
  }

  @Get('buscarAnalistas')
  async buscarAnalistas(@Query('q') query: string) {
    if (!query || query.trim() === '') {
      return { success: true, analistas: [] };
    }

    return await this.calidadService.buscarAnalistas(query.trim());
  }

  // ============================================================
  // ÓRDENES DE PRODUCCIÓN PENDIENTES DE LLEGADA
  // ============================================================
  @Get('obtenerOrdenesPendientesDeLlegada')
  async obtenerOrdenesPendientesDeLlegada(
    @Query('fechaFiltro') fechaFiltro?: string,
  ) {
    return await this.calidadService.obtenerOrdenesPendientesDeLlegada(
      fechaFiltro,
    );
  }

  // ============================================================
  // REGISTRAR LOTE DE LLEGADA + CHECKLIST
  // ============================================================
  @Areas('calidad') @Post('crearLoteConChecklist')
  async crearLoteConChecklist(@Body() body: any) {
    return await this.calidadService.crearLoteConChecklist(body);
  }

  @Areas('calidad') @Post('finalizarAnalisis')
  finalizar(@Body() body: any) { return this.calidadService.finalizarAnalisis(body); }
  @Areas('calidad') @Post(':id/recibir')
  recibir(@Param('id', ParseIntPipe) id: number) { return this.calidadService.cambiarEtapaMuestra(id, 'RECIBIR'); }
  @Areas('calidad') @Post(':id/iniciar')
  iniciar(@Param('id', ParseIntPipe) id: number) { return this.calidadService.cambiarEtapaMuestra(id, 'INICIAR'); }
  @Areas('calidad') @Post(':id/reabrir')
  reabrir(@Param('id', ParseIntPipe) id: number) { return this.calidadService.cambiarEtapaMuestra(id, 'REABRIR'); }
  @Areas('produccion') @Post(':id/segundo-ciclo')
  segundoCiclo(@Param('id', ParseIntPipe) id: number) { return this.calidadService.solicitarSegundoCiclo(id); }
}
