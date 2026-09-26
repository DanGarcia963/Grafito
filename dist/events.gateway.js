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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const auth_service_1 = require("./auth/auth.service");
let EventsGateway = class EventsGateway {
    auth;
    server;
    constructor(auth) {
        this.auth = auth;
    }
    handleConnection(client) {
        try {
            const token = client.handshake.auth?.token, usuario = this.auth.verificar(token);
            client.join(usuario.area);
            const check = setInterval(() => { try {
                this.auth.verificar(token);
            }
            catch {
                client.disconnect(true);
            } }, 15000);
            client.once('disconnect', () => clearInterval(check));
        }
        catch {
            client.disconnect(true);
        }
    }
    notificar(evento, data) {
        const areas = evento.startsWith('ID_') ? ['id', 'ventas'] : ['calidad', 'produccion'];
        this.server?.to(areas).emit(evento, data);
        this.server?.to(areas).emit(evento.startsWith('ID_') ? 'ID_TRAZABILIDAD_ACTUALIZADA' : 'TRAZABILIDAD_ACTUALIZADA', data);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: true, methods: ['GET', 'POST'] } }),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map