import { PrismaService } from '../prisma.service';
export declare class VentasService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    crearOrdenVenta(data: any): Promise<{
        success: boolean;
        orden: any;
        producto: any;
        vendedorId: number;
        clienteId: number;
    } | {
        success: boolean;
        error: any;
    }>;
    obtenerTodasLasOrdenes(): Promise<{
        success: boolean;
        result: any[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
}
