import { OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from './auth/auth.service';
export declare class EventsGateway implements OnGatewayConnection {
    private auth;
    server: Server;
    constructor(auth: AuthService);
    handleConnection(client: Socket): void;
    notificar(evento: string, data: unknown): void;
}
