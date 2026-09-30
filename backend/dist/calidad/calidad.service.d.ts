import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { EventsGateway } from '../events.gateway';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
export interface ContenedorInput {
    no_consecutivo: number;
    numero_contenedor: string;
    tapa_valvula: boolean;
    rejilla_danada: boolean;
    base_danada: boolean;
    derrame: boolean;
    observaciones?: string;
}
export interface CrearLoteInput {
    no_lote: string;
    orden_produccion_id: number;
    reviso_nombre: string;
    estado_checklist: 'PENDIENTE' | 'EN_REVISION' | 'COMPLETADO' | 'CON_INCIDENCIAS';
    fecha_llegada: Date;
    fecha_Revision: Date;
    observaciones?: Record<string, any>;
    contenedores: ContenedorInput[];
}
export declare class CalidadService {
    private readonly prisma;
    private readonly tiempos;
    private readonly eventos;
    constructor(prisma: PrismaService, tiempos: TrazabilidadService, eventos: EventsGateway);
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
        result: {
            resultado_analisis: {
                valor_Obtenido_Num: Prisma.Decimal | null;
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
                cantidad_Total_Producida: Prisma.Decimal | null;
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
            cantidad_proyecto: Prisma.Decimal | null;
            unidad_proyecto: string | null;
            viabilidad_id: number | null;
            viabilidad_nombre: string | null;
            fecha_recoleccion: Date | null;
            fecha_ingreso_laboratorio: Date | null;
            ficha_nombre: string | null;
            ficha_mime: string | null;
            ficha_contenido: Prisma.Bytes | null;
        }[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    buscarEspecificacionesMuestra(muestraID: number): Promise<{
        valor_Obtenido_Num: Prisma.Decimal | null;
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
    obtenerTodasMuestrasConDictamen(): Promise<{
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
                cantidad_Total_Producida: Prisma.Decimal | null;
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
            cantidad_proyecto: Prisma.Decimal | null;
            unidad_proyecto: string | null;
            viabilidad_id: number | null;
            viabilidad_nombre: string | null;
            fecha_recoleccion: Date | null;
            fecha_ingreso_laboratorio: Date | null;
            ficha_nombre: string | null;
            ficha_mime: string | null;
            ficha_contenido: Prisma.Bytes | null;
        }[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    private crearResultadosMuestraCalidad;
    agregarEspecifProduct(data: any): Promise<{
        success: boolean;
        result: {
            producto_id: number;
            parametro_id: number;
            valor_Minimo: string | null;
            valor_Maximo: Prisma.Decimal | null;
            id_Especifi_Product: number;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    private actualizarEstadoMuestra;
    cambiarEtapaMuestra(idEntrada: unknown, accion: 'RECIBIR' | 'INICIAR' | 'REABRIR'): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    finalizarAnalisis(payload: any): Promise<{
        success: boolean;
        ciclo: number;
    }>;
    actualizarEstatusMuestra(payload: any): Promise<{
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
            cantidad_proyecto: Prisma.Decimal | null;
            unidad_proyecto: string | null;
            viabilidad_id: number | null;
            viabilidad_nombre: string | null;
            fecha_recoleccion: Date | null;
            fecha_ingreso_laboratorio: Date | null;
            ficha_nombre: string | null;
            ficha_mime: string | null;
            ficha_contenido: Prisma.Bytes | null;
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
    obtenerOrdenesPendientesDeLlegada(fechaFiltro?: Date | string): Promise<{
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
    crearLoteConChecklist(payload: CrearLoteInput): Promise<{
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
}
