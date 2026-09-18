import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'; 
import { PrismaService } from '../prisma.service'; 
import {lotes_produccion_estado_Calida, muestras_estado_Muestra } from '@prisma/client';

@Injectable() 
export class CalidadService { 
  constructor(private readonly prisma: PrismaService) {} 
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
        cantidad_Total_Producida: true,
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
      result: muestras,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async buscarEspecificacionesMuestra(muestraID: number) {
    try {
      const id = Number(muestraID);
      
      if (isNaN(id)) {
        throw new NotFoundException('El ID de la muestra proporcionado no es válido.');
      }

      const especificaciones = await this.prisma.resultado_analisis.findMany({
        where: {
          muestra_id: id,
        },
        select: {
          valor_Obtenido_Num: true,
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

      return especificaciones;
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
        personas: {
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
            cantidad_Total_Producida: true,
            equipos_tanques: { // Include para obtener el nombre/datos del tanque
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
        }
      },
      where: {
        estado_Muestra: {
          in: ['APROBADO', 'RECHAZADO'],
        },
      },
    });

    return {
      success: true,
      result: muestras,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async crearResultadosMuestraCalidad(payload: {
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
      const horaActual = ahora.toTimeString().split(' ')[0];  // "HH:MM:SS"

      // 2. Procesar cada medición
      const resultadosAInsertar = await Promise.all(
        mediciones.map(async (med) => {
          // Consultar el tipo de parámetro
          const parametro = await this.prisma.parametros_laboratorio.findUnique({
            where: { id_Parametro: med.id_Parametro },
          });

          // Consultar la especificación configurada para este producto y parámetro
          const especificacion = await this.prisma.especificaciones_producto.findFirst({
            where: {
              producto_id: idProducto,
              parametro_id: med.id_Parametro,
            },
          });

          let cumpleEspecificacion = false;
          // Convertimos el valor ingresado asegurando que siempre sea un string limpio
          const valorIngresado = String(med.valor ?? '').trim();

          // Evaluamos el tipo de dato del parámetro de forma segura
          const tipoDato = String(parametro?.tipo_Dato ?? '').toUpperCase();

          if (tipoDato === 'NUMERICO') {
            // Lógica NUMÉRICA
            const valorNum = parseFloat(valorIngresado);

            // Convertimos a String primero para evitar fallos con Decimal de Prisma o nulls
            const minStr = especificacion?.valor_Minimo != null ? String(especificacion.valor_Minimo).trim() : null;
            const maxStr = especificacion?.valor_Maximo != null ? String(especificacion.valor_Maximo).trim() : null;

            const minNum = minStr && minStr !== '' ? parseFloat(minStr) : -Infinity;
            const maxNum = maxStr && maxStr !== '' ? parseFloat(maxStr) : Infinity;

            if (!isNaN(valorNum)) {
              cumpleEspecificacion = valorNum >= minNum && valorNum <= maxNum;
            } else {
              cumpleEspecificacion = false; // Si no es un número válido, no cumple
            }
          } else {
            // Lógica TEXTO / CUALITATIVO
            const valorMinimoEsperado = especificacion?.valor_Minimo != null 
              ? String(especificacion.valor_Minimo).trim().toLowerCase() 
              : '';

            if (valorMinimoEsperado.length > 0) {
              cumpleEspecificacion = valorIngresado.toLowerCase() === valorMinimoEsperado;
            } else {
              // Si no hay especificación definida, cumple si ingresó algún texto
              cumpleEspecificacion = valorIngresado.length > 0;
            }
          }

          return {
            muestra_id: id_Muestra,
            parametro_id: med.id_Parametro,
            valor_Obtenido_Num: valorIngresado,
            cumple_Especificacion: cumpleEspecificacion,
            fecha_Resultado: fechaActualIso,
            //hora_Resultado: horaActual,
          };
        })
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

  async agregarEspecifProduct(data: any){
    try{
      const especif = await this.prisma.especificaciones_producto.create({
        data
      })
      return{success:true, result: especif}
    }
    catch(error: any){
      return{success:false, error: error.message}
    }
  }

async actualizarEstadoMuestra({
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
    const idOrdenProduc = muestraActual.lotes_produccion?.orden_Produccion_id;

// 3. Si el dictamen es RECHAZADO y no es MUESTRA_AJUSTADO, actualizamos el estatus del flujo en la Orden de Producción
    if (tipoMuestra === 'MUESTRA_AJUSTADO' && dictamen === 'RECHAZADO') {
      if (idOrdenProduc) {
        await this.prisma.ordenes_produccion.updateMany({
          where: {
            id_Orden_Produc: idOrdenProduc,
          },
          data: {
            // Ajusta este campo al valor correspondiente en tu enum de Prisma
            // Ej: 'AJUSTE', 'RECHAZADO', 'REPROCESO', 'CALIDAD_RECHAZADO', etc.
            estatus_flujo: 'produccion' as any, 
          },
        });
      }
    }
    // 2. Actualizamos la muestra
    const update = await this.prisma.muestras.updateMany({
      where: {
        id_Muestra: Number(idMuestra),
      },
      data: {
        estado_Muestra: dictamen as muestras_estado_Muestra,
        categoria_Muestra: tipoMuestra as any,
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

async buscarAnalistas(query: string) {
  try {
    const analistas = await this.prisma.personas.findMany({
      where: {
        nombre: {
          contains: query,
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
      analistas: analistas.map((a) => ({ id: a.id_Persona, nombre: a.nombre })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}




}