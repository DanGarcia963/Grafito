import { Injectable } from '@nestjs/common'; 
import { PrismaService } from '../prisma.service'; 
import { equipos_tanques_estatus_proceso, lotes_produccion_estado_Calida, muestras_estado_Muestra, muestras_etapa_Muestra, ordenes_produccion_estatus_flujo } from '@prisma/client'; // <-- 1. Importar el Enum de Prisma

@Injectable() 
export class ProductionService { 
  constructor(private readonly prisma: PrismaService) {} 

  async obtenerTodasLasOrdenesGrafito() { 
    try { 
      const grafitos = await this.prisma.ordenes_produccion.findMany({ 
        include: { 
          personas_ordenes_produccion_vendedor_idTopersonas: { 
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
              tanque_id: true, 
            }, 
          }, 
   
          personas_ordenes_produccion_cliente_idTopersonas: { 
            select: { 
              id_Persona: true, 
              nombre: true, 
              tipo_persona: true, 
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
        },
        where: { 
          linea_Produccion: 'GRAFITO',
          lotes_produccion:{
            some: {},
          }
         },
        orderBy: { fecha_Confirmacion: 'desc' } 
      }); 
      return { success: true, result: grafitos }; 
    } catch (error: any) { 
      return { success: false, error: error.message }; 
    } 
  } 
 
async tanquesAreaProduccion(tipo: string) { 
  try { 
    // Usamos queryRaw o ignoramos la validación estricta del Enum mapeando la respuesta
    const tanques = await this.prisma.$queryRaw`
      SELECT 
        id_Equipos_Tanques, 
        codigo_Equipo, 
        nombre_Equipo, 
        status, 
        estatus_proceso 
      FROM equipos_tanques 
      WHERE tipo = ${tipo}
    `;

    return { success: true, result: tanques }; 
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }  
}

  async actualizarTanque({ idLoteProduccion, tanqueId }: { idLoteProduccion: number; tanqueId: number | null }) { 
    const targetTanqueId = tanqueId !== null && tanqueId !== undefined ? Number(tanqueId) : null;

    // Actualizamos el tanque_id y enviamos un valor válido de bitacora para satisfacer el CONSTRAINT
  await this.prisma.lotes_produccion.updateMany({
  where: {
    id_Lote_Produccion: Number(idLoteProduccion),
  },
  data: {
    tanque_id: targetTanqueId,
  },
});
  } 

  async actualizarEstatusCalidad({
    idLoteProduccion,
    estadoCalidad,
  }: {
    idLoteProduccion: number;
    estadoCalidad: 'LIBERADO';
  }) {
    return await this.prisma.lotes_produccion.updateMany({
      where: { id_Lote_Produccion: Number(idLoteProduccion) },
      data: {
        estado_Calida: 'LIBERADO' as lotes_produccion_estado_Calida,
      },
    });
  }

async agregarRegistroBitacora({
  idLoteProduccion,
  registro,
}: {
  idLoteProduccion: number;
  registro: any;
}) {
  const lote = await this.prisma.lotes_produccion.findUnique({
    where: {
      id_Lote_Produccion: Number(idLoteProduccion),
    },
    select: {
      id_Lote_Produccion: true,
      bitacora: true,
    },
  });

  if (!lote) {
    throw new Error(
      `No se encontró el lote de producción ${idLoteProduccion}`
    );
  }

  // Obtener la bitácora existente
  let bitacoraActual: any[] = [];

  if (Array.isArray(lote.bitacora)) {
    bitacoraActual = lote.bitacora;
  } else if (typeof lote.bitacora === 'string') {
    try {
      const parsed = JSON.parse(lote.bitacora);
      bitacoraActual = Array.isArray(parsed) ? parsed : [];
    } catch {
      bitacoraActual = [];
    }
  }

  // Agregar el nuevo registro al historial existente
  const nuevaBitacora = [
    ...bitacoraActual,
    registro,
  ];

  // Guardar nuevamente el JSON completo
  await this.prisma.lotes_produccion.update({
    where: {
      id_Lote_Produccion: Number(idLoteProduccion),
    },
    data: {
      bitacora: JSON.stringify(nuevaBitacora),
    },
  });

  return {
    id_Lote_Produccion: lote.id_Lote_Produccion,
    bitacora: nuevaBitacora,
  };
}

async actualizarEstatusTanque({
  tanqueId,
  estatus_proceso,
  idVentaOrigen,
}: {
  tanqueId: number;
  estatus_proceso: string;
  idVentaOrigen?: number;
}) {
  // Convertir espacios a guiones bajos para coincidir con tu Enum en Prisma
  const statusFormatted = estatus_proceso
    ? estatus_proceso.trim().replace(/ /g, '_')
    : 'VACIO';

  // 1. Declaramos las variables permitiendo sus tipos de Prisma o null
  let ordenVenta: {
    id_Orden_Produc: number;
    producto_id: number | null;
    cliente_id: number | null;
  } | null = null;

  let lote: {
    id_Lote_Produccion: number;
    no_Lote: string | null;
  } | null = null;

  // Solo buscamos orden y lote si idVentaOrigen viene presente
  if (idVentaOrigen) {
    ordenVenta = await this.prisma.ordenes_produccion.findFirst({
      where: { id_Venta_Origen: Number(idVentaOrigen) },
      select: { id_Orden_Produc: true, producto_id: true, cliente_id: true },
    });

    if (ordenVenta?.id_Orden_Produc) {
      lote = await this.prisma.lotes_produccion.findFirst({
        where: { orden_Produccion_id: ordenVenta.id_Orden_Produc },
        select: { id_Lote_Produccion: true, no_Lote: true },
      });
    }
  }

  // --- Caso: MUESTREO ---
  if (statusFormatted === 'MUESTREO' && idVentaOrigen) {
    if (!lote || !lote.no_Lote) {
      console.warn(
        `[MUESTREO] No se encontró un lote válido asociado a la venta ID: ${idVentaOrigen}`
      );
    } else {
      // Al haber validado que lote y lote.no_Lote existen, TypeScript deduce que es string
      const noMuestra: string = lote.no_Lote.slice(0, 5);
      console.log('Número de Muestra generado:', noMuestra);

      await this.prisma.muestras.create({
        data: {
          no_Muestra: noMuestra,
          fecha_Toma: new Date().toLocaleString('es-MX'),
          tanque_id: Number(tanqueId),
          lote_id: Number(lote.id_Lote_Produccion),
          producto_id: Number(ordenVenta?.producto_id),
          cliente_id: Number(ordenVenta?.cliente_id),
        },
      });
    }
  }

// --- Caso: ESPERA_CALIDAD ---
if (statusFormatted === 'ESPERA_CALIDAD' && idVentaOrigen) {
  // 1. Actualizar el flujo de la orden
  await this.prisma.ordenes_produccion.updateMany({
    where: {
      id_Venta_Origen: Number(idVentaOrigen),
    },
    data: {
      estatus_flujo: 'calidad' as ordenes_produccion_estatus_flujo,
    },
  });

  // 2. Actualizar ÚNICAMENTE la muestra vinculada a este tanque y este lote
  if (lote?.id_Lote_Produccion) {
    await this.prisma.muestras.updateMany({
      where: {
        lote_id: Number(lote.id_Lote_Produccion),
        tanque_id: Number(tanqueId), // <-- FILTRO CLAVE: Solo el tanque actual
        estado_Muestra: {
          notIn: ['APROBADO', 'RECHAZADO'], // Evitamos tocar muestras ya finalizadas del mismo tanque/lote
        },
      },
      data: {
        estado_Muestra: 'EN_ANALISIS' as muestras_estado_Muestra,
      },
    });
  }
}



  // --- Actualización general del estatus del tanque ---
  await this.prisma.equipos_tanques.updateMany({
    where: {
      id_Equipos_Tanques: Number(tanqueId),
    },
    data: {
      estatus_proceso: statusFormatted as equipos_tanques_estatus_proceso,
    },
  });
}
}