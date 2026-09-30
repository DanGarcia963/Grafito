import { VentasService } from './ventas.service';
export declare class VentasController {
    private readonly ventasService;
    constructor(ventasService: VentasService);
    crearVenta(body: any): Promise<{
        success: boolean;
        orden: {
            producto_id: number;
            cliente_id: number | null;
            observaciones: string | null;
            vendedor_id: number | null;
            id_Venta_Origen: number | null;
            linea_Produccion: string | null;
            servicio: string;
            cantidad_Venta: number;
            fecha_Compromiso: Date | null;
            fecha_Confirmacion: Date | null;
            fecha_Llegada: Date | null;
            no_Orden_Produc: string | null;
            cantidad_Planificada: import("@prisma/client/runtime/library").Decimal | null;
            fecha_Termino_Plan: Date | null;
            inconformidad_Planeacion: string | null;
            Observaciones_Planeacion: string | null;
            status_Produccion: string;
            fecha_Inicio_Produccion: Date | null;
            fecha_Termino_Real: Date | null;
            cantidad_Producida: number;
            observaciones_Produccion: string | null;
            fecha_Inicio_Plan: Date | null;
            estado_Plan: import("@prisma/client").$Enums.ordenes_produccion_estado_Plan;
            tipo_Operacion: string | null;
            urgencia: import("@prisma/client").$Enums.ordenes_produccion_urgencia;
            estatus_flujo: import("@prisma/client").$Enums.ordenes_produccion_estatus_flujo;
            id_Orden_Produc: number;
        };
        producto: {
            id_Produc_Mater: number;
            codigo_Producto: string | null;
            nombre_Producto: string;
            categoria: import("@prisma/client").$Enums.productos_materiales_categoria | null;
            UM: import("@prisma/client").$Enums.productos_materiales_UM;
            presentacion: string | null;
            descripcion: string | null;
        };
        vendedorId: number;
        clienteId: number;
    } | {
        success: boolean;
        error: any;
    }>;
    test(): Promise<{
        success: boolean;
        result: any[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
}
