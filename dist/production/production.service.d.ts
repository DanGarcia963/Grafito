import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { EventsGateway } from '../events.gateway';
import { PrismaService } from '../prisma.service';
export declare class ProductionService {
    private readonly prisma;
    private readonly tiempos;
    private readonly eventos;
    constructor(prisma: PrismaService, tiempos: TrazabilidadService, eventos: EventsGateway);
    obtenerTodasLasOrdenesGrafito(): Promise<{
        success: boolean;
        result: ({
            lotes_produccion: {
                tanque_id: number | null;
                id_Lote_Produccion: number;
                no_Lote: string;
                cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
                bitacora: string | null;
            }[];
            productos_materiales: {
                id_Produc_Mater: number;
                nombre_Producto: string;
                UM: import("@prisma/client").$Enums.productos_materiales_UM;
                presentacion: string | null;
            };
            personas_ordenes_produccion_cliente_idTopersonas: {
                id_Persona: number;
                nombre: string;
                tipo_persona: string;
            } | null;
            personas_ordenes_produccion_vendedor_idTopersonas: {
                id_Persona: number;
                nombre: string;
                tipo_persona: string;
            } | null;
        } & {
            producto_id: number;
            cliente_id: number | null;
            observaciones: string | null;
            vendedor_id: number | null;
            id_Orden_Produc: number;
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
        })[];
        bitacora: any[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
        bitacora?: undefined;
    }>;
    tanquesAreaProduccion(tipo: string): Promise<{
        success: boolean;
        result: unknown;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    actualizarTanque({ idLoteProduccion, tanqueId }: {
        idLoteProduccion: number;
        tanqueId: number | null;
    }): Promise<{
        idLoteProduccion: number;
        tanqueId: number | null;
    }>;
    actualizarEstatusCalidad({ idLoteProduccion }: {
        idLoteProduccion: number;
        estadoCalidad: 'LIBERADO';
    }): Promise<{
        tanque_id: number | null;
        producto_id: number;
        id_Lote_Produccion: number;
        no_Lote: string;
        orden_Produccion_id: number;
        cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
        bitacora: string | null;
        fecha_Fabricacion: Date | null;
        fecha_Caducidad: Date | null;
        estado_Calida: import("@prisma/client").$Enums.lotes_produccion_estado_Calida;
        observaciones_Calidad: string | null;
    }>;
    agregarRegistroBitacora({ idLoteProduccion, registro }: {
        idLoteProduccion: number;
        registro: any;
    }): Promise<{
        id_Lote_Produccion: number;
        bitacora: any[];
    }>;
    actualizarEstatusTanque({ tanqueId, estatus_proceso }: {
        tanqueId: number;
        estatus_proceso: string;
        idVentaOrigen?: number;
    }): Promise<{
        muestraId: number | null;
        cambio: boolean;
    }>;
}
