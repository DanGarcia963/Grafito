import { booleanInput } from '../config/inputs';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { EventsGateway } from '../events.gateway';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Prisma,
  muestras_categoria_Muestra,
  lotes_produccion_estado_Calida,
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
  observaciones?: string;
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
                select: { cantidad_Planificada: true, unidad: true },
              },
              equipos_tanques: {
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

          resultado_analisis: true,
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
    mediciones: Array<{ id_Parametro: number; valor: string }>;
    observaciones?: string;
  }) {
    try {
      const { id_Muestra, mediciones } = payload;

      // 1. Obtener la muestra con la relación al producto para conocer el id_Producto
      const muestra = await this.prisma.muestras.findUnique({
        where: { id_Muestra },
        select: {
          producto_id: true, // Asegúrate de que el campo FK al producto se llame así en tu schema
        },
      });

      if (!muestra) {
        return { success: false, error: 'Muestra no encontrada' };
      }

      const idProducto = muestra.producto_id;
      const ahora = new Date();
      const fechaActualIso = new Date(); // Objeto Date que Prisma mapea perfecto a DateTime
      const horaActual = ahora.toTimeString().split(' ')[0]; // "HH:MM:SS"

      // 2. Procesar cada medición
      const resultadosAInsertar = await Promise.all(
        mediciones.map(async (med) => {
          // Consultar el tipo de parámetro
          const parametro = await this.prisma.parametros_laboratorio.findUnique(
            {
              where: { id_Parametro: med.id_Parametro },
            },
          );

          // Consultar la especificación configurada para este producto y parámetro
          const especificacion =
            await this.prisma.especificaciones_producto.findFirst({
              where: {
                producto_id: idProducto,
                parametro_id: med.id_Parametro,
              },
            });

          let cumpleEspecificacion = false;
          // Convertimos el valor ingresado asegurando que siempre sea un string limpio
          const valorIngresado = String(med.valor ?? '').trim();

          // Evaluamos el tipo de dato del parámetro de forma segura
          if (!parametro)
            throw new BadRequestException('Parámetro inexistente');
          const tipoDato = String(parametro.tipo_Dato).toUpperCase();
          if (
            tipoDato === 'NUMERICO' &&
            !/^[+-]?\d{1,8}(?:\.\d{1,4})?$/.test(valorIngresado)
          ) {
            throw new BadRequestException(
              'Resultado numérico inválido: máximo 8 enteros y 4 decimales',
            );
          }

          if (tipoDato === 'NUMERICO') {
            // Lógica NUMÉRICA
            const valorNum = parseFloat(valorIngresado);

            // Convertimos a String primero para evitar fallos con Decimal de Prisma o nulls
            const minStr =
              especificacion?.valor_Minimo != null
                ? String(especificacion.valor_Minimo).trim()
                : null;
            const maxStr =
              especificacion?.valor_Maximo != null
                ? String(especificacion.valor_Maximo).trim()
                : null;

            const minNum =
              minStr && minStr !== '' ? parseFloat(minStr) : -Infinity;
            const maxNum =
              maxStr && maxStr !== '' ? parseFloat(maxStr) : Infinity;

            if (!isNaN(valorNum)) {
              cumpleEspecificacion = valorNum >= minNum && valorNum <= maxNum;
            } else {
              cumpleEspecificacion = false; // Si no es un número válido, no cumple
            }
          } else {
            // Lógica TEXTO / CUALITATIVO
            const valorMinimoEsperado =
              especificacion?.valor_Minimo != null
                ? String(especificacion.valor_Minimo).trim().toLowerCase()
                : '';

            if (valorMinimoEsperado.length > 0) {
              cumpleEspecificacion =
                valorIngresado.toLowerCase() === valorMinimoEsperado;
            } else {
              // Si no hay especificación definida, cumple si ingresó algún texto
              cumpleEspecificacion = valorIngresado.length > 0;
            }
          }

          return {
            muestra_id: id_Muestra,
            ciclo_analisis: payload.ciclo_analisis,
            parametro_id: med.id_Parametro,
            valor_Obtenido_Num:
              tipoDato === 'NUMERICO'
                ? new Prisma.Decimal(valorIngresado)
                : null,

            valor_Obtenido_Texto:
              tipoDato === 'NUMERICO' ? null : valorIngresado,
            cumple_Especificacion: cumpleEspecificacion,
            fecha_Resultado: fechaActualIso,
            //hora_Resultado: horaActual,
          };
        }),
      );

      // 3. Insertar todos los resultados en lote en la base de datos
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
    tipoMuestra,
    observaciones,
    analistaNombre,
  }: {
    idMuestra: number;
    dictamen: string;
    tipoMuestra: string;
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
          categoria_Muestra: tipoMuestra as muestras_categoria_Muestra,
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
        if (muestra.lote_id)
          await tx.lotes_produccion.update({
            where: { id_Lote_Produccion: muestra.lote_id },
            data: { estado_Calida: 'EN_ANALISIS' },
          });
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

  async finalizarAnalisis(payload: any) {
    const id = this.tiempos.id(payload?.idMuestra);
    if (
      !Object.values(muestras_categoria_Muestra).includes(payload?.tipoMuestra)
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
      if (typeof m.valor !== 'string' || !m.valor.trim())
        throw new BadRequestException('Resultado vacío');
    }
    const resultado = await this.prisma.$transaction(
      async (tx) => {
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
          ...payload,
          idMuestra: id,
        });
        if (!dictamen.success || !dictamen.count)
          throw new BadRequestException(
            dictamen.error || 'No se guardó el dictamen',
          );
        if (muestra.lote_id)
          await tx.lotes_produccion.update({
            where: { id_Lote_Produccion: muestra.lote_id },
            data: { estado_Calida: payload.dictamen },
          });
        if (muestra.lote_inventario_id)
          await tx.lotes_inventario.update({
            where: { id: muestra.lote_inventario_id },
            data: {
              estado_calidad_recepcion:
                payload.dictamen === 'APROBADO' ? 'LIBERADO' : 'RECHAZADO',
              liberado_en: payload.dictamen === 'APROBADO' ? new Date() : null,
              liberado_por:
                payload.dictamen === 'APROBADO'
                  ? payload.analistaNombre || 'Calidad'
                  : null,
            },
          });
        await this.tiempos.transicion(tx, ctx, null);
        await this.tiempos.evento(tx, ctx, tramo.ciclo, 'FIN_ANALISIS', {
          dictamen: payload.dictamen,
          tipoMuestra: payload.tipoMuestra,
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
      if (muestra.lote_id)
        await tx.lotes_produccion.update({
          where: { id_Lote_Produccion: muestra.lote_id },
          data: { estado_Calida: 'APROBADO' },
        });
      if (muestra.lote_inventario_id)
        await tx.lotes_inventario.update({
          where: { id: muestra.lote_inventario_id },
          data: {
            estado_calidad_recepcion: 'LIBERADO',
            liberado_en: new Date(),
            liberado_por: 'Calidad: liberación manual',
          },
        });
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
          estado_checklist: { in: ['PENDIENTE', 'EN_REVISION'] },
        },
        include: {
          remitente: { select: { nombre: true } },
          materiales: { include: { producto: true } },
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
    if (
      !payload.reviso_nombre?.trim() ||
      !Array.isArray(payload.contenedores) ||
      !payload.contenedores.length
    )
      throw new BadRequestException('Captura responsable y contenedores');
    if (!['COMPLETADO', 'CON_INCIDENCIAS'].includes(payload.estado_checklist))
      throw new BadRequestException('Estado de checklist inválido');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lotes_llegada WHERE id=${id} FOR UPDATE`;
      const recepcion = await tx.lotes_llegada.findUnique({ where: { id } });
      if (!recepcion || recepcion.estado_recepcion === 'CANCELADA')
        throw new BadRequestException('Recepción no disponible');
      if (
        ['COMPLETADO', 'CON_INCIDENCIAS'].includes(recepcion.estado_checklist)
      )
        throw new BadRequestException('La recepción ya fue revisada');
      await tx.checklist_contenedor.createMany({
        data: payload.contenedores.map((c: ContenedorInput) => ({
          lote_llegada_id: id,
          no_consecutivo: this.tiempos.id(c.no_consecutivo),
          numero_contenedor: c.numero_contenedor,
          tapa_valvula: booleanInput(c.tapa_valvula),
          rejilla_danada: booleanInput(c.rejilla_danada),
          base_danada: booleanInput(c.base_danada),
          derrame: booleanInput(c.derrame),
          observaciones: c.observaciones || null,
        })),
      });
      return tx.lotes_llegada.update({
        where: { id },
        data: {
          reviso_nombre: payload.reviso_nombre.trim(),
          fecha_Revision: new Date(),
          estado_checklist: payload.estado_checklist,
        },
      });
    });
    return { success: true, result };
  }
}
