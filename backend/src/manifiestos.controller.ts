import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard, Areas } from './auth/auth.guard';
import { ManifiestosService } from './manifiestos.service';

const pdf = (field: string) => FileInterceptor(field, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== 'application/pdf')
      return callback(new BadRequestException('Solo se permiten archivos PDF.'), false);
    callback(null, true);
  },
});
const pdfs = () => FileFieldsInterceptor(
  [
    { name: 'documento_manifiesto', maxCount: 1 },
    { name: 'documento_llegada', maxCount: 1 },
  ],
  {
    limits: { fileSize: 10 * 1024 * 1024, files: 2 },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype !== 'application/pdf')
        return callback(new BadRequestException('Solo se permiten archivos PDF.'), false);
      callback(null, true);
    },
  },
);

@UseGuards(AuthGuard)
@Areas('seguridad', 'logistica', 'almacen', 'contaduria')
@Controller('api/manifiestos')
export class ManifiestosController {
  constructor(private readonly service: ManifiestosService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  listar(@Req() request: any) {
    return this.service.listar(request.usuario);
  }

  @Get('catalogos')
  catalogos(@Req() request: any) {
    return this.service.catalogos(request.usuario);
  }

  @Post()
  @Areas('seguridad')
  crear(@Body() body: Record<string, unknown>, @Req() request: any) {
    return this.service.crear(body, request.usuario);
  }

  @Post('completo')
  @Areas('seguridad')
  @UseInterceptors(pdfs())
  crearCompleto(
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: { documento_manifiesto?: Express.Multer.File[]; documento_llegada?: Express.Multer.File[] },
    @Req() request: any,
  ) {
    return this.service.crearCompleto(body, files ?? {}, request.usuario);
  }

  @Post(':id/asignar')
  @Areas('logistica')
  asignar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() request: any,
  ) {
    return this.service.asignar(id, body, request.usuario);
  }

  @Post(':id/recibir')
  @Areas('almacen')
  recibir(@Param('id', ParseIntPipe) id: number, @Req() request: any) {
    return this.service.recibir(id, request.usuario);
  }

  @Post(':id/pesaje')
  @Areas('almacen')
  @UseInterceptors(pdf('documento_llegada'))
  pesar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: any,
  ) {
    return this.service.pesar(id, body, file, request.usuario);
  }

  @Post(':id/verificar')
  @Areas('seguridad')
  verificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() request: any,
  ) {
    return this.service.verificar(id, body, request.usuario);
  }

  @Post(':id/corregir')
  @Areas('logistica')
  corregir(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() request: any,
  ) {
    return this.service.corregir(id, body, request.usuario);
  }

  @Post(':id/firmar')
  @Areas('contaduria')
  firmar(@Param('id', ParseIntPipe) id: number, @Req() request: any) {
    return this.service.firmar(id, request.usuario);
  }

  @Post(':id/resguardo')
  @Areas('seguridad')
  @UseInterceptors(pdf('documento_manifiesto'))
  resguardar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: any,
  ) {
    return this.service.resguardar(id, file, request.usuario);
  }

  @Post(':id/enviar-correo')
  @Areas('seguridad')
  enviarCorreo(@Param('id', ParseIntPipe) id: number, @Req() request: any) {
    return this.service.enviarCorreo(id, request.usuario);
  }

  @Get(':id/documento/:tipo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async documento(
    @Param('id', ParseIntPipe) id: number,
    @Param('tipo') tipo: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (tipo !== 'manifiesto' && tipo !== 'llegada')
      throw new BadRequestException('Tipo de documento inválido.');
    const file = await this.service.documento(id, tipo);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.nombre)}`);
    return new StreamableFile(file.buffer, { type: file.mime, length: file.buffer.length });
  }
}
