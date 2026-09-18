"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let EventsGateway = class EventsGateway {
    server;
    handleCrearVenta(nuevaVenta) {
        console.log(`[Ventas] Nueva orden creada ID: ${nuevaVenta?.idVenta}`);
        this.server.emit('VENTA_CREADA', nuevaVenta);
        return { status: 'OK', data: nuevaVenta };
    }
    handleActualizarFlujoVenta(ventaActualizada) {
        console.log(`[Flujo] Venta #${ventaActualizada?.idVenta || ventaActualizada?.id} actualizada`);
        this.server.emit('VENTA_ACTUALIZADA', ventaActualizada);
        return { status: 'OK', data: ventaActualizada };
    }
    handleActualizarEstatusTanque(data) {
        console.log('[Tanques] Evento actualizar_estatus_tanque recibido:', data);
        this.server.emit('MUESTRA_ACTUALIZADA', data);
        this.server.emit('ESTATUS_TANQUE_CAMBIADO', data);
        this.server.emit('MUESTRA_CREADA', data);
        this.server.emit('TANQUE_ACTUALIZADO', data);
        return { status: 'OK', data };
    }
    handleNotificarCambioTanque(data) {
        console.log('[Tanques] Cambio general detectado en tanques');
        this.server.emit('TANQUE_ACTUALIZADO', data);
        return { status: 'OK', data };
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('crear_venta'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleCrearVenta", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('actualizar_flujo_venta'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleActualizarFlujoVenta", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('actualizar_estatus_tanque'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleActualizarEstatusTanque", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('notificar_cambio_tanque'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleNotificarCambioTanque", null);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*',
            methods: ['GET', 'POST'],
            credentials: true, },
    })
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map