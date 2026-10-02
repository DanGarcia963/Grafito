import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerTodasLasOrdenes() {
    try {
      const ordenes = await this.prisma.ordenes_produccion.findMany({
        include: {
          // Incluye los datos del Vendedor (relación con la tabla personas)
          personas_ordenes_produccion_vendedor_idTopersonas: {
            select: {
              id_Persona: true,
              nombre: true,
              tipo_persona: true,
            },
          },
          // Incluye los datos del Cliente (relación con la tabla personas)
          personas_ordenes_produccion_cliente_idTopersonas: {
            select: {
              id_Persona: true,
              nombre: true,
              tipo_persona: true,
            },
          },
          // Incluye los datos del Producto/Material
          productos_materiales: {
            select: {
              id_Produc_Mater: true,
              nombre_Producto: true,
              UM: true,
              presentacion: true,
            },
          },
          // Incluye los lotes generados
          lotes_produccion: true,
        },
        orderBy: {
          id_Orden_Produc: 'desc',
        },
      });

      const etiquetasArea: Record<string, string> = {
        VENTAS: 'ventas',
        PLAN_PRODUCCION: 'plan_produccion',
        PRODUCCION: 'produccion',
        CALIDAD: 'calidad',
        ALMACEN: 'almacen',
        LOGISTICA: 'logistica',
        CLIENTE: 'cliente',
      };
      const result = ordenes.map((orden: any) => ({
        ...orden,
        // 👈 Se construye estadoActual de forma segura y centralizada
        estadoActual: {
          area: orden.estatus_flujo.toLowerCase(),
          label: etiquetasArea[orden.estatus_flujo.toUpperCase()],
        },
      }));

      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
