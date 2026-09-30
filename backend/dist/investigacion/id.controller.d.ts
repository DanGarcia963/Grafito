import type { Response } from 'express';
import 'multer';
import { InvestigacionService } from './id.service';
export declare class InvestigacionController {
    private servicio;
    constructor(servicio: InvestigacionService);
    catalogos(): Promise<{
        success: boolean;
        viabilidades: {
            id: number;
            activo: boolean;
            nombre: string;
        }[];
        procesos: {
            id: number;
            activo: boolean;
            nombre: string;
            estandar_segundos: number | null;
            version: number;
        }[];
    }>;
    referencias(q: string): Promise<{
        success: boolean;
        productos: {
            id_Produc_Mater: number;
            nombre_Producto: string;
        }[];
        clientes: {
            id_Persona: number;
            nombre: string;
        }[];
    }>;
    procesoCatalogo(body: any, req: any): Promise<{
        success: boolean;
        data: any;
    }>;
    viabilidad(body: any, req: any): Promise<{
        success: boolean;
        data: any;
    }>;
    crear(body: any, ficha: any, req: any): Promise<{
        success: boolean;
        data: {
            id_Muestra: number;
        };
    }>;
    listar(req: any, pagina: string): Promise<{
        success: boolean;
        total: number;
        pagina: number;
        data: {
            procesos_id: {
                duracionSegundos: number | null;
                esperaSegundos: number | null;
                desviacionSegundos: number | null;
                desviacionPorcentaje: number | null;
                id: number;
                ciclo: number;
                inicio: Date | null;
                fin: Date | null;
                nombre: string;
                orden: number;
                estandar_segundos: number | null;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            productos_materiales: {
                nombre_Producto: string;
            };
            id_ejecuciones: {
                id: number;
                ciclo: number;
                inicio: Date | null;
                fin: Date | null;
                nombre: string;
                orden: number;
                estandar_segundos: number | null;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            id_Muestra: number;
            no_Muestra: string | null;
            producto_id: number;
            cliente_id: number | null;
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
            personas_muestras_cliente_idTopersonas: {
                nombre: string;
            } | null;
            personas_muestras_vendedor_idTopersonas: {
                nombre: string;
            } | null;
        }[];
    }>;
    detalle(id: number, req: any): Promise<{
        success: boolean;
        data: {
            procesos_id: {
                duracionSegundos: number | null;
                esperaSegundos: number | null;
                desviacionSegundos: number | null;
                desviacionPorcentaje: number | null;
                id: number;
                ciclo: number;
                inicio: Date | null;
                fin: Date | null;
                nombre: string;
                orden: number;
                estandar_segundos: number | null;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            eventos: {
                id: number;
                entidad: string;
                entidad_id: number;
                lote_id: number | null;
                tanque_id: number | null;
                ciclo: number;
                accion: string;
                fecha: Date;
                detalle: string | null;
            }[];
            productos_materiales: {
                nombre_Producto: string;
            };
            id_ejecuciones: {
                id: number;
                ciclo: number;
                inicio: Date | null;
                fin: Date | null;
                nombre: string;
                orden: number;
                estandar_segundos: number | null;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            id_Muestra: number;
            no_Muestra: string | null;
            producto_id: number;
            cliente_id: number | null;
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
            personas_muestras_cliente_idTopersonas: {
                nombre: string;
            } | null;
            personas_muestras_vendedor_idTopersonas: {
                nombre: string;
            } | null;
        };
    }>;
    ficha(id: number, req: any, res: Response): Promise<void>;
    plan(id: number, body: any, req: any): Promise<{
        success: boolean;
    }>;
    recibir(id: number, req: any): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    iniciar(id: number, e: number, req: any): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    terminar(id: number, e: number, body: any, req: any): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    finalizar(id: number, body: any, req: any): Promise<{
        success: boolean;
    }>;
    reporte(q: {
        desde?: string;
        hasta?: string;
        pagina?: string;
    }): Promise<{
        success: boolean;
        total: number;
        pagina: number;
        data: {
            duracionSegundos: number | null;
            esperaSegundos: number | null;
            desviacionSegundos: number | null;
            desviacionPorcentaje: number | null;
            muestras: {
                no_Muestra: string | null;
                producto_id: number;
                cliente_id: number | null;
            };
            id: number;
            ciclo: number;
            inicio: Date | null;
            fin: Date | null;
            nombre: string;
            muestra_id: number;
            proceso_id: number;
            orden: number;
            estandar_segundos: number | null;
            estandar_version: number;
            disponible_desde: Date | null;
            inicio_por: string | null;
            fin_por: string | null;
            resultado: string | null;
        }[];
    }>;
}
