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
            result: {
                resultado_analisis: {
                    valor_Obtenido_Num: import("@prisma/client/runtime/library").Decimal | null;
                    id_Resultado_Analisis: number;
                    muestra_id: number;
                    parametro_id: number;
                    cumple_Especificacion: boolean | null;
                    fecha_Resultado: Date;
                    hora_Resultado: Date | null;
                    ciclo_analisis: number | null;
                }[];
                tiempoActual: {
                    lote_id: number | null;
                    tanque_id: number | null;
                    id: number;
                    entidad: string;
                    entidad_id: number;
                    ciclo: number;
                    etapa: string;
                    inicio: Date;
                    fin: Date | null;
                    activo: string | null;
                } | null;
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
                id_Muestra: number;
                no_Muestra: string | null;
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
                area_Muestra: string;
                vendedor_id: number | null;
                caracterizacion: string | null;
                cantidad_proyecto: import("@prisma/client/runtime/library").Decimal | null;
                unidad_proyecto: string | null;
                viabilidad_id: number | null;
                viabilidad_nombre: string | null;
                fecha_recoleccion: Date | null;
                fecha_ingreso_laboratorio: Date | null;
                ficha_nombre: string | null;
                ficha_mime: string | null;
                ficha_contenido: import("@prisma/client/runtime/library").Bytes | null;
            }[];
            error?: undefined;
        } | {
            success: boolean;
            error: any;
            result?: undefined;
        };
    }>;
    buscarEspecificacionesMuestra(muestraID: number): Promise<{
        valor_Obtenido_Num: import("@prisma/client/runtime/library").Decimal | null;
        parametros_laboratorio: {
            id_Parametro: number;
            nombre_Parametro: string;
        };
        muestras: {
            id_Muestra: number;
            no_Muestra: string | null;
        };
        cumple_Especificacion: boolean | null;
        fecha_Resultado: Date;
        ciclo_analisis: number | null;
    }[]>;
    obtenerMuestrasDictaminadas(): Promise<{
        success: boolean;
        data: {
            success: boolean;
            result: {
                tiempoActual: {
                    lote_id: number | null;
                    tanque_id: number | null;
                    id: number;
                    entidad: string;
                    entidad_id: number;
                    ciclo: number;
                    etapa: string;
                    inicio: Date;
                    fin: Date | null;
                    activo: string | null;
                } | null;
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
                id_Muestra: number;
                no_Muestra: string | null;
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
                area_Muestra: string;
                vendedor_id: number | null;
                caracterizacion: string | null;
                cantidad_proyecto: import("@prisma/client/runtime/library").Decimal | null;
                unidad_proyecto: string | null;
                viabilidad_id: number | null;
                viabilidad_nombre: string | null;
                fecha_recoleccion: Date | null;
                fecha_ingreso_laboratorio: Date | null;
                ficha_nombre: string | null;
                ficha_mime: string | null;
                ficha_contenido: import("@prisma/client/runtime/library").Bytes | null;
            }[];
            error?: undefined;
        } | {
            success: boolean;
            error: any;
            result?: undefined;
        };
    }>;
    crearResultado(body: any): Promise<void>;
    crearVenta(body: any): Promise<{
        success: boolean;
        result: {
            producto_id: number;
            parametro_id: number;
            valor_Minimo: string | null;
            valor_Maximo: import("@prisma/client/runtime/library").Decimal | null;
            id_Especifi_Product: number;
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
    }): Promise<void>;
    actualizarEstatusMuestra(body: unknown): Promise<{
        success: boolean;
        data: {
            id_Muestra: number;
            no_Muestra: string | null;
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
            area_Muestra: string;
            vendedor_id: number | null;
            caracterizacion: string | null;
            cantidad_proyecto: import("@prisma/client/runtime/library").Decimal | null;
            unidad_proyecto: string | null;
            viabilidad_id: number | null;
            viabilidad_nombre: string | null;
            fecha_recoleccion: Date | null;
            fecha_ingreso_laboratorio: Date | null;
            ficha_nombre: string | null;
            ficha_mime: string | null;
            ficha_contenido: import("@prisma/client/runtime/library").Bytes | null;
        };
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
            observaciones: string | null;
            id_Orden_Produc: number;
            linea_Produccion: string | null;
            cantidad_Venta: number;
            fecha_Llegada: Date | null;
            no_Orden_Produc: string | null;
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
            id: number;
            no_lote: string;
            fecha_llegada: Date;
            fecha_Revision: Date;
            reviso_nombre: string;
            estado_checklist: import("@prisma/client").$Enums.lotes_llegada_estado_checklist;
            createdAt: Date;
            updatedAt: Date;
            orden_produccion_id: number | null;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    finalizar(body: any): Promise<{
        success: boolean;
        ciclo: number;
    }>;
    recibir(id: number): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    iniciar(id: number): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    reabrir(id: number): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
}
