import { ProductionService } from './production.service';
export declare class ProductionController {
    private readonly productionService;
    constructor(productionService: ProductionService);
    test(): Promise<{
        success: boolean;
        result: ({
            lotes_produccion: {
                tanque_id: number | null;
                id_Lote_Produccion: number;
                no_Lote: string;
                cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
            }[];
            productos_materiales: {
                id_Produc_Mater: number;
                nombre_Producto: string;
                UM: string;
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
            id_Orden_Produc: number;
            id_Venta_Origen: number | null;
            vendedor_id: number | null;
            cliente_id: number | null;
            linea_Produccion: string | null;
            producto_id: number;
            servicio: string | null;
            cantidad_Venta: number | null;
            fecha_Confirmacion: Date | null;
            fecha_Compromiso: Date | null;
            urgencia: string | null;
            observaciones: string | null;
            no_Orden_Produc: string | null;
            cantidad_Planificada: import("@prisma/client/runtime/library").Decimal | null;
            fecha_Termino_Plan: Date | null;
            inconformidad_Planeacion: string | null;
            Observaciones_Planeacion: string | null;
            fecha_Inicio_Produccion: Date | null;
            fecha_Termino_Real: Date | null;
            observaciones_Produccion: string | null;
            estatus_flujo: string | null;
            fecha_Inicio_Plan: Date | null;
            estado_Plan: import("@prisma/client").$Enums.ordenes_produccion_estado_Plan | null;
        })[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    getTanques(tipo: string): Promise<{
        success: boolean;
        result: unknown;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    actualizar(body: {
        idLoteProduccion: number;
        tanqueId: number | null;
    }): Promise<{
        success: boolean;
        data: void;
    }>;
    actualizarEstatusTanque(body: {
        tanqueId: number;
        estatus_proceso: string;
        idVentaOrigen?: number;
    }): Promise<{
        success: boolean;
        data: void;
    }>;
    actualizarEstatusCalidad(body: {
        idLoteProduccion: number;
        estadoCalidad: 'LIBERADO';
    }): Promise<{
        success: boolean;
        data: import("@prisma/client").Prisma.BatchPayload;
    }>;
}
