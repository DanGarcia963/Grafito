import { AuthService } from './auth/auth.service';
import { Server, Socket } from 'socket.io';
import type { TramiteLegal } from './types/tramites';
export declare class SeguridadGateway {
    private readonly auth;
    constructor(auth: AuthService);
    handleConnection(client: Socket): void;
    server: Server;
    handleCrearTramite(data: TramiteLegal, client: Socket): void;
    handleActualizarTramite(data: TramiteLegal, client: Socket): void;
    handleEliminarTramite(id: string, client: Socket): void;
}
