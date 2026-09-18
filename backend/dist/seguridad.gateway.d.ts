import { Server, Socket } from 'socket.io';
import type { TramiteLegal } from './types/tramites';
export declare class SeguridadGateway {
    server: Server;
    handleCrearTramite(data: TramiteLegal, client: Socket): void;
    handleActualizarTramite(data: TramiteLegal): void;
    handleEliminarTramite(id: string): void;
}
