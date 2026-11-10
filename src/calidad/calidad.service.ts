import { booleanInput } from '../config/inputs';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { EventsGateway } from '../events.gateway';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Prisma,
  lotes_produccion_estado_Calida,
  muestras_categoria_Muestra,
  muestras_estado_Muestra,
} from '@prisma/client';

// Interfaces para tipar la recepción de datos desde el Frontend
export interface ContenedorInput {
  no_consecutivo: number;
  numero_contenedor: string;
  tapa_valvula: boolean;
  rejilla_danada: boolean;
  base_danada: boolean;
  derrame: boolean;
  observaciones?: string | null;
}

export interface CrearLoteInput {
  no_lote: string;
  recepcion_id: number;
  reviso_nombre: string;
  estado_checklist:
    'PENDIENTE' | 'EN_REVISION' | 'COMPLETADO' | 'CON_INCIDENCIAS';
  fecha_llegada: Date;
  fecha_Revision: Date;
  observaciones?: Record<string, any>;
  contenedores: ContenedorInput[];
}

@Injectable()
export class CalidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiempos: TrazabilidadService,
    private readonly eventos: EventsGateway,
  ) {}

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private normalizarAditivosAjuste(
    entrada: unknown,
    categoria: muestras_categoria_Muestra,
  ): Prisma.InputJsonValue | null {
    if (entrada == null) return null;
    if (!Array.isArray(entrada))
      throw new BadRequestException('Los aditivos deben enviarse como una lista.');
    if (categoria !== 'MUESTRA_POR_AJUSTE' && entrada.length > 0)
      throw new BadRequestException('Los aditivos solo aplican a muestras Por ajuste.');
    if (entrada.length > 30)
      throw new BadRequestException('No se permiten más de 30 aditivos por muestra.');
    const aditivos = entrada.map((item: any, index: number) => {
      const nombre = String(item?.nombre ?? '').trim();
      const unidad = String(item?.unidad ?? '').trim();
      if (!nombre || nombre.length > 150 || !unidad || unidad.length > 30)
        throw new BadRequestException('Completa nombre y unidad del aditivo #' + (index + 1) + '.');
      let cantidad: Prisma.Decimal;
      try {
        cantidad = new Prisma.Decimal(String(item?.cantidad ?? ''));
      } catch {
        throw new BadRequestException('Cantidad inválida para el aditivo #' + (index + 1) + '.');
      }
      if (!cantidad.isFinite() || !cantidad.gt(0))
        throw new BadRequestException('La cantidad del aditivo #' + (index + 1) + ' debe ser mayor a cero.');
      return { nombre, cantidad: cantidad.toString(), unidad };
    });
    return aditivos.length ? (aditivos as Prisma.InputJsonValue) : null;
  }

  private async actualizarInventarioPorDictamen(
    tx: Prisma.TransactionClient,
    loteInventarioId: number,
    dictamen: string,
    responsable?: string,
  ) {
    const lote = await tx.lotes_inventario.findUnique({
      where: { id: loteInventarioId },
      select: {
        origen: true,
        recepcion: { select: { estado_checklist: true } },
      },
    });
    if (!lote) throw new NotFoundException('Lote de inventario no encontrado.');
    const checklistAprobado =
      lote.origen !== 'RECEPCION' ||
      lote.recepcion?.estado_checklist === 'COMPLETADO';
    const liberar = dictamen === 'APROBADO' && checklistAprobado;
    const estado =
      dictamen === 'RECHAZADO' ? 'RECHAZADO' : liberar ? 'LIBERADO' : 'CUARENTENA';
    await tx.lotes_inventario.update({
      where: { id: loteInventarioId },
      data: {
        estado_calidad_recepcion: estado,
        liberado_en: liberar ? new Date() : null,
        liberado_por: liberar ? responsable || 'Calidad' : null,
      },
    });
  }

  private esMuestraGrafito(muestra: any): boolean {
    const producto = this.normalizarTexto(
      muestra?.productos_materiales?.nombre_Producto,
    );
    const linea = this.normalizarTexto(
      muestra?.lotes_produccion?.ordenes_produccion?.linea_Produccion,
    );
    return producto.includes('GRAFITO') || linea.includes('GRAFITO');
  }

  private leerDecimalCalculo(
    entrada: unknown,
    etiqueta: string,
    permitirCero = true,
  ): { texto: string; valor: Prisma.Decimal } {
    const texto = String(entrada ?? '').trim();
    if (!/^\d{1,8}(?:\.\d{1,6})?$/.test(texto))
      throw new BadRequestException(etiqueta + ': captura un número válido.');
    const valor = new Prisma.Decimal(texto);
    if (!valor.isFinite() || valor.isNegative() || (!permitirCero && valor.isZero()))
      throw new BadRequestException(etiqueta + ': el valor debe ser positivo.');
    return { texto, valor };
  }

  async obtenerParametrosCalidad() {
    try {
      const parametros = await this.prisma.parametros_laboratorio.findMany();
      return { success: true, result: parametros };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async obtenerTodasLasMuestras() {
    try {
      const muestras = await this.prisma.muestras.findMany({
        where: { area_Muestra: 'CALIDAD' },
        include: {
          personas_muestras_cliente_idTopersonas: {
            select: {
              id_Persona: true,
              nombre: true,
              tipo_persona: true,
            },
          },

          personas_muestras_analista_idTopersonas: {
            select: {
              id_Persona: true,
              nombre: true,
              tipo_persona: true,
            },
          },

          lotes_produccion: {
            select: {
              id_Lote_Produccion: true,
              no_Lote: true,
              ordenes_produccion: {
                select: {
                  cantidad_Planificada: true,
                  unidad: true,
                  linea_Produccion: true,
                },
              },
              equipos_tanques: {
                select: {
                  id_Equipos_Tanques: true,
                  nombre_Equipo: true,
                },
              },
            },
          },

          certificado_calidad: {
            select: {
              id_Certif_Calidad: true,
              folio_Certificado: true,
              no_Certificado: true,
              fecha_Emision: true,
              estatus: true,
              documento_nombre: true,
              documento_mime: true,
            },
          },

          productos_materiales: {
            select: {
              id_Produc_Mater: true,
              nombre_Producto: true,
              UM: true,
              presentacion: true,
            },
          },

          equipos_tanques: {
            select: {
              id_Equipos_Tanques: true,
              nombre_Equipo: true,
              estatus_proceso: true,
            },
          },

          resultado_analisis: {
            include: {
              parametros_laboratorio: {
                select: { nombre_Parametro: true, unidad_Medida: true },
              },
            },
          },
        },

        orderBy: {
          fecha_Toma: 'desc',
        },
      });

      return {
        success: true,
        result: await Promise.all(
          muestras.map(async (m) => ({
            ...m,
            esGrafito: this.esMuestraGrafito(m),
            resultado_analisis: m.resultado_analisis.map((r) => ({
              ...r,
              valor_Obtenido_Num: r.valor_Obtenido_Num,
              valor_Obtenido_Texto: r.valor_Obtenido_Texto,
            })),
            tiempoActual: await this.prisma.proceso_tramos.findFirst({
              where: { entidad: 'MUESTRA', entidad_id: m.id_Muestra },
              orderBy: { id: 'desc' },
            }),
          })),
        ),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async obtenerMuestrasPendientesCertificado() {
    const result = await this.prisma.muestras.findMany({
      where: {
        area_Muestra: 'CALIDAD',
        categoria_Muestra: 'MUESTRA_AJUSTADO',
        estado_Muestra: 'APROBADO',
        lote_id: { not: null },
        certificado_calidad: { is: null },
        lotes_produccion: { is: { estado_Calida: 'APROBADO' } },
      },
      select: {
        id_Muestra: true,
        no_Muestra: true,
        fecha_Toma: true,
        observaciones: true,
        lote_id: true,
        tanque_id: true,
        productos_materiales: { select: { nombre_Producto: true } },
        equipos_tanques: { select: { nombre_Equipo: true } },
        lotes_produccion: {
          select: {
            id_Lote_Produccion: true,
            no_Lote: true,
            estado_Calida: true,
            ordenes_produccion: {
              select: { unidad: true, cantidad_Planificada: true },
            },
          },
        },
      },
      orderBy: { id_Muestra: 'desc' },
    });
    return { success: true, result };
  }

  async subirCertificadoCalidad(
    idEntrada: unknown,
    body: Record<string, unknown>,
    documento: Express.Multer.File | undefined,
    usuario?: { personaId?: number },
  ) {
    const muestraId = this.tiempos.id(idEntrada);
    if (
      !documento?.buffer?.length ||
      documento.mimetype !== 'application/pdf' ||
      documento.buffer.subarray(0, 5).toString() !== '%PDF-'
    )
      throw new BadRequestException('Adjunta un certificado PDF válido.');
    if (documento.size > 10 * 1024 * 1024)
      throw new BadRequestException('El certificado no puede superar 10 MB.');

    const folio = String(body.folio_Certificado ?? '').trim();
    const numero = String(body.no_Certificado ?? '').trim();
    const fechaTexto = String(body.fecha_Emision ?? '').trim();
    if (!folio || folio.length > 50 || !numero || numero.length > 50)
      throw new BadRequestException(
        'El folio y el número del certificado son obligatorios (máximo 50 caracteres).',
      );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto))
      throw new BadRequestException('La fecha de emisión no es válida.');
    const fechaEmision = new Date(`${fechaTexto}T12:00:00.000Z`);
    if (
      Number.isNaN(fechaEmision.getTime()) ||
      fechaEmision.toISOString().slice(0, 10) !== fechaTexto
    )
      throw new BadRequestException('La fecha de emisión no es válida.');
    const nombreDocumento = String(
      documento.originalname || 'certificado-calidad.pdf',
    )
      .replace(/[\\/]/g, '_')
      .trim()
      .slice(0, 255);

    const certificado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra" = ${muestraId} FOR UPDATE`;
      const muestra = await tx.muestras.findUnique({
        where: { id_Muestra: muestraId },
      });
      if (!muestra || muestra.area_Muestra !== 'CALIDAD')
        throw new NotFoundException('Muestra de Calidad no encontrada.');
      if (
        muestra.categoria_Muestra !== 'MUESTRA_AJUSTADO' ||
        muestra.estado_Muestra !== 'APROBADO' ||
        !muestra.lote_id
      )
        throw new BadRequestException(
          'El certificado solo se puede cargar para una muestra Ajustado aprobada y ligada a un lote de producción.',
        );
      await this.bloquearOrigen(tx, muestra);
      await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion" = ${muestra.lote_id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: muestra.lote_id },
      });
      if (!lote) throw new NotFoundException('Lote de producción no encontrado.');
      if (lote.estado_Calida !== 'APROBADO')
        throw new BadRequestException(
          'El lote debe estar aprobado por la muestra Ajustado antes de cargar el certificado.',
        );
      const existente = await tx.certificado_calidad.findUnique({
        where: { muestra_id: muestraId },
        select: { id_Certif_Calidad: true },
      });
      if (existente)
        throw new ConflictException('Esta muestra ya tiene un certificado.');

      const ahora = new Date();
      const creado = await tx.certificado_calidad.create({
        data: {
          folio_Certificado: folio,
          no_Certificado: numero,
          lote_id: muestra.lote_id,
          muestra_id: muestra.id_Muestra,
          cliente_id: muestra.cliente_id,
          aprobado_Por_id: usuario?.personaId ?? null,
          solicitante_id: usuario?.personaId ?? null,
          fecha_Emision: fechaEmision,
          fecha_Liberacion: ahora,
          hora_Liberacion: ahora,
          estatus: 'EMITIDO',
          estatus_Calidad: 'APROBADO',
          documento_nombre: nombreDocumento,
          documento_mime: 'application/pdf',
          documento_contenido: new Uint8Array(documento.buffer),
        },
        select: {
          id_Certif_Calidad: true,
          folio_Certificado: true,
          no_Certificado: true,
          fecha_Emision: true,
          documento_nombre: true,
          documento_mime: true,
        },
      });
      await tx.lotes_produccion.update({
        where: { id_Lote_Produccion: muestra.lote_id },
        data: { estado_Calida: 'LIBERADO' },
      });
      const contexto = {
        entidad: 'MUESTRA' as const,
        entidad_id: muestra.id_Muestra,
        lote_id: muestra.lote_id,
        tanque_id: muestra.tanque_id,
      };
      const ultimo = await this.tiempos.ultimo(tx, contexto);
      await this.tiempos.evento(
        tx,
        contexto,
        ultimo?.ciclo ?? 1,
        'CERTIFICADO_CALIDAD_EMITIDO',
        {
          loteId: muestra.lote_id,
          certificadoId: creado.id_Certif_Calidad,
          folio: creado.folio_Certificado,
        },
      );
      return creado;
    });
    this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: muestraId });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { muestraId });
    return { success: true, result: certificado };
  }

  async obtenerDocumentoCertificado(idEntrada: unknown) {
    const muestraId = this.tiempos.id(idEntrada);
    const certificado = await this.prisma.certificado_calidad.findUnique({
      where: { muestra_id: muestraId },
      select: {
        documento_nombre: true,
        documento_mime: true,
        documento_contenido: true,
      },
    });
    if (
      !certificado?.documento_contenido?.length ||
      !certificado.documento_nombre ||
      !certificado.documento_mime
    )
      throw new NotFoundException('Certificado no encontrado.');
    return {
      nombre: certificado.documento_nombre,
      mime: certificado.documento_mime,
      buffer: Buffer.from(certificado.documento_contenido),
    };
  }

  async buscarEspecificacionesMuestra(muestraID: number) {
    try {
      const id = Number(muestraID);

      if (isNaN(id)) {
        throw new NotFoundException(
          'El ID de la muestra proporcionado no es válido.',
        );
      }

      const especificaciones = await this.prisma.resultado_analisis.findMany({
        where: {
          muestra_id: id,
          muestras: { area_Muestra: 'CALIDAD' },
        },
        select: {
          valor_Obtenido_Num: true,
          valor_Obtenido_Texto: true,
          calculo_aplicado: true,
          ciclo_analisis: true,
          fecha_Resultado: true,
          cumple_Especificacion: true,
          muestras: {
            select: {
              id_Muestra: true,
              no_Muestra: true,
            },
          },
          parametros_laboratorio: {
            select: {
              id_Parametro: true,
              nombre_Parametro: true,
            },
          },
        },
      });

      if (!especificaciones || especificaciones.length === 0) {
        throw new NotFoundException(
          `No se encontraron especificaciones o análisis para la muestra con ID ${id}`,
        );
      }

      return especificaciones.map((r) => ({
        ...r,
        valor_Obtenido_Num: r.valor_Obtenido_Num,
        valor_Obtenido_Texto: r.valor_Obtenido_Texto,
      }));
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Error al obtener especificaciones de la muestra:', error);
      throw new InternalServerErrorException(
        'Ocurrió un error en el servidor al consultar las especificaciones.',
      );
    }
  }

  async obtenerTodasMuestrasConDictamen() {
    try {
      const muestras = await this.prisma.muestras.findMany({
        include: {
          personas_muestras_cliente_idTopersonas: {
            select: {
              id_Persona: true,
              nombre: true,
              tipo_persona: true,
            },
          },

          personas_muestras_analista_idTopersonas: {
            select: {
              id_Persona: true,
              nombre: true,
              tipo_persona: true,
            },
          },
          lotes_produccion: {
            select: {
              id_Lote_Produccion: true,
              no_Lote: true,
              ordenes_produccion: {
                select: { cantidad_Planificada: true, unidad: true },
              },
              equipos_tanques: {
                // Include para obtener el nombre/datos del tanque
                select: {
                  id_Equipos_Tanques: true,
                  nombre_Equipo: true,
                },
              },
            },
          },
          productos_materiales: {
            select: {
              id_Produc_Mater: true,
              nombre_Producto: true,
              UM: true,
              presentacion: true,
            },
          },
          equipos_tanques: {
            select: {
              id_Equipos_Tanques: true,
              nombre_Equipo: true,
              estatus_proceso: true,
            },
          },
        },
        where: {
          area_Muestra: 'CALIDAD',
          estado_Muestra: {
            in: ['APROBADO', 'RECHAZADO'],
          },
          categoria_Muestra: {
            in: ['MUESTRA_AJUSTADO'],
          },
        },
      });

      return {
        success: true,
        result: await Promise.all(
          muestras.map(async (m) => ({
            ...m,
            tiempoActual: await this.prisma.proceso_tramos.findFirst({
              where: { entidad: 'MUESTRA', entidad_id: m.id_Muestra },
              orderBy: { id: 'desc' },
            }),
          })),
        ),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async crearResultadosMuestraCalidad(payload: {
    ciclo_analisis: number;
    id_Muestra: number;
    mediciones: Array<{
      id_Parametro: number;
      valor?: string;
      entradas?: Record<string, unknown>;
    }>;
    observaciones?: string;
  }) {
    try {
      const { id_Muestra, mediciones } = payload;
      const muestra = await this.prisma.muestras.findUnique({
        where: { id_Muestra },
        select: {
          producto_id: true,
          categoria_Muestra: true,
          productos_materiales: { select: { nombre_Producto: true } },
          lotes_produccion: {
            select: {
              ordenes_produccion: { select: { linea_Produccion: true } },
            },
          },
        },
      });
      if (!muestra) return { success: false, error: 'Muestra no encontrada' };

      const esGrafito = this.esMuestraGrafito(muestra);
      const ahora = new Date();
      const resultadosAInsertar = await Promise.all(
        mediciones.map(async (med) => {
          const parametro = await this.prisma.parametros_laboratorio.findUnique({
            where: { id_Parametro: med.id_Parametro },
          });
          if (!parametro) throw new BadRequestException('Parámetro inexistente');

          const especificacion = await this.prisma.especificaciones_producto.findFirst({
            where: {
              producto_id: muestra.producto_id,
              parametro_id: med.id_Parametro,
            },
          });
          const tipoDato = String(parametro.tipo_Dato).toUpperCase();
          const nombreParametro = this.normalizarTexto(parametro.nombre_Parametro);
          const etapa = String(muestra.categoria_Muestra);
          const entradas = med.entradas ?? {};
          let valorIngresado = String(med.valor ?? '').trim();
          let valorNumerico: Prisma.Decimal | null = null;
          let calculoAplicado:
            | { version: number; formula: string; etapa: string; entradas: Record<string, string>; resultado: string }
            | undefined;

          if (tipoDato === 'BOOLEANO') {
            valorIngresado = this.normalizarTexto(valorIngresado);
            if (!['SI', 'NO'].includes(valorIngresado))
              throw new BadRequestException('Metales debe registrarse como Sí o No.');
          } else if (tipoDato === 'NUMERICO') {
            let calculo:
              | { valor: Prisma.Decimal; formula: string; entradas: Record<string, string> }
              | null = null;

            if (esGrafito && nombreParametro.includes('GRAVEDAD ESPECIFICA')) {
              const masa = this.leerDecimalCalculo(entradas.masaMuestra, 'Peso de la muestra', false);
              const picometroVacio = this.leerDecimalCalculo(
                entradas.picometroVacio,
                'Peso del picnómetro vacío',
              );
              const picometroLleno = masa.valor.plus(picometroVacio.valor);
              const resultado = picometroLleno
                .minus(picometroVacio.valor)
                .div('97.4729')
                .toDecimalPlaces(4);
              calculo = {
                valor: resultado,
                formula: '(picnómetro lleno - picnómetro vacío) / 97.4729; picnómetro lleno = muestra + picnómetro vacío',
                entradas: {
                  masaMuestra: masa.texto,
                  picometroVacio: picometroVacio.texto,
                  picometroLleno: picometroLleno.toString(),
                },
              };
            } else if (
              esGrafito &&
              nombreParametro.includes('HUMEDAD') &&
              etapa === 'MUESTRA_INICIAL'
            ) {
              const medicion = this.leerDecimalCalculo(
                entradas.medicion ?? med.valor,
                'Medición de humedad inicial',
              );
              calculo = {
                valor: medicion.valor.times(4).toDecimalPlaces(4),
                formula: 'medición × 4 = % humedad inicial',
                entradas: { medicion: medicion.texto },
              };
            } else if (
              esGrafito &&
              nombreParametro.includes('HUMEDAD') &&
              etapa === 'MUESTRA_EVAPOR_DESMETAL'
            ) {
              const medicion = this.leerDecimalCalculo(
                entradas.medicion ?? med.valor,
                'Medición de humedad final',
              );
              calculo = {
                valor: medicion.valor.times(10).toDecimalPlaces(4),
                formula: 'medición × 10 = % humedad final',
                entradas: { medicion: medicion.texto },
              };
            } else if (
              esGrafito &&
              nombreParametro.includes('BROOKFIELD') && nombreParametro.includes('SPIN 4') &&
              etapa === 'MUESTRA_POR_AJUSTE'
            ) {
              const medicion = this.leerDecimalCalculo(
                entradas.medicion ?? med.valor,
                'Lectura del viscosímetro Brookfield inicial',
              );
              calculo = {
                valor: medicion.valor.times(99).toDecimalPlaces(4),
                formula: 'medición del viscosímetro × 99 = viscosidad Brookfield inicial',
                entradas: { medicion: medicion.texto, factor: '99' },
              };
            } else if (
              esGrafito &&
              nombreParametro.includes('BROOKFIELD') && nombreParametro.includes('SPIN 4') &&
              etapa === 'MUESTRA_AJUSTADO'
            ) {
              const medicion = this.leerDecimalCalculo(
                entradas.medicion ?? med.valor,
                'Lectura del viscosímetro Brookfield final',
              );
              calculo = {
                valor: medicion.valor.times(99).toDecimalPlaces(4),
                formula: 'medición del viscosímetro × 99 = viscosidad Brookfield final',
                entradas: { medicion: medicion.texto, factor: '99' },
              };
            } else if (
              esGrafito &&
              nombreParametro.includes('GRAFITO') &&
              etapa === 'MUESTRA_POR_AJUSTE'
            ) {
              const pesoFinal = this.leerDecimalCalculo(entradas.pesoFinal, 'Peso final');
              const pesoPapel = this.leerDecimalCalculo(entradas.pesoPapel, 'Peso del papel');
              const pesoMuestra = this.leerDecimalCalculo(entradas.pesoMuestra, 'Peso de la muestra', false);
              if (pesoFinal.valor.lessThan(pesoPapel.valor))
                throw new BadRequestException('El peso final no puede ser menor al peso del papel.');
              calculo = {
                valor: pesoFinal.valor
                  .minus(pesoPapel.valor)
                  .div(pesoMuestra.valor)
                  .times(100)
                  .toDecimalPlaces(4),
                formula: '((peso final - peso papel) / peso muestra) × 100 = % grafito inicial',
                entradas: {
                  pesoFinal: pesoFinal.texto,
                  pesoPapel: pesoPapel.texto,
                  pesoMuestra: pesoMuestra.texto,
                },
              };
            }

            if (calculo) {
              valorNumerico = calculo.valor;
              valorIngresado = valorNumerico.toFixed(4);
              calculoAplicado = {
                version: 1,
                formula: calculo.formula,
                etapa,
                entradas: calculo.entradas,
                resultado: valorIngresado,
              };
            } else {
              if (!/^[+-]?\d{1,8}(?:\.\d{1,4})?$/.test(valorIngresado))
                throw new BadRequestException(
                  'Resultado numérico inválido: máximo 8 enteros y 4 decimales',
                );
              valorNumerico = new Prisma.Decimal(valorIngresado);
            }
            if (
              !valorNumerico ||
              !valorNumerico.isFinite() ||
              valorNumerico.abs().greaterThan('99999999.9999')
            )
              throw new BadRequestException('El resultado excede la precisión permitida (12,4).');
          } else if (!valorIngresado) {
            throw new BadRequestException('Resultado vacío');
          }

          let cumpleEspecificacion = false;
          if (tipoDato === 'NUMERICO' && valorNumerico) {
            const valorNum = valorNumerico.toNumber();
            const minStr = especificacion?.valor_Minimo != null
              ? String(especificacion.valor_Minimo).trim()
              : null;
            const maxStr = especificacion?.valor_Maximo != null
              ? String(especificacion.valor_Maximo).trim()
              : null;
            const minNum = minStr ? parseFloat(minStr) : -Infinity;
            const maxNum = maxStr ? parseFloat(maxStr) : Infinity;
            cumpleEspecificacion = valorNum >= minNum && valorNum <= maxNum;
          } else {
            const valorMinimoEsperado = especificacion?.valor_Minimo != null
              ? String(especificacion.valor_Minimo).trim()
              : '';
            if (valorMinimoEsperado.length > 0) {
              cumpleEspecificacion = tipoDato === 'BOOLEANO'
                ? this.normalizarTexto(valorIngresado) === this.normalizarTexto(valorMinimoEsperado)
                : valorIngresado.toLowerCase() === valorMinimoEsperado.toLowerCase();
            } else {
              cumpleEspecificacion = valorIngresado.length > 0;
            }
          }

          return {
            muestra_id: id_Muestra,
            ciclo_analisis: payload.ciclo_analisis,
            parametro_id: med.id_Parametro,
            valor_Obtenido_Num: tipoDato === 'NUMERICO' ? valorNumerico : null,
            valor_Obtenido_Texto: tipoDato === 'NUMERICO' ? null : valorIngresado,
            cumple_Especificacion: cumpleEspecificacion,
            fecha_Resultado: ahora,
            ...(calculoAplicado
              ? { calculo_aplicado: calculoAplicado as Prisma.InputJsonValue }
              : {}),
          };
        }),
      );

      const res = await this.prisma.resultado_analisis.createMany({
        data: resultadosAInsertar,
      });
      return { success: true, count: res.count };
    } catch (error: any) {
      console.error('Error al guardar resultados:', error);
      return { success: false, error: error.message };
    }
  }

  async agregarEspecifProduct(data: any) {
    try {
      const especif = await this.prisma.especificaciones_producto.create({
        data,
      });
      return { success: true, result: especif };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async actualizarEstadoMuestra({
    idMuestra,
    dictamen,
    observaciones,
    analistaNombre,
  }: {
    idMuestra: number;
    dictamen: string;
    observaciones: string;
    analistaNombre?: string;
  }) {
    try {
      let idAnalista: number | null = null;

      // 1. Si enviaron un nombre de analista, buscamos o creamos
      if (analistaNombre && analistaNombre.trim() !== '') {
        const nombreLimpio = analistaNombre.trim();

        // Buscamos si ya existe (coincidencia exacta o insensible a mayúsculas)
        let analista = await this.prisma.personas.findFirst({
          where: {
            nombre: {
              equals: nombreLimpio,
              mode: 'insensitive',
            },
          },
        });

        // Si no existe, lo creamos como nuevo laboratorista
        if (!analista) {
          analista = await this.prisma.personas.create({
            data: {
              nombre: nombreLimpio,
              tipo_persona: 'LABORATORISTA',
            },
          });
        }

        idAnalista = analista.id_Persona; // o analista.id
      }

      // 2. Obtener la muestra actual para extraer la relación con su lote y la orden de producción
      const muestraActual = await this.prisma.muestras.findUnique({
        where: { id_Muestra: Number(idMuestra) },
        select: {
          lote_id: true,
          lotes_produccion: {
            select: {
              orden_Produccion_id: true,
            },
          },
        },
      });

      if (!muestraActual) {
        return { success: false, error: 'Muestra no encontrada' };
      }
      // 2. Actualizamos la muestra
      const update = await this.prisma.muestras.updateMany({
        where: {
          id_Muestra: Number(idMuestra),
        },
        data: {
          estado_Muestra: dictamen as muestras_estado_Muestra,
          observaciones: observaciones,
          analista_id: idAnalista, // <--- Asignamos la llave foránea
        },
      });

      return {
        success: true,
        count: update.count,
      };
    } catch (error: any) {
      console.error('Error al actualizar el estado de la muestra:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async bloquearOrigen(
    tx: Prisma.TransactionClient,
    m: {
      id_Muestra: number;
      lote_id: number | null;
      lote_inventario_id: number | null;
    },
  ) {
    if (m.lote_id) {
      await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion"=${m.lote_id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM lotes_inventario WHERE lote_produccion_id=${m.lote_id} ORDER BY id FOR UPDATE`;
    } else if (m.lote_inventario_id) {
      await tx.$queryRaw`SELECT id FROM lotes_inventario WHERE id=${m.lote_inventario_id} FOR UPDATE`;
    }
    if (m.lote_id && await tx.lotes_produccion.count({where: {id_Lote_Produccion: m.lote_id, estado_Calida: 'FUERA_DE_ESPECIFICACION'}}))
      throw new BadRequestException('El lote fue descargado como F.E.; analiza el nuevo lote de reproceso');
    if (m.lote_id || m.lote_inventario_id) {
      const posterior = await tx.muestras.count({
        where: {
          area_Muestra: 'CALIDAD',
          id_Muestra: { gt: m.id_Muestra },
          ...(m.lote_id
            ? { lote_id: m.lote_id }
            : { lote_inventario_id: m.lote_inventario_id }),
        },
      });
      if (posterior)
        throw new BadRequestException(
          'Existe una muestra más reciente del material; utiliza su análisis',
        );
    }
  }

  // Recepción e inicio son acciones explícitas; abrir un modal no inicia el reloj.
  async cambiarEtapaMuestra(
    idEntrada: unknown,
    accion: 'RECIBIR' | 'INICIAR' | 'REABRIR',
  ) {
    const id = this.tiempos.id(idEntrada);
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra" = ${id} FOR UPDATE`;
      const muestra = await tx.muestras.findUnique({
        where: { id_Muestra: id },
      });
      if (!muestra || muestra.area_Muestra !== 'CALIDAD')
        throw new NotFoundException('Muestra de Calidad no encontrada');
      await this.bloquearOrigen(tx, muestra);
      const ctx = {
        entidad: 'MUESTRA' as const,
        entidad_id: id,
        lote_id: muestra.lote_id,
        tanque_id: muestra.tanque_id,
      };
      const ultimo = await this.tiempos.ultimo(tx, ctx);
      const etapa = ultimo?.fin == null ? ultimo?.etapa : null;
      const finalizada = ['APROBADO', 'RECHAZADO'].includes(
        muestra.estado_Muestra,
      );
      if (accion === 'REABRIR') {
        if (!finalizada)
          throw new BadRequestException(
            'Solo se puede reabrir una muestra dictaminada',
          );
        if (muestra.categoria_Muestra === 'MUESTRA_AJUSTADO')
          throw new BadRequestException(
            muestra.estado_Muestra === 'RECHAZADO'
              ? 'Producción debe decidir si solicita el segundo ciclo; también puede tomarse otra muestra del tanque.'
              : 'Una muestra Ajustado aprobada debe continuar al certificado de calidad.',
          );
        const certificadoExistente = await tx.certificado_calidad.count({
          where: { muestra_id: id },
        });
        if (certificadoExistente)
          throw new BadRequestException(
            'La muestra ya tiene certificado; no se puede reabrir su análisis.',
          );
        if (muestra.lote_inventario_id)
          await tx.lotes_inventario.update({
            where: { id: muestra.lote_inventario_id },
            data: {
              estado_calidad_recepcion: 'CUARENTENA',
              liberado_en: null,
              liberado_por: null,
            },
          });
        const tramo = await this.tiempos.transicion(
          tx,
          ctx,
          'REANALISIS_PENDIENTE',
          true,
        );
        await tx.muestras.update({
          where: { id_Muestra: id },
          data: { estado_Muestra: 'PENDIENTE' },
        });
        await this.tiempos.evento(
          tx,
          ctx,
          tramo!.ciclo,
          'REANALISIS_SOLICITADO',
          { estadoAnterior: muestra.estado_Muestra },
        );
      } else {
        if (finalizada)
          throw new BadRequestException('La muestra ya fue dictaminada');
        if (accion === 'RECIBIR') {
          if (etapa === 'ESPERA_ANALISIS' || etapa === 'ANALISIS')
            return { success: true, repetida: true };
          const tramo = await this.tiempos.transicion(
            tx,
            ctx,
            'ESPERA_ANALISIS',
          );
          await this.tiempos.evento(
            tx,
            ctx,
            tramo!.ciclo,
            'RECEPCION_MUESTRA',
            { sinTomaHorariaPrevia: !ultimo },
          );
          await tx.muestras.update({
            where: { id_Muestra: id },
            data: { estado_Muestra: 'PENDIENTE' },
          });
        } else {
          if (etapa === 'ANALISIS') return { success: true, repetida: true };
          if (etapa !== 'ESPERA_ANALISIS')
            throw new BadRequestException(
              'Primero registra la recepción de la muestra',
            );
          const tramo = await this.tiempos.transicion(tx, ctx, 'ANALISIS');
          await tx.muestras.update({
            where: { id_Muestra: id },
            data: { estado_Muestra: 'EN_ANALISIS' },
          });
          await this.tiempos.evento(tx, ctx, tramo!.ciclo, 'INICIO_ANALISIS');
        }
      }
      return { success: true };
    });
    this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
    return resultado;
  }

  async solicitarSegundoCiclo(idEntrada: unknown) {
    const id = this.tiempos.id(idEntrada);
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra" = ${id} FOR UPDATE`;
      const muestra = await tx.muestras.findUnique({
        where: { id_Muestra: id },
      });
      if (!muestra || muestra.area_Muestra !== 'CALIDAD')
        throw new NotFoundException('Muestra de Calidad no encontrada.');
      if (
        muestra.categoria_Muestra !== 'MUESTRA_AJUSTADO' ||
        muestra.estado_Muestra !== 'RECHAZADO' ||
        !muestra.lote_id
      )
        throw new BadRequestException(
          'Solo se puede solicitar un segundo ciclo para una muestra Ajustado rechazada de un lote de producción.',
        );
      await this.bloquearOrigen(tx, muestra);
      await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion" = ${muestra.lote_id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: muestra.lote_id },
        select: { estado_Calida: true },
      });
      if (lote?.estado_Calida !== 'RECHAZADO')
        throw new BadRequestException(
          'El lote debe estar rechazado por la muestra Ajustado para solicitar un segundo ciclo.',
        );
      const certificado = await tx.certificado_calidad.count({
        where: { muestra_id: id },
      });
      if (certificado)
        throw new BadRequestException(
          'La muestra ya tiene certificado de calidad.',
        );
      const ultimo = await this.tiempos.ultimo(tx, {
        entidad: 'MUESTRA',
        entidad_id: id,
        lote_id: muestra.lote_id,
        tanque_id: muestra.tanque_id,
      });
      if (!ultimo || !ultimo.fin || ultimo.ciclo !== 1)
        throw new BadRequestException(
          'El segundo ciclo ya fue utilizado o el primer análisis no ha concluido.',
        );
      const contexto = {
        entidad: 'MUESTRA' as const,
        entidad_id: id,
        lote_id: muestra.lote_id,
        tanque_id: muestra.tanque_id,
      };
      const tramo = await this.tiempos.transicion(
        tx,
        contexto,
        'REANALISIS_PENDIENTE',
        true,
      );
      await tx.muestras.update({
        where: { id_Muestra: id },
        data: { estado_Muestra: 'PENDIENTE' },
      });
      await tx.lotes_produccion.update({
        where: { id_Lote_Produccion: muestra.lote_id },
        data: { estado_Calida: 'EN_ANALISIS' },
      });
      await this.tiempos.evento(
        tx,
        contexto,
        tramo!.ciclo,
        'SEGUNDO_CICLO_AUTORIZADO_PRODUCCION',
        { estadoAnterior: muestra.estado_Muestra },
      );
      return { success: true, ciclo: tramo!.ciclo };
    });
    this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { muestraId: id });
    return resultado;
  }

  async finalizarAnalisis(payload: any) {
    const id = this.tiempos.id(payload?.idMuestra);
    const tipoMuestraPayload = payload?.tipoMuestra
      ? String(payload.tipoMuestra).trim().toUpperCase().replace(/\s+/g, '_')
      : null;
    if (
      tipoMuestraPayload &&
      !Object.values(muestras_categoria_Muestra).includes(tipoMuestraPayload as muestras_categoria_Muestra)
    )
      throw new BadRequestException('Tipo de muestra inválido');
    if (!['APROBADO', 'RECHAZADO'].includes(payload?.dictamen))
      throw new BadRequestException('Dictamen inválido');
    if (!Array.isArray(payload?.mediciones) || !payload.mediciones.length)
      throw new BadRequestException('Captura al menos un resultado');
    if (
      new Set(payload.mediciones.map((m: any) => m.id_Parametro)).size !==
      payload.mediciones.length
    )
      throw new BadRequestException('Parámetros duplicados');
    for (const m of payload.mediciones) {
      this.tiempos.id(m?.id_Parametro);
      const tieneValor = typeof m?.valor === 'string' && m.valor.trim().length > 0;
      const tieneEntrada =
        m?.entradas &&
        typeof m.entradas === 'object' &&
        Object.values(m.entradas).some((valor: any) => String(valor ?? '').trim().length > 0);
      if (!tieneValor && !tieneEntrada)
        throw new BadRequestException('Captura la medición o los datos requeridos para calcular el resultado.');
    }
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra" = ${id} FOR UPDATE`;
        const muestra = await tx.muestras.findUnique({
          where: { id_Muestra: id },
        });
        if (!muestra || muestra.area_Muestra !== 'CALIDAD')
          throw new NotFoundException('Muestra de Calidad no encontrada');
        if (tipoMuestraPayload && tipoMuestraPayload !== muestra.categoria_Muestra)
          throw new BadRequestException('La categoría de muestra es fija y no coincide con el registro.');
        if (muestra.estado_Muestra === 'APROBADO' || muestra.estado_Muestra === 'RECHAZADO')
          throw new BadRequestException('La muestra ya cuenta con dictamen.');
        await this.bloquearOrigen(tx, muestra);
        const ctx = {
          entidad: 'MUESTRA' as const,
          entidad_id: id,
          lote_id: muestra.lote_id,
          tanque_id: muestra.tanque_id,
        };
        const tramo = await this.tiempos.ultimo(tx, ctx);
        if (!tramo || tramo.fin || tramo.etapa !== 'ANALISIS')
          throw new BadRequestException(
            'Inicia el análisis antes de finalizar; si ya terminó, consulta el historial',
          );
        // Ambas operaciones comparten la transacción: si una falla, nada se guarda.
        const worker = new CalidadService(
          tx as PrismaService,
          this.tiempos,
          this.eventos,
        );
        const resultados = await worker.crearResultadosMuestraCalidad({
          id_Muestra: id,
          mediciones: payload.mediciones,
          ciclo_analisis: tramo.ciclo,
        });
        if (!resultados.success)
          throw new BadRequestException(resultados.error);
        const dictamen = await worker.actualizarEstadoMuestra({
          idMuestra: id,
          dictamen: payload.dictamen,
          observaciones: String(payload.observaciones ?? ''),
          analistaNombre: payload.analistaNombre,
        });
        if (!dictamen.success || !dictamen.count)
          throw new BadRequestException(
            dictamen.error || 'No se guardó el dictamen',
          );
        if (
          muestra.lote_id &&
          muestra.categoria_Muestra === 'MUESTRA_AJUSTADO'
        )
          await tx.lotes_produccion.update({
            where: { id_Lote_Produccion: muestra.lote_id },
            data: { estado_Calida: payload.dictamen },
          });
        const aditivosAjuste = this.normalizarAditivosAjuste(
          payload.aditivos_ajuste,
          muestra.categoria_Muestra,
        );
        await tx.muestras.update({
          where: { id_Muestra: id },
          data: { aditivos_ajuste: aditivosAjuste ?? Prisma.DbNull },
        });
        if (muestra.lote_inventario_id)
          await this.actualizarInventarioPorDictamen(
            tx, muestra.lote_inventario_id, payload.dictamen, payload.analistaNombre,
          );
        await this.tiempos.transicion(tx, ctx, null);
        await this.tiempos.evento(tx, ctx, tramo.ciclo, 'FIN_ANALISIS', {
          dictamen: payload.dictamen,
          tipoMuestra: muestra.categoria_Muestra,
          analistaDeclarado: payload.analistaNombre ?? null,
          observaciones: payload.observaciones ?? null,
        });
        return { success: true, ciclo: tramo.ciclo };
      },
      { timeout: 30000 },
    );
    this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { muestraId: id });
    return resultado;
  }

  async actualizarEstatusMuestra(payload: any) {
    const id = this.tiempos.id(payload?.id_Muestra);
    const estado = String(payload?.estatus_Muestra ?? '')
      .trim()
      .toUpperCase();
    // Inicio/recepción y fin tienen endpoints propios para no omitir sus tiempos.
    if (estado !== 'APROBADO')
      throw new BadRequestException(
        'Usa recibir, iniciar o finalizar para registrar el ciclo. Este endpoint libera una muestra rechazada.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Muestra" FROM muestras WHERE "id_Muestra" = ${id} FOR UPDATE`;
      const muestra = await tx.muestras.findUnique({
        where: { id_Muestra: id },
      });
      if (!muestra || muestra.area_Muestra !== 'CALIDAD')
        throw new NotFoundException('Muestra de Calidad no encontrada');
      await this.bloquearOrigen(tx, muestra);
      if (muestra.categoria_Muestra === 'MUESTRA_AJUSTADO')
        throw new BadRequestException(
          'Una muestra Ajustado rechazada no se libera manualmente; Producción puede solicitar el segundo ciclo o tomar otra muestra del tanque.',
        );
      if (muestra.estado_Muestra === 'APROBADO') return muestra;
      if (muestra.estado_Muestra !== 'RECHAZADO')
        throw new BadRequestException(
          'Solo puedes liberar una muestra rechazada',
        );
      const ctx = {
        entidad: 'MUESTRA' as const,
        entidad_id: id,
        lote_id: muestra.lote_id,
        tanque_id: muestra.tanque_id,
      };
      const ultimo = await this.tiempos.ultimo(tx, ctx);
      await this.tiempos.evento(
        tx,
        ctx,
        ultimo?.ciclo ?? 1,
        'LIBERACION_MANUAL',
        { anterior: muestra.estado_Muestra, nuevo: estado },
      );
      if (muestra.lote_inventario_id)
        await this.actualizarInventarioPorDictamen(
          tx, muestra.lote_inventario_id, 'APROBADO', 'Calidad: liberación manual',
        );
      return tx.muestras.update({
        where: { id_Muestra: id },
        data: { estado_Muestra: 'APROBADO' },
      });
    });
    this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
    return { success: true, data: result };
  }

  async buscarAnalistas(query: string) {
    try {
      const analistas = await this.prisma.personas.findMany({
        where: {
          nombre: {
            contains: query,
            mode: 'insensitive',
          },
        },
        take: 5, // Limitar resultados
        select: {
          id_Persona: true,
          nombre: true,
        },
      });

      return {
        success: true,
        analistas: analistas.map((a) => ({
          id: a.id_Persona,
          nombre: a.nombre,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private esLoteGrafito(lote: any): boolean {
    const especificaciones = lote.especificaciones as unknown as Record<string, any> | null;
    const prensa = this.normalizarTexto(
      especificaciones?.atributos?.tipo_prensa ??
        especificaciones?.contenedores?.[0]?.tipo_prensa ??
        especificaciones?.contenedores?.[0]?.atributos?.tipo_prensa,
    );
    return (
      this.normalizarTexto(lote.producto?.nombre_Producto).includes('GRAFITO') ||
      this.normalizarTexto(
        lote.lote_produccion?.ordenes_produccion?.linea_Produccion,
      ).includes('GRAFITO') ||
      ['FORGEMASTER', 'POLYMASTER', 'FAGOR'].some((marca) => prensa.includes(marca))
    );
  }

  private detallesContenedoresLote(lote: any) {
    const especificaciones = lote.especificaciones as unknown as Record<string, any> | null;
    const fuente = Array.isArray(especificaciones?.contenedores)
      ? especificaciones!.contenedores
      : [];
    const items = fuente.map((contenedor: any) => {
      let peso: Prisma.Decimal;
      try {
        peso = new Prisma.Decimal(String(contenedor?.peso_kg ?? '0'));
      } catch {
        peso = new Prisma.Decimal(0);
      }
      return {
        contenedor,
        peso,
        restante: peso,
        consumido: new Prisma.Decimal(0),
        entregado: new Prisma.Decimal(0),
      };
    });
    const movimientos = [...(lote.movimientos ?? [])].sort(
      (a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );
    for (const movimiento of movimientos) {
      const tipo = String(movimiento.tipo ?? '');
      if (!['SALIDA_CONSUMO', 'SALIDA_ENTREGA'].includes(tipo)) continue;
      let cantidad = new Prisma.Decimal(movimiento.cantidad).sub(
        movimiento.reversion?.cantidad ?? 0,
      );
      if (!cantidad.gt(0)) continue;
      for (const item of items) {
        if (!cantidad.gt(0)) break;
        if (!item.restante.gt(0)) continue;
        const retirada = Prisma.Decimal.min(item.restante, cantidad);
        item.restante = item.restante.sub(retirada);
        if (tipo === 'SALIDA_CONSUMO')
          item.consumido = item.consumido.add(retirada);
        else item.entregado = item.entregado.add(retirada);
        cantidad = cantidad.sub(retirada);
      }
    }
    const checklistPendiente = ['PENDIENTE', 'EN_REVISION'].includes(
      String(lote.recepcion?.estado_checklist ?? ''),
    );
    return items
      .filter((item) => item.contenedor?.codigo && item.peso.gt(0))
      .map((item) => {
        const contenedor = item.contenedor;
        const limpieza = String(contenedor.estado_limpieza ?? 'SUCIO').toUpperCase();
        const revision = contenedor.revision_relleno ?? null;
        let estado: string;
        if (item.restante.gt(0))
          estado = item.restante.lt(item.peso) ? 'PARCIAL' : 'LLENO';
        else if (item.consumido.gte(item.peso) && item.entregado.isZero()) {
          if (limpieza === 'LIMPIO' && revision?.resultado === 'APROBADO')
            estado = 'LISTO_PARA_RELLENAR';
          else if (limpieza === 'LIMPIO') estado = 'VACIO_LIMPIO';
          else estado = 'VACIO_SUCIO';
        } else estado = 'FUERA_DE_PLANTA';
        const fechas = [
          lote.creado_en,
          ...movimientos.map((m: any) => m.fecha),
          contenedor.actualizado_en,
          revision?.fecha,
        ]
          .map((fecha) => (fecha ? new Date(fecha).getTime() : 0))
          .filter((fecha) => Number.isFinite(fecha));
        return {
          lote_inventario_id: lote.id,
          folio: lote.folio,
          producto: lote.producto?.nombre_Producto ?? '',
          recepcion_folio: lote.recepcion?.no_lote ?? null,
          codigo: String(contenedor.codigo),
          peso_kg: item.peso.toFixed(4),
          saldo_kg: item.restante.toFixed(4),
          prensa: String(
            especificaciones?.atributos?.tipo_prensa ??
              contenedor.tipo_prensa ??
              contenedor.atributos?.tipo_prensa ??
              '',
          ),
          estado,
          pendiente_checklist_inicial: checklistPendiente,
          estado_limpieza: limpieza,
          estado_revision: revision?.resultado ?? 'PENDIENTE',
          limpieza,
          revision,
          actividad_en: fechas.reduce((max, fecha) => Math.max(max, fecha), 0),
          condicion: lote.condicion,
        };
      });
  }

  async obtenerContenedoresGrafito() {
    const lotes = await this.prisma.lotes_inventario.findMany({
      include: {
        producto: { select: { nombre_Producto: true } },
        recepcion: {
          select: { no_lote: true, estado_checklist: true },
        },
        lote_produccion: {
          include: {
            ordenes_produccion: { select: { linea_Produccion: true } },
          },
        },
        movimientos: { include: { reversion: true } },
      },
      orderBy: { creado_en: 'asc' },
    });
    const candidatos = lotes.flatMap((lote) => {
      if (!this.esLoteGrafito(lote)) return [];
      return this.detallesContenedoresLote(lote)
        .map((contenedor) => ({ ...contenedor, placeholder: /^(S\/R|SIN NUMERO|SIN IDENTIFICAR|C[- ]?\d+|CONTENEDOR[- ]?\d+)$/i.test(contenedor.codigo) }));
    });
    // Si un contenedor serializado reaparece en otro lote, conserva la instancia más reciente.
    const porIdentidad = new Map<string, (typeof candidatos)[number]>();
    for (const item of candidatos) {
      const claveCodigo = item.codigo.trim().toUpperCase();
      const clave = item.placeholder
        ? `${item.lote_inventario_id}:${claveCodigo}`
        : claveCodigo;
      const anterior = porIdentidad.get(clave);
      if (!anterior || item.actividad_en >= anterior.actividad_en)
        porIdentidad.set(clave, item);
    }
    const result = [...porIdentidad.values()]
      .filter((item) => item.estado !== 'FUERA_DE_PLANTA')
      .map(({ actividad_en: _actividad, placeholder: _placeholder, ...item }) => item)
      .sort((a, b) => a.folio.localeCompare(b.folio) || a.codigo.localeCompare(b.codigo));
    const resumen = {
      LLENO: result.filter((c) => c.estado === 'LLENO').length,
      PARCIAL: result.filter((c) => c.estado === 'PARCIAL').length,
      PENDIENTE_CHECKLIST: result.filter((c) => c.pendiente_checklist_inicial).length,
      VACIO_SUCIOS: result.filter((c) => c.estado === 'VACIO_SUCIO').length,
      VACIO_LIMPIOS: result.filter((c) => c.estado === 'VACIO_LIMPIO').length,
      LISTO_PARA_RELLENAR: result.filter((c) => c.estado === 'LISTO_PARA_RELLENAR').length,
    };
    return { success: true, result, resumen };
  }

  private async actualizarContenedorGrafito(
    id: number,
    codigoEntrada: unknown,
    actorEntrada: unknown,
    accion: string,
    transformar: (contenedor: Record<string, any>, estadoActual: string, datosEstado: any) => Record<string, any>,
  ) {
    const codigo = String(codigoEntrada ?? '').trim();
    const actor = String(actorEntrada ?? '').trim() || 'Usuario de Calidad';
    if (!codigo) throw new BadRequestException('Identifica el contenedor');
    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lotes_inventario WHERE id = ${id} FOR UPDATE`;
      const lote = await tx.lotes_inventario.findUnique({
        where: { id },
        include: {
          producto: { select: { nombre_Producto: true } },
          recepcion: { select: { no_lote: true, estado_checklist: true } },
          lote_produccion: {
            include: {
              ordenes_produccion: { select: { linea_Produccion: true } },
            },
          },
          movimientos: { include: { reversion: true } },
        },
      });
      if (!lote) throw new NotFoundException('Lote de inventario no encontrado');
      if (!this.esLoteGrafito(lote))
        throw new BadRequestException('El lote no pertenece a grafito');
      const estados = this.detallesContenedoresLote(lote);
      const estadoContenedor = estados.find((item) => item.codigo === codigo);
      if (!estadoContenedor)
        throw new NotFoundException('Contenedor no encontrado en el lote');
      const especificaciones = lote.especificaciones as unknown as Record<string, any> | null;
      const lista = Array.isArray(especificaciones?.contenedores)
        ? [...especificaciones!.contenedores]
        : [];
      const indice = lista.findIndex((item: any) => String(item?.codigo ?? '') === codigo);
      if (indice < 0) throw new NotFoundException('Contenedor no encontrado');
      const previo = lista[indice] as Record<string, any>;
      const fecha = new Date().toISOString();
      const siguiente = transformar({ ...previo }, estadoContenedor.estado, estadoContenedor);
      const entradaHistorial = {
        accion,
        estado_anterior: estadoContenedor.estado,
        estado_nuevo:
          siguiente.estado_limpieza === 'LIMPIO'
            ? siguiente.revision_relleno?.resultado === 'APROBADO'
              ? 'LISTO_PARA_RELLENAR'
              : 'VACIO_LIMPIO'
            : 'VACIO_SUCIO',
        realizado_por: actor,
        fecha,
        detalle: siguiente.revision_relleno ?? siguiente.limpieza ?? null,
      };
      siguiente.actualizado_en = fecha;
      siguiente.historial_estado = [
        ...(Array.isArray(previo.historial_estado) ? previo.historial_estado : []),
        entradaHistorial,
      ].slice(-50);
      lista[indice] = siguiente;
      await tx.lotes_inventario.update({
        where: { id },
        data: {
          especificaciones: {
            ...(especificaciones ?? {}),
            contenedores: lista,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.proceso_eventos.create({
        data: {
          entidad: 'INVENTARIO',
          entidad_id: id,
          ciclo: 1,
          fecha: new Date(),
          accion,
          detalle: JSON.stringify({ codigo, realizado_por: actor }),
        },
      });
      return { lote_inventario_id: id, folio: lote.folio, codigo, estado: entradaHistorial.estado_nuevo };
    });
    this.eventos.notificar('INVENTARIO_CONTENEDORES_ACTUALIZADO', {
      lote_inventario_id: id,
    });
    return actualizado;
  }

  async marcarContenedorGrafitoLimpio(
    id: number,
    body: Record<string, unknown>,
    usuario: unknown,
  ) {
    const result = await this.actualizarContenedorGrafito(
      id,
      body.codigo,
      usuario,
      'CONTENEDOR_LIMPIEZA_COMPLETADA',
      (contenedor, estado, datosEstado) => {
        if (estado !== 'VACIO_SUCIO')
          throw new BadRequestException('Solo puedes registrar limpieza en un contenedor vacío y sucio');
        if (datosEstado.pendiente_checklist_inicial)
          throw new BadRequestException('Completa primero el checklist inicial de recepción');
        return {
          ...contenedor,
          estado_limpieza: 'LIMPIO',
          limpieza: { realizado_por: String(usuario ?? 'Usuario de Calidad'), fecha: new Date().toISOString() },
          revision_relleno: { resultado: 'PENDIENTE' },
        };
      },
    );
    return { success: true, result };
  }

  async revisarContenedorGrafito(
    id: number,
    body: Record<string, unknown>,
    usuario: unknown,
  ) {
    const codigo = String(body.codigo ?? '').trim();
    const campos = ['tapa_valvula', 'rejilla_danada', 'base_danada', 'derrame'] as const;
    if (!codigo || campos.some((campo) => typeof body[campo] !== 'boolean'))
      throw new BadRequestException('Captura el resultado completo de la inspección');
    const observaciones = String(body.observaciones ?? '').trim().slice(0, 2000);
    const defectos = campos.some((campo) => body[campo] === true);
    const result = await this.actualizarContenedorGrafito(
      id,
      codigo,
      usuario,
      'CONTENEDOR_INSPECCION_RELLENO',
      (contenedor, estado) => {
        if (estado !== 'VACIO_LIMPIO')
          throw new BadRequestException('El contenedor debe estar limpio y vacío antes de inspeccionarlo');
        const revision = {
          resultado: defectos ? 'RECHAZADO' : 'APROBADO',
          tapa_valvula: body.tapa_valvula,
          rejilla_danada: body.rejilla_danada,
          base_danada: body.base_danada,
          derrame: body.derrame,
          observaciones,
          revisado_por: String(usuario ?? ''),
          fecha: new Date().toISOString(),
        };
        return {
          ...contenedor,
          estado_limpieza: defectos ? 'SUCIO' : 'LIMPIO',
          revision_relleno: revision,
        };
      },
    );
    return { success: true, result };
  }

  async obtenerOrdenesPendientesDeLlegada(fechaFiltro?: Date | string) {
    try {
      // Si envían fecha la tomamos, si no, usamos la fecha/hora actual
      const fechaLimite = fechaFiltro ? new Date(fechaFiltro) : new Date();

      // Ajustamos al final del día (23:59:59) para incluir todos los registros del día seleccionado
      fechaLimite.setHours(23, 59, 59, 999);

      const ordenes = await this.prisma.lotes_llegada.findMany({
        where: {
          fecha_llegada: { lte: fechaLimite },
          estado_recepcion: { not: 'CANCELADA' },
          estado_checklist: { in: ['PENDIENTE', 'EN_REVISION', 'CON_INCIDENCIAS'] },
        },
        include: {
          remitente: { select: { nombre: true } },
          materiales: { include: { producto: true } },
          checklist_contenedor: true,
        },
        orderBy: { fecha_llegada: 'asc' },
      });

      return {
        success: true,
        result: ordenes,
      };
    } catch (error: any) {
      console.error('Error al obtener ordenes pendientes de llegada:', error);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 2. Método para registrar el lote de llegada y su checklist directamente desde los datos enviados por el frontend
  async crearLoteConChecklist(payload: any) {
    const id = this.tiempos.id(payload.recepcion_id);
    if (!payload.reviso_nombre?.trim() || !Array.isArray(payload.contenedores) || !payload.contenedores.length)
      throw new BadRequestException('Captura responsable y contenedores');
    const contenedores: ContenedorInput[] = payload.contenedores.map(
      (c: ContenedorInput): ContenedorInput => ({
        no_consecutivo: this.tiempos.id(c.no_consecutivo),
        numero_contenedor: String(c.numero_contenedor ?? 'S/R').trim() || 'S/R',
        tapa_valvula: booleanInput(c.tapa_valvula),
        rejilla_danada: booleanInput(c.rejilla_danada),
        base_danada: booleanInput(c.base_danada),
        derrame: booleanInput(c.derrame),
        observaciones: String(c.observaciones ?? '').trim() || null,
      }),
    );
    if (new Set(contenedores.map((c) => c.no_consecutivo)).size !== contenedores.length)
      throw new BadRequestException('Hay consecutivos de contenedor duplicados.');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lotes_llegada WHERE id=${id} FOR UPDATE`;
      const recepcion = await tx.lotes_llegada.findUnique({
        where: { id }, include: { materiales: { select: { especificaciones: true } } },
      });
      if (!recepcion || recepcion.estado_recepcion === 'CANCELADA')
        throw new BadRequestException('Recepción no disponible');
      if (recepcion.estado_checklist === 'COMPLETADO')
        throw new BadRequestException('La recepción ya tiene el checklist aprobado.');
      const esperados = recepcion.materiales.reduce((total, material) => {
        const especificaciones = material.especificaciones as any;
        return total + (Array.isArray(especificaciones?.contenedores) ? especificaciones.contenedores.length : 0);
      }, 0);
      if (esperados > 0 && contenedores.length !== esperados)
        throw new BadRequestException('Debes revisar los ' + esperados + ' contenedores registrados en la recepción.');
      for (const contenedor of contenedores) {
        const { no_consecutivo, ...datos } = contenedor;
        await tx.checklist_contenedor.upsert({
          where: { lote_llegada_id_no_consecutivo: { lote_llegada_id: id, no_consecutivo } },
          create: { lote_llegada_id: id, no_consecutivo, ...datos },
          update: datos,
        });
      }
      await tx.checklist_contenedor.deleteMany({
        where: { lote_llegada_id: id, no_consecutivo: { notIn: contenedores.map((c) => c.no_consecutivo) } },
      });
      const tieneIncidencias = contenedores.some((c) =>
        c.tapa_valvula || c.rejilla_danada || c.base_danada || c.derrame,
      );
      const estadoChecklist = tieneIncidencias ? 'CON_INCIDENCIAS' : 'COMPLETADO';
      if (tieneIncidencias) {
        await tx.lotes_inventario.updateMany({
          where: { recepcion_id: id, origen: 'RECEPCION', estado_calidad_recepcion: { in: ['CUARENTENA', 'LIBERADO'] } },
          data: { estado_calidad_recepcion: 'CUARENTENA', liberado_en: null, liberado_por: null },
        });
      } else {
        await tx.lotes_inventario.updateMany({
          where: { recepcion_id: id, origen: 'RECEPCION', estado_calidad_recepcion: 'CUARENTENA' },
          data: {
            estado_calidad_recepcion: 'LIBERADO',
            liberado_en: new Date(),
            liberado_por: payload.reviso_nombre.trim(),
          },
        });
      }
      return tx.lotes_llegada.update({
        where: { id },
        data: { reviso_nombre: payload.reviso_nombre.trim(), fecha_Revision: new Date(), estado_checklist: estadoChecklist },
      });
    });
    this.eventos.notificar('MUESTRA_ACTUALIZADA', { recepcionId: id, estado_checklist: result.estado_checklist });
    return { success: true, result };
  }
}
