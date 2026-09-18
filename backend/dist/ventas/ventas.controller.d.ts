import { VentasService } from './ventas.service';
export declare class VentasController {
    private readonly ventasService;
    constructor(ventasService: VentasService);
    crearVenta(body: any): Promise<{
        success: boolean;
        orden: any;
        producto: any;
        vendedorId: number;
        clienteId: number;
    } | {
        success: boolean;
        error: any;
    }>;
    test(): Promise<{
        success: boolean;
        result: any[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
}
