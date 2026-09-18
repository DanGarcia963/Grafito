import { Server } from 'socket.io';
import type { VentaFlujo } from './types/flujo';
export declare class EventsGateway {
    server: Server;
    handleCrearVenta(nuevaVenta: VentaFlujo): {
        status: string;
        data: VentaFlujo;
    };
    handleActualizarFlujoVenta(ventaActualizada: VentaFlujo): {
        status: string;
        data: VentaFlujo;
    };
    handleActualizarEstatusTanque(data: any): {
        status: string;
        data: any;
    };
    handleNotificarCambioTanque(data: any): {
        status: string;
        data: any;
    };
}
