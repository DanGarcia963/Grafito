import { TrazabilidadService } from './trazabilidad.service';
export declare class TrazabilidadController {
    private readonly tiempos;
    constructor(tiempos: TrazabilidadService);
    consultar(q: {
        entidad?: string;
        id?: string;
        loteId?: string;
        desde?: string;
        hasta?: string;
        pagina?: string;
    }): Promise<{
        success: boolean;
        total: number;
        pagina: number;
        tamanoPagina: number;
        data: {
            duracionSegundos: number | null;
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
        }[];
    }>;
    eventos(entidad: string, id: string): Promise<{
        success: boolean;
        data: {
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
    }>;
}
