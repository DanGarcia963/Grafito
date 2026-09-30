import { corsOptions } from './config/runtime';
import { AuthService } from './auth/auth.service';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { TramiteLegal } from './types/tramites';

@WebSocketGateway({ cors: corsOptions })
export class SeguridadGateway {
  constructor(private readonly auth: AuthService) {}
  handleConnection(client: Socket) {
    try { this.auth.verificar(client.handshake.auth?.token); } catch { client.disconnect(true); }
  }
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('crear_tramite')
  handleCrearTramite(
    @MessageBody() data: TramiteLegal,
    @ConnectedSocket() client: Socket
  ) {
    
    this.auth.verificar(client.handshake.auth?.token);
    // 2. Emitir a TODOS los usuarios conectados (incluyendo el creador)
    this.server.emit('TRAMITE_CREADO', data);
  }

  @SubscribeMessage('actualizar_tramite')
  handleActualizarTramite(@MessageBody() data: TramiteLegal, @ConnectedSocket() client: Socket) {
    this.auth.verificar(client.handshake.auth?.token);
    this.server.emit('TRAMITE_ACTUALIZADO', data);
  }

  @SubscribeMessage('eliminar_tramite')
  handleEliminarTramite(@MessageBody() id: string, @ConnectedSocket() client: Socket) {
    this.auth.verificar(client.handshake.auth?.token);
    this.server.emit('TRAMITE_ELIMINADO', id);
  }
}