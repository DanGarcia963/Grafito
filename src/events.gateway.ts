import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';
import type { VentaFlujo } from './types/flujo';

@WebSocketGateway({
  cors: { origin: '*',
    methods: ['GET', 'POST'],
    credentials: true, },
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('crear_venta')
  handleCrearVenta(@MessageBody() nuevaVenta: VentaFlujo) {
    console.log(`[Ventas] Nueva orden creada ID: ${nuevaVenta?.idVenta}`);
    this.server.emit('VENTA_CREADA', nuevaVenta);
    return { status: 'OK', data: nuevaVenta };
  }

  @SubscribeMessage('actualizar_flujo_venta')
  handleActualizarFlujoVenta(@MessageBody() ventaActualizada: VentaFlujo) {
    console.log(
      `[Flujo] Venta #${ventaActualizada?.idVenta || ventaActualizada?.id} actualizada`
    );
    this.server.emit('VENTA_ACTUALIZADA', ventaActualizada);
    return { status: 'OK', data: ventaActualizada };
  }

  // ==========================================
  // EVENTOS PARA PANTALLA DE TANQUES
  // ==========================================

  @SubscribeMessage('actualizar_estatus_tanque')
  handleActualizarEstatusTanque(@MessageBody() data: any) {
    console.log('[Tanques] Evento actualizar_estatus_tanque recibido:', data);

    // Retransmite el evento tal como viene a todas las pantallas
    this.server.emit('MUESTRA_ACTUALIZADA', data);
    this.server.emit('ESTATUS_TANQUE_CAMBIADO', data);
    this.server.emit('MUESTRA_CREADA', data);
    this.server.emit('TANQUE_ACTUALIZADO', data);

    return { status: 'OK', data };
  }

  @SubscribeMessage('notificar_cambio_tanque')
  handleNotificarCambioTanque(@MessageBody() data: any) {
    console.log('[Tanques] Cambio general detectado en tanques');
    this.server.emit('TANQUE_ACTUALIZADO', data);
    return { status: 'OK', data };
  }
}