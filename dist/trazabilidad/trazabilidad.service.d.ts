import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
type Tx = Prisma.TransactionClient;
export type ContextoTiempo = {
    entidad: 'MUESTRA' | 'TANQUE' | 'MUESTRA_ID';
    entidad_id: number;
    lote_id?: number | null;
    tanque_id?: number | null;
};
export declare class TrazabilidadService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    id(valor: unknown): number;
    evento(tx: Tx, ctx: ContextoTiempo, ciclo: number, accion: string, detalle?: unknown): Promise<{
        id: number;
        entidad: string;
        entidad_id: number;
        lote_id: number | null;
        tanque_id: number | null;
        ciclo: number;
        accion: string;
        fecha: Date;
        detalle: string | null;
    }>;
    ultimo(tx: Tx, ctx: ContextoTiempo): Promise<{
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
    } | null>;
    transicion(tx: Tx, ctx: ContextoTiempo, etapa: string | null, nuevoCiclo?: boolean): Promise<{
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
    } | null>;
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
    historial(entidad: string, id: string): Promise<{
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
export {};
