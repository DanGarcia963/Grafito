import { UseGuards } from '@nestjs/common';
import { AuthGuard, Areas } from '../auth/auth.guard';
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  StreamableFile,
  Header,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  memoryStorage,
} from 'multer';

type MulterFile = Express.Multer.File;

import {
  SeguridadService,
} from './seguridad.service';

import type {
  CrearTramiteDto,
} from './seguridad.service';

@UseGuards(AuthGuard)
@Areas('seguridad')
@Controller('api/seguridad')
export class SeguridadController {
  constructor(
    private readonly seguridadService: SeguridadService,
  ) {}

  /* =====================================================
     CATÁLOGO

     GET
     /api/seguridad/catalogo-tramites
  ===================================================== */

  @Get('catalogo-tramites')
  async obtenerCatalogoTramites() {
    return this.seguridadService
      .obtenerCatalogoTramites();
  }

  /* =====================================================
     MATRIZ LEGAL

     GET
     /api/seguridad/tramites
  ===================================================== */

  @Get('tramites')
  async obtenerTramites() {
    return this.seguridadService
      .obtenerTramites();
  }

  /* =====================================================
     TRÁMITE POR ID

     GET
     /api/seguridad/tramites/:id
  ===================================================== */

  @Get('tramites/:id')
  async obtenerTramitePorId(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.seguridadService
      .obtenerTramitePorId(id);
  }

  /* PDF asociado al trámite: devuelve bytes, no JSON. */
  @Get('tramites/:id/documento')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async obtenerDocumentoTramite(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const documento = await this.seguridadService.obtenerDocumentoTramite(id);
    // El nombre original se codifica para evitar caracteres inválidos en cabeceras.
    const nombre = documento.nombreArchivo.replace(/[\r\n\x00-\x1F\x7F]/g, '').trim() || `tramite-${id}.pdf`;
    const nombreCodificado = encodeURIComponent(nombre).replace(
      /['()*]/g,
      caracter => `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return new StreamableFile(documento.contenido, {
      type: 'application/pdf',
      disposition: `inline; filename="tramite-${id}.pdf"; filename*=UTF-8''${nombreCodificado}`,
      length: documento.contenido.length,
    });
  }

  /* =====================================================
     CREAR TRÁMITE

     POST
     /api/seguridad/tramites

     multipart/form-data
  ===================================================== */

  @Post('tramites')
  @UseInterceptors(
    FileInterceptor(
      'archivo',
      {
        storage:
          memoryStorage(),

        fileFilter: (
          req,
          file,
          callback,
        ) => {
          if (
            file.mimetype !==
            'application/pdf'
          ) {
            return callback(
              new BadRequestException(
                'Solo se permiten archivos PDF.',
              ),
              false,
            );
          }

          callback(
            null,
            true,
          );
        },

        limits: {
          fileSize:
            10 * 1024 * 1024,
        },
      },
    ),
  )
  async crearTramite(
    @Body()
    dto: CrearTramiteDto,

    @UploadedFile()
    file: MulterFile,
  ) {
    return this.seguridadService
      .crearTramiteConDocumento(
        dto,
        file,
      );
  }
}
