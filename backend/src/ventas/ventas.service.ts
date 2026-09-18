import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async crearOrdenVenta(data: any) {
    try {
      return await this.prisma.$transaction(async (tx: any) => {
        
        // -------------------------------------------------------------
        // 1. GESTIÓN DE PERSONA: VENDEDOR (Buscar o Crear)
        // -------------------------------------------------------------
        let vendedorId = Number(data.vendedor_id);

        if (!vendedorId && data.nombreVendedor) {
          // Si no enviaron ID pero sí enviaron el nombre del vendedor
          let vendedor = await tx.personas.findFirst({
            where: {
              nombre: {
                equals: data.nombreVendedor,
              },
              // Si tienes una columna de tipo de persona o rol:
              // tipo: 'Vendedor', 
            },
          });

          if (!vendedor) {
            vendedor = await tx.personas.create({
              data: {
                nombre: data.nombreVendedor,
                tipo_persona: 'Vendedor', // Asegúrate de que este campo exista en tu tabla personas
                // agrega otros campos requeridos de tu tabla persona si aplica (ej. tipo: 'Vendedor')
              },
            });
          }
          vendedorId = Number(vendedor.id_Persona || vendedor.id);
        }

        // -------------------------------------------------------------
        // 2. GESTIÓN DE PERSONA: CLIENTE (Buscar o Crear)
        // -------------------------------------------------------------
        let clienteId = Number(data.cliente_id);

        if (!clienteId && data.cliente) {
          // Si no enviaron ID pero sí enviaron el nombre del cliente
          let cliente = await tx.personas.findFirst({
            where: {
              nombre: {
                equals: data.cliente,
              },
              // tipo: 'Cliente',
            },
          });

          if (!cliente) {
            cliente = await tx.personas.create({
              data: {
                nombre: data.cliente,
                tipo_persona: 'Cliente', // Asegúrate de que este campo exista en tu tabla personas
                // agrega otros campos requeridos de tu tabla persona si aplica (ej. tipo: 'Cliente')
              },
            });
          }
          clienteId = Number(cliente.id_Persona || cliente.id);
        }

        // -------------------------------------------------------------
        // 3. GESTIÓN DE PRODUCTO / MATERIAL (Buscar o Crear)
        // -------------------------------------------------------------
        let producto = await tx.productos_materiales.findFirst({
          where: {
            nombre_Producto: {
              equals: data.producto,
            }
          },
        });

        if (!producto) {
          producto = await tx.productos_materiales.create({
            data: {
              nombre_Producto: data.producto,
              UM: data.unidadMedidaVentas,
              presentacion: data.presentacion,
            },
          });
        }

        const productoId = Number(producto.id_Produc_Mater || producto.id);

        // -------------------------------------------------------------
        // 4. INSERTAR ORDEN DE PRODUCCIÓN
        // -------------------------------------------------------------
        const orden = await tx.ordenes_produccion.create({
          data: {
            id_Venta_Origen: Number(data.idVenta),
            vendedor_id: vendedorId,
            cliente_id: clienteId,
            linea_Produccion: data.lineaProduccion,
            producto_id: productoId,
            servicio: data.servicio,
            cantidad_Venta: Number(data.cantidadVentas),
            fecha_Confirmacion: data.fechaConfirmacion ? new Date(data.fechaConfirmacion) : null,
            fecha_Compromiso: data.fechaCompromisoPago ? new Date(data.fechaCompromisoPago) : null,
            urgencia: data.urgencia,
            observaciones: data.observacionesVentas,
          },
        });

        return { 
          success: true, 
          orden, 
          producto,
          vendedorId,
          clienteId 
        };
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

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

    const etiquetasArea:Record<string, string> = {
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
        label: etiquetasArea[orden.estatus_flujo],
      },
    }));



    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
}