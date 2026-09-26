import { CalidadService } from './calidad.service';
export declare class CalidadController {
    private readonly calidadService;
    constructor(calidadService: CalidadService);
    obtenerParametros(): Promise<{
        success: boolean;
        data: {
            success: boolean;
            result: {
                UM: string | null;
                id_Parametro: number;
                nombre_Parametro: string;
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
                tiempoActual: {
                    id: number;
                    entidad: string;
                    entidad_id: number;
                    lote_id: number | null;
                    tanque_id: number | null;
                    ciclo: number;
                    etapa: string;
                    inicio: Date;
                    fin: Date | null;
                    activo: string | null;
                } | null;
                equipos_tanques: {
                    id_Equipos_Tanques: number;
                    nombre_Equipo: string;
                    estatus_proceso: import("@prisma/client").$Enums.equipos_tanques_estatus_proceso;
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
                    id_Produc_Mater: number;
                    nombre_Producto: string;
                    UM: import("@prisma/client").$Enums.productos_materiales_UM;
                    presentacion: string | null;
                };
                resultado_analisis: {
                    muestra_id: number;
                    id_Resultado_Analisis: number;
                    parametro_id: number;
                    valor_Obtenido_Num: import("@prisma/client/runtime/library").Decimal | null;
                    cumple_Especificacion: boolean | null;
                    fecha_Resultado: Date;
                    hora_Resultado: Date | null;
                    ciclo_analisis: number | null;
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
                lote_id: number | null;
                tanque_id: number | null;
                id_Muestra: number;
                no_Muestra: string;
                fecha_Toma: Date;
                Hora_Toma: Date | null;
                procedencia_Origen: string | null;
                producto_id: number;
                proveedor_id: number | null;
                cliente_id: number | null;
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
        muestras: {
            id_Muestra: number;
            no_Muestra: string;
        };
        parametros_laboratorio: {
            id_Parametro: number;
            nombre_Parametro: string;
        };
        valor_Obtenido_Num: import("@prisma/client/runtime/library").Decimal | null;
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
                    id: number;
                    entidad: string;
                    entidad_id: number;
                    lote_id: number | null;
                    tanque_id: number | null;
                    ciclo: number;
                    etapa: string;
                    inicio: Date;
                    fin: Date | null;
                    activo: string | null;
                } | null;
                equipos_tanques: {
                    id_Equipos_Tanques: number;
                    nombre_Equipo: string;
                    estatus_proceso: import("@prisma/client").$Enums.equipos_tanques_estatus_proceso;
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
                    id_Produc_Mater: number;
                    nombre_Producto: string;
                    UM: import("@prisma/client").$Enums.productos_materiales_UM;
                    presentacion: string | null;
                };
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
                lote_id: number | null;
                tanque_id: number | null;
                id_Muestra: number;
                no_Muestra: string;
                fecha_Toma: Date;
                Hora_Toma: Date | null;
                procedencia_Origen: string | null;
                producto_id: number;
                proveedor_id: number | null;
                cliente_id: number | null;
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
    actualizarEstadoMuestra(body: {
        idMuestra: number;
        dictamen: string;
        tipoMuestra: string;
        observaciones: string;
    }): Promise<void>;
    actualizarEstatusMuestra(body: unknown): Promise<{
        success: boolean;
        data: {
            lote_id: number | null;
            tanque_id: number | null;
            id_Muestra: number;
            no_Muestra: string;
            fecha_Toma: Date;
            Hora_Toma: Date | null;
            procedencia_Origen: string | null;
            producto_id: number;
            proveedor_id: number | null;
            cliente_id: number | null;
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
            id: number;
            observaciones: string | null;
            no_lote: string;
            orden_produccion_id: number | null;
            reviso_nombre: string;
            estado_checklist: import("@prisma/client").$Enums.lotes_llegada_estado_checklist;
            fecha_llegada: Date;
            fecha_Revision: Date;
            createdAt: Date;
            updatedAt: Date;
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
