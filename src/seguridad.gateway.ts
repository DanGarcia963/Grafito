import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { TramiteLegal } from './types/tramites';

@WebSocketGateway({ cors: { origin: '*' } })
export class SeguridadGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('crear_tramite')
  handleCrearTramite(
    @MessageBody() data: TramiteLegal,
    @ConnectedSocket() client: Socket
  ) {
    
    // 2. Emitir a TODOS los usuarios conectados (incluyendo el creador)
    this.server.emit('TRAMITE_CREADO', data);
  }

  @SubscribeMessage('actualizar_tramite')
  handleActualizarTramite(@MessageBody() data: TramiteLegal) {
    this.server.emit('TRAMITE_ACTUALIZADO', data);
  }

  @SubscribeMessage('eliminar_tramite')
  handleEliminarTramite(@MessageBody() id: string) {
    this.server.emit('TRAMITE_ELIMINADO', id);
  }
}