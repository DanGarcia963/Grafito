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
exports.SeguridadGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let SeguridadGateway = class SeguridadGateway {
    server;
    handleCrearTramite(data, client) {
        this.server.emit('TRAMITE_CREADO', data);
    }
    handleActualizarTramite(data) {
        this.server.emit('TRAMITE_ACTUALIZADO', data);
    }
    handleEliminarTramite(id) {
        this.server.emit('TRAMITE_ELIMINADO', id);
    }
};
exports.SeguridadGateway = SeguridadGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SeguridadGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('crear_tramite'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], SeguridadGateway.prototype, "handleCrearTramite", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('actualizar_tramite'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeguridadGateway.prototype, "handleActualizarTramite", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('eliminar_tramite'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SeguridadGateway.prototype, "handleEliminarTramite", null);
exports.SeguridadGateway = SeguridadGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } })
], SeguridadGateway);
//# sourceMappingURL=seguridad.gateway.js.map