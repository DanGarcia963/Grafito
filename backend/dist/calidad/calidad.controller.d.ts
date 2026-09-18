import { CalidadService } from './calidad.service';
export declare class CalidadController {
    private readonly calidadService;
    constructor(calidadService: CalidadService);
    obtenerParametros(): Promise<{
        success: boolean;
        data: {
            success: boolean;
            result: {
                id_Parametro: number;
                nombre_Parametro: string;
                UM: string | null;
                tipo_Dato: import("@prisma/client").$Enums.parametros_laboratorio_tipo_Dato;
            }[];
            error?: undefined;
        } | {
            success: boolean;
            error: any;
            result?: undefined;
        };
    }>;
    obtenerMuestras(): Promise<{
        success: boolean;
        data: {
            success: boolean;
            result: ({
                resultado_analisis: {
                    id_Resultado_Analisis: number;
                    muestra_id: number;
                    parametro_id: number;
                    valor_Obtenido_Num: import("@prisma/client/runtime/library").Decimal | null;
                    cumple_Especificacion: boolean | null;
                    fecha_Resultado: Date;
                    hora_Resultado: Date | null;
                }[];
                personas_muestras_analista_idTopersonas: {
                    id_Persona: number;
                    nombre: string;
                    tipo_persona: string;
                } | null;
                personas_muestras_cliente_idTopersonas: {
                    id_Persona: number;
                    nombre: string;
                    tipo_persona: string;
                } | null;
                lotes_produccion: {
                    equipos_tanques: {
                        id_Equipos_Tanques: number;
                        nombre_Equipo: string;
                    } | null;
                    id_Lote_Produccion: number;
                    no_Lote: string;
                    cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
                } | null;
                productos_materiales: {
                    UM: import("@prisma/client").$Enums.productos_materiales_UM;
                    id_Produc_Mater: number;
                    nombre_Producto: string;
                    presentacion: string | null;
                };
                equipos_tanques: {
                    id_Equipos_Tanques: number;
                    nombre_Equipo: string;
                    estatus_proceso: import("@prisma/client").$Enums.equipos_tanques_estatus_proceso;
                } | null;
            } & {
                id_Muestra: number;
                no_Muestra: string;
                fecha_Toma: Date;
                Hora_Toma: Date | null;
                procedencia_Origen: string | null;
                lote_id: number | null;
                producto_id: number;
                proveedor_id: number | null;
                cliente_id: number | null;
                tanque_id: number | null;
                analista_id: number | null;
                etapa_Muestra: import("@prisma/client").$Enums.muestras_etapa_Muestra | null;
                estado_Muestra: import("@prisma/client").$Enums.muestras_estado_Muestra;
                categoria_Muestra: import("@prisma/client").$Enums.muestras_categoria_Muestra;
                observaciones: string | null;
            })[];
            error?: undefined;
        } | {
            success: boolean;
            error: any;
            result?: undefined;
        };
    }>;
    buscarEspecificacionesMuestra(muestraID: number): Promise<{
        parametros_laboratorio: {
            id_Parametro: number;
            nombre_Parametro: string;
        };
        muestras: {
            id_Muestra: number;
            no_Muestra: string;
        };
        valor_Obtenido_Num: import("@prisma/client/runtime/library").Decimal | null;
        cumple_Especificacion: boolean | null;
    }[]>;
    obtenerMuestrasDictaminadas(): Promise<{
        success: boolean;
        data: {
            success: boolean;
            result: ({
                personas_muestras_analista_idTopersonas: {
                    id_Persona: number;
                    nombre: string;
                    tipo_persona: string;
                } | null;
                personas_muestras_cliente_idTopersonas: {
                    id_Persona: number;
                    nombre: string;
                    tipo_persona: string;
                } | null;
                lotes_produccion: {
                    equipos_tanques: {
                        id_Equipos_Tanques: number;
                        nombre_Equipo: string;
                    } | null;
                    id_Lote_Produccion: number;
                    no_Lote: string;
                    cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
                } | null;
                productos_materiales: {
                    UM: import("@prisma/client").$Enums.productos_materiales_UM;
                    id_Produc_Mater: number;
                    nombre_Producto: string;
                    presentacion: string | null;
                };
                equipos_tanques: {
                    id_Equipos_Tanques: number;
                    nombre_Equipo: string;
                    estatus_proceso: import("@prisma/client").$Enums.equipos_tanques_estatus_proceso;
                } | null;
            } & {
                id_Muestra: number;
                no_Muestra: string;
                fecha_Toma: Date;
                Hora_Toma: Date | null;
                procedencia_Origen: string | null;
                lote_id: number | null;
                producto_id: number;
                proveedor_id: number | null;
                cliente_id: number | null;
                tanque_id: number | null;
                analista_id: number | null;
                etapa_Muestra: import("@prisma/client").$Enums.muestras_etapa_Muestra | null;
                estado_Muestra: import("@prisma/client").$Enums.muestras_estado_Muestra;
                categoria_Muestra: import("@prisma/client").$Enums.muestras_categoria_Muestra;
                observaciones: string | null;
            })[];
            error?: undefined;
        } | {
            success: boolean;
            error: any;
            result?: undefined;
        };
    }>;
    crearResultado(body: any): Promise<{
        success: boolean;
        count: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        count?: undefined;
    }>;
    crearVenta(body: any): Promise<{
        success: boolean;
        result: {
            producto_id: number;
            parametro_id: number;
            id_Especifi_Product: number;
            valor_Minimo: import("@prisma/client/runtime/library").Decimal | null;
            valor_Maximo: import("@prisma/client/runtime/library").Decimal | null;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    actualizarEstadoMuestra(body: {
        idMuestra: number;
        dictamen: string;
        tipoMuestra: string;
        observaciones: string;
    }): Promise<{
        success: boolean;
        count: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        count?: undefined;
    }>;
    buscarAnalistas(query: string): Promise<{
        success: boolean;
        analistas: {
            id: number;
            nombre: string;
        }[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        analistas?: undefined;
    }>;
    obtenerOrdenesPendientesDeLlegada(fechaFiltro?: string): Promise<{
        success: boolean;
        result: {
            id_Orden_Produc: number;
            fecha_Llegada: Date | null;
        }[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    crearLoteConChecklist(body: any): Promise<{
        success: boolean;
        result: {
            observaciones: string | null;
            no_lote: string;
            fecha_llegada: Date;
            fecha_Revision: Date;
            reviso_nombre: string;
            estado_checklist: import("@prisma/client").$Enums.lotes_llegada_estado_checklist;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            orden_produccion_id: number | null;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
}
