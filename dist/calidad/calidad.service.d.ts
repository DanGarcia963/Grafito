import { PrismaService } from '../prisma.service';
export declare class CalidadService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    obtenerParametrosCalidad(): Promise<{
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
    }>;
    obtenerTodasLasMuestras(): Promise<{
        success: boolean;
        result: ({
            resultado_analisis: {
                id_Resultado_Analisis: number;
                muestra_id: number;
                parametro_id: number;
                valor_Obtenido_Num: string | null;
                cumple_Especificacion: boolean | null;
                fecha_Resultado: Date;
                hora_Resultado: Date | null;
            }[];
            personas_muestras_cliente_idTopersonas: {
                id_Persona: number;
                nombre: string;
                tipo_persona: string;
            };
            lotes_produccion: {
                equipos_tanques: {
                    id_Equipos_Tanques: number;
                    nombre_Equipo: string;
                } | null;
                id_Lote_Produccion: number;
                no_Lote: string;
                cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
            };
            productos_materiales: {
                UM: string;
                id_Produc_Mater: number;
                nombre_Producto: string;
                presentacion: string | null;
            };
            equipos_tanques: {
                id_Equipos_Tanques: number;
                nombre_Equipo: string;
                estatus_proceso: import("@prisma/client").$Enums.equipos_tanques_estatus_proceso;
            };
            personas_muestras_analista_idTopersonas: {
                id_Persona: number;
                nombre: string;
                tipo_persona: string;
            } | null;
        } & {
            id_Muestra: number;
            no_Muestra: string;
            fecha_Toma: Date;
            lote_id: number;
            producto_id: number;
            cliente_id: number;
            tanque_id: number;
            analista_id: number | null;
            etapa_Muestra: import("@prisma/client").$Enums.muestras_etapa_Muestra | null;
            estado_Muestra: import("@prisma/client").$Enums.muestras_estado_Muestra | null;
            categoria_Muestra: import("@prisma/client").$Enums.muestras_categoria_Muestra | null;
            observaciones: string | null;
        })[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
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
        valor_Obtenido_Num: string | null;
        cumple_Especificacion: boolean | null;
    }[]>;
    obtenerTodasMuestrasConDictamen(): Promise<{
        success: boolean;
        result: ({
            lotes_produccion: {
                equipos_tanques: {
                    id_Equipos_Tanques: number;
                    nombre_Equipo: string;
                } | null;
                id_Lote_Produccion: number;
                no_Lote: string;
                cantidad_Total_Producida: import("@prisma/client/runtime/library").Decimal | null;
            };
            productos_materiales: {
                UM: string;
                id_Produc_Mater: number;
                nombre_Producto: string;
                presentacion: string | null;
            };
            equipos_tanques: {
                id_Equipos_Tanques: number;
                nombre_Equipo: string;
                estatus_proceso: import("@prisma/client").$Enums.equipos_tanques_estatus_proceso;
            };
            personas: never;
        } & {
            id_Muestra: number;
            no_Muestra: string;
            fecha_Toma: Date;
            lote_id: number;
            producto_id: number;
            cliente_id: number;
            tanque_id: number;
            analista_id: number | null;
            etapa_Muestra: import("@prisma/client").$Enums.muestras_etapa_Muestra | null;
            estado_Muestra: import("@prisma/client").$Enums.muestras_estado_Muestra | null;
            categoria_Muestra: import("@prisma/client").$Enums.muestras_categoria_Muestra | null;
            observaciones: string | null;
        })[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    crearResultadosMuestraCalidad(payload: {
        id_Muestra: number;
        mediciones: Array<{
            id_Parametro: number;
            valor: string;
        }>;
        observaciones?: string;
    }): Promise<{
        success: boolean;
        count: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        count?: undefined;
    }>;
    agregarEspecifProduct(data: any): Promise<{
        success: boolean;
        result: {
            producto_id: number;
            parametro_id: number;
            id_Especifi_Product: number;
            valor_Minimo: string | null;
            valor_Maximo: import("@prisma/client/runtime/library").Decimal | null;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    actualizarEstadoMuestra({ idMuestra, dictamen, tipoMuestra, observaciones, analistaNombre, }: {
        idMuestra: number;
        dictamen: string;
        tipoMuestra: string;
        observaciones: string;
        analistaNombre?: string;
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
}
