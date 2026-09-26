import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { Usuario } from '../auth/auth.service';
import { fichaValida } from './id.logic';
export declare class InvestigacionService {
    private prisma;
    private eventos;
    private tiempos;
    constructor(prisma: PrismaService, eventos: EventsGateway, tiempos: TrazabilidadService);
    private filtro;
    private muestra;
    private ctx;
    private avisar;
    catalogos(): Promise<{
        success: boolean;
        viabilidades: {
            id: number;
            nombre: string;
            activo: boolean;
        }[];
        procesos: {
            id: number;
            nombre: string;
            activo: boolean;
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
            nombre: string;
            id_Persona: number;
        }[];
    }>;
    guardarCatalogo(tipo: 'proceso' | 'viabilidad', body: any, u: Usuario): Promise<{
        success: boolean;
        data: any;
    }>;
    crear(body: any, file: Parameters<typeof fichaValida>[0], u: Usuario): Promise<{
        success: boolean;
        data: {
            id_Muestra: number;
        };
    }>;
    listar(u: Usuario, paginaEntrada?: string): Promise<{
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
                nombre: string;
                estandar_segundos: number | null;
                ciclo: number;
                orden: number;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio: Date | null;
                fin: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            id_ejecuciones: {
                id: number;
                nombre: string;
                estandar_segundos: number | null;
                ciclo: number;
                orden: number;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio: Date | null;
                fin: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            productos_materiales: {
                nombre_Producto: string;
            };
            no_Muestra: string;
            etapa_Muestra: import("@prisma/client").$Enums.muestras_etapa_Muestra | null;
            estado_Muestra: import("@prisma/client").$Enums.muestras_estado_Muestra;
            categoria_Muestra: import("@prisma/client").$Enums.muestras_categoria_Muestra;
            observaciones: string | null;
            area_Muestra: string;
            caracterizacion: string | null;
            cantidad_proyecto: Prisma.Decimal | null;
            unidad_proyecto: string | null;
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
            id_Muestra: number;
            producto_id: number;
            cliente_id: number | null;
            vendedor_id: number | null;
            viabilidad_id: number | null;
        }[];
    }>;
    detalle(id: number, u: Usuario): Promise<{
        success: boolean;
        data: {
            procesos_id: {
                duracionSegundos: number | null;
                esperaSegundos: number | null;
                desviacionSegundos: number | null;
                desviacionPorcentaje: number | null;
                id: number;
                nombre: string;
                estandar_segundos: number | null;
                ciclo: number;
                orden: number;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio: Date | null;
                fin: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            eventos: {
                id: number;
                lote_id: number | null;
                tanque_id: number | null;
                ciclo: number;
                entidad: string;
                entidad_id: number;
                accion: string;
                fecha: Date;
                detalle: string | null;
            }[];
            id_ejecuciones: {
                id: number;
                nombre: string;
                estandar_segundos: number | null;
                ciclo: number;
                orden: number;
                estandar_version: number;
                disponible_desde: Date | null;
                inicio: Date | null;
                fin: Date | null;
                inicio_por: string | null;
                fin_por: string | null;
                resultado: string | null;
            }[];
            productos_materiales: {
                nombre_Producto: string;
            };
            no_Muestra: string;
            etapa_Muestra: import("@prisma/client").$Enums.muestras_etapa_Muestra | null;
            estado_Muestra: import("@prisma/client").$Enums.muestras_estado_Muestra;
            categoria_Muestra: import("@prisma/client").$Enums.muestras_categoria_Muestra;
            observaciones: string | null;
            area_Muestra: string;
            caracterizacion: string | null;
            cantidad_proyecto: Prisma.Decimal | null;
            unidad_proyecto: string | null;
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
            id_Muestra: number;
            producto_id: number;
            cliente_id: number | null;
            vendedor_id: number | null;
            viabilidad_id: number | null;
        };
    }>;
    ficha(id: number, u: Usuario): Promise<{
        ficha_nombre: string | null;
        ficha_mime: string | null;
        ficha_contenido: Uint8Array<ArrayBuffer> | null;
    }>;
    planificar(id: number, body: any, u: Usuario): Promise<{
        success: boolean;
    }>;
    recibir(id: number, u: Usuario): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    proceso(id: number, ejecucion: number, accion: 'iniciar' | 'terminar', body: any, u: Usuario): Promise<{
        success: boolean;
        repetida: boolean;
    } | {
        success: boolean;
        repetida?: undefined;
    }>;
    finalizar(id: number, body: any, u: Usuario): Promise<{
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
                no_Muestra: string;
                producto_id: number;
                cliente_id: number | null;
            };
            id: number;
            nombre: string;
            estandar_segundos: number | null;
            muestra_id: number;
            proceso_id: number;
            ciclo: number;
            orden: number;
            estandar_version: number;
            disponible_desde: Date | null;
            inicio: Date | null;
            fin: Date | null;
            inicio_por: string | null;
            fin_por: string | null;
            resultado: string | null;
        }[];
    }>;
}
