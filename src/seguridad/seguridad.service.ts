import { EventsGateway } from '../events.gateway';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Prisma, tramites_legales_estatus_Tramite } from '@prisma/client';
type MulterFile = Express.Multer.File;

import { PrismaService } from '../prisma.service';

/* =========================================================
   DTO
========================================================= */

export interface CrearTramiteDto {
  // Nombre utilizado por la API/frontend
  id_tramite_catalogo: number | string;

  duracion_anios?: number | string;
  costo_vigencia?: number | string;
  costo_por_anio?: number | string;

  responsable?: string;
  proveedor?: string;

  estatus_tramite?: Prisma.tramites_legalesCreateInput['estatus_Tramite'];

  fecha_expedicion?: string | Date;
  fecha_vencimiento?: string | Date;

  observaciones?: string;
}

/* =========================================================
   SERVICIO
========================================================= */

@Injectable()
export class SeguridadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventsGateway,
  ) {}

  /* =======================================================
     CATÁLOGO DE TRÁMITES

     GET /api/seguridad/catalogo-tramites
  ======================================================= */

  async obtenerCatalogoTramites() {
    try {
      const catalogo =
        await this.prisma.catalogo_tramites.findMany({
          where: {
            activo: true,
          },

          orderBy: [
            {
              id_Area: 'asc',
            },
            {
              nombre_Tramite: 'asc',
            },
          ],

          include: {
            areas_legales: true,
          },
        });

      return catalogo.map((tramite) => ({
        id_Tramite_Catalogo:
          tramite.id_Tramite_Catalogo,

        id_Area:
          tramite.id_Area,

        nombre_Tramite:
          tramite.nombre_Tramite,

        nombre_Area:
          tramite.areas_legales.nombre_Area,
      }));
    } catch (error) {
      console.error(
        'Error obteniendo catálogo de trámites:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Error al obtener el catálogo de trámites: ${message}`,
      );
    }
  }

  /* =======================================================
     OBTENER MATRIZ LEGAL

     GET /api/seguridad/tramites
  ======================================================= */

  async obtenerTramites() {
    try {
      const tramites =
        await this.prisma.tramites_legales.findMany({
          orderBy: {
            id_Tramite_Legal: 'desc',
          },

          include: {
            catalogo_tramites: {
              include: {
                areas_legales: true,
              },
            },

            documentos_legales: true,
          },
        });

      return tramites.map((tramite) => ({
        id:
          String(
            tramite.id_Tramite_Legal,
          ),

        id_tramite_catalogo:
          tramite.id_Tramite_Catalogo,

        area_relacionada:
          tramite.catalogo_tramites
            .areas_legales
            .nombre_Area,

        nombre_tramite:
          tramite.catalogo_tramites
            .nombre_Tramite,

        duracion_anios:
          Number(
            tramite.duracion_Tramite,
          ),

        costo_vigencia:
          Number(
            tramite.costo_Vigencia,
          ),

        costo_por_anio:
          Number(
            tramite.costo_Por_Anio,
          ),

        responsable:
          tramite.responsable_Interno,

        proveedor:
          tramite.proveedor,

        estatus_tramite:
          tramite.estatus_Tramite,

        fecha_expedicion:
          tramite.fecha_Expedicion,

        fecha_vencimiento:
          tramite.fecha_Vencimiento,

        observaciones:
          tramite.observaciones,

        /*
         * Conservamos "documentos" en la respuesta
         * para que tu frontend actual pueda seguir
         * utilizando dataBackend.documentos?.[0]
         */
        documentos:
          tramite.documentos_legales
            ? [
                {
                  id:
                    tramite
                      .documentos_legales
                      .id_Documento,

                  nombre_original:
                    tramite
                      .documentos_legales
                      .nombre_archivo,
                },
              ]
            : [],
      }));
    } catch (error) {
      console.error(
        'Error obteniendo trámites legales:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Error al obtener los trámites legales: ${message}`,
      );
    }
  }

  /* =======================================================
     OBTENER TRÁMITE POR ID

     GET /api/seguridad/tramites/:id
  ======================================================= */

  async obtenerTramitePorId(
    id: number,
  ) {
    try {
      const tramite =
        await this.prisma.tramites_legales.findUnique({
          where: {
            id_Tramite_Legal: id,
          },

          include: {
            catalogo_tramites: {
              include: {
                areas_legales: true,
              },
            },

            documentos_legales: true,
          },
        });

      if (!tramite) {
        throw new NotFoundException(
          `El trámite con ID ${id} no existe.`,
        );
      }

      return {
        id:
          String(
            tramite.id_Tramite_Legal,
          ),

        id_tramite_catalogo:
          tramite.id_Tramite_Catalogo,

        area_relacionada:
          tramite.catalogo_tramites
            .areas_legales
            .nombre_Area,

        nombre_tramite:
          tramite.catalogo_tramites
            .nombre_Tramite,

        duracion_anios:
          Number(
            tramite.duracion_Tramite,
          ),

        costo_vigencia:
          Number(
            tramite.costo_Vigencia,
          ),

        costo_por_anio:
          Number(
            tramite.costo_Por_Anio,
          ),

        responsable:
          tramite.responsable_Interno,

        proveedor:
          tramite.proveedor,

        estatus_tramite:
          tramite.estatus_Tramite,

        fecha_expedicion:
          tramite.fecha_Expedicion,

        fecha_vencimiento:
          tramite.fecha_Vencimiento,

        observaciones:
          tramite.observaciones,

        documentos:
          tramite.documentos_legales
            ? [
                {
                  id:
                    tramite
                      .documentos_legales
                      .id_Documento,

                  nombre_original:
                    tramite
                      .documentos_legales
                      .nombre_archivo,
                },
              ]
            : [],
      };
    } catch (error) {
      if (
        error instanceof
        NotFoundException
      ) {
        throw error;
      }

      console.error(
        'Error obteniendo trámite:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Error al obtener el trámite: ${message}`,
      );
    }
  }

  /* Recupera únicamente el PDF relacionado con el ID del trámite. */
  async obtenerDocumentoTramite(id: number): Promise<{
    nombreArchivo: string;
    contenido: Buffer;
  }> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('El ID del trámite debe ser un entero positivo.');
    }

    try {
      const tramite = await this.prisma.tramites_legales.findUnique({
        where: { id_Tramite_Legal: id },
        select: {
          documentos_legales: {
            select: { nombre_archivo: true, contenido_pdf: true },
          },
        },
      });

      if (!tramite) {
        throw new NotFoundException(`El trámite con ID ${id} no existe.`);
      }
      const documento = tramite.documentos_legales;
      if (!documento || !documento.contenido_pdf || documento.contenido_pdf.length === 0) {
        throw new NotFoundException('El trámite no tiene un documento PDF disponible.');
      }

      return {
        nombreArchivo: documento.nombre_archivo || `tramite-${id}.pdf`,
        // Compatible con Bytes de Prisma devueltos como Buffer o Uint8Array.
        contenido: Buffer.from(documento.contenido_pdf),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error obteniendo documento del trámite:', error);
      throw new InternalServerErrorException('No fue posible obtener el documento PDF.');
    }
  }

  /* =======================================================
     CREAR TRÁMITE + DOCUMENTO

     POST /api/seguridad/tramites
  ======================================================= */

  async crearTramiteConDocumento(
    dto: CrearTramiteDto,
    file?: MulterFile,
  ) {
    try {
      /* ===================================================
         1. EL DOCUMENTO ES OBLIGATORIO
      =================================================== */

      if (!file || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
        throw new BadRequestException(
          'Debes adjuntar el documento PDF del trámite.',
        );
      }

      /* ===================================================
         2. VALIDAR ID DEL CATÁLOGO
      =================================================== */

      const idTramiteCatalogo =
        Number(
          dto.id_tramite_catalogo,
        );

      if (
        !idTramiteCatalogo ||
        Number.isNaN(idTramiteCatalogo)
      ) {
        throw new BadRequestException(
          'id_tramite_catalogo es obligatorio.',
        );
      }

      /* ===================================================
         3. VERIFICAR CATÁLOGO
      =================================================== */

      const catalogo =
        await this.prisma.catalogo_tramites.findUnique({
          where: {
            id_Tramite_Catalogo:
              idTramiteCatalogo,
          },

          include: {
            areas_legales: true,
          },
        });

      if (!catalogo) {
        throw new NotFoundException(
          `El trámite del catálogo con ID ${idTramiteCatalogo} no existe.`,
        );
      }

      if (!catalogo.activo) {
        throw new BadRequestException(
          'El trámite seleccionado está inactivo.',
        );
      }

      /* ===================================================
         4. TRANSACCIÓN
      =================================================== */

      const resultado =
        await this.prisma.$transaction(
          async (tx) => {

            /* =============================================
               4.1 CREAR DOCUMENTO
            ============================================= */

            const documento =
              await tx.documentos_legales.create({
                data: {
                  nombre_archivo:
                    file.originalname,

                  contenido_pdf:
                    new Uint8Array(file.buffer),
                },
              });

            /* =============================================
               4.2 CREAR TRÁMITE
            ============================================= */

            const tramite =
              await tx.tramites_legales.create({
                data: {
                  id_Tramite_Catalogo:
                    idTramiteCatalogo,

                  documento_ID:
                    documento.id_Documento,

                  duracion_Tramite:
                    Number(
                      dto.duracion_anios ??
                      1,
                    ),

                  costo_Vigencia:
                    Number(
                      dto.costo_vigencia ??
                      0,
                    ),

                  costo_Por_Anio:
                    Number(
                      dto.costo_por_anio ??
                      0,
                    ),

                  responsable_Interno:
                    dto.responsable ??
                    '',

                  proveedor:
                    dto.proveedor ??
                    '',

                  estatus_Tramite:
                    dto.estatus_tramite ??
                    'VIGENTE' as tramites_legales_estatus_Tramite,

                  fecha_Expedicion:
                    dto.fecha_expedicion
                      ? new Date(
                          dto.fecha_expedicion,
                        )
                      : new Date(),

                  fecha_Vencimiento:
                    dto.fecha_vencimiento
                      ? new Date(
                          dto.fecha_vencimiento,
                        )
                      : new Date(),

                  observaciones:
                    dto.observaciones ??
                    '',
                },
              });

            return {
              tramite,
              documento,
            };
          },
        );

      /* ===================================================
         5. DEVOLVER RESPUESTA COMPATIBLE CON FRONTEND
      =================================================== */

      const respuesta = {
        id:
          String(
            resultado.tramite
              .id_Tramite_Legal,
          ),

        id_tramite_catalogo:
          resultado.tramite
            .id_Tramite_Catalogo,

        area_relacionada:
          catalogo
            .areas_legales
            .nombre_Area,

        nombre_tramite:
          catalogo.nombre_Tramite,

        duracion_anios:
          Number(
            resultado.tramite
              .duracion_Tramite,
          ),

        costo_vigencia:
          Number(
            resultado.tramite
              .costo_Vigencia,
          ),

        costo_por_anio:
          Number(
            resultado.tramite
              .costo_Por_Anio,
          ),

        responsable:
          resultado.tramite
            .responsable_Interno,

        proveedor:
          resultado.tramite
            .proveedor,

        estatus_tramite:
          resultado.tramite
            .estatus_Tramite,

        fecha_expedicion:
          resultado.tramite
            .fecha_Expedicion,

        fecha_vencimiento:
          resultado.tramite
            .fecha_Vencimiento,

        observaciones:
          resultado.tramite
            .observaciones,

        documentos: [
          {
            id:
              resultado.documento
                .id_Documento,

            nombre_original:
              resultado.documento
                .nombre_archivo,
          },
        ],
      };
      this.eventos.notificar('TRAMITE_CREADO', { id: respuesta.id });
      return respuesta;
    } catch (error) {
      if (
        error instanceof
          BadRequestException ||
        error instanceof
          NotFoundException
      ) {
        throw error;
      }

      console.error(
        'Error detallado en base de datos:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Error al crear el trámite en la base de datos: ${message}`,
      );
    }
  }
}