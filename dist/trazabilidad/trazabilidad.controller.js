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
exports.TrazabilidadController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const common_2 = require("@nestjs/common");
const trazabilidad_service_1 = require("./trazabilidad.service");
let TrazabilidadController = class TrazabilidadController {
    tiempos;
    constructor(tiempos) {
        this.tiempos = tiempos;
    }
    consultar(q) { return this.tiempos.consultar(q); }
    eventos(entidad, id) { return this.tiempos.historial(entidad, id); }
};
exports.TrazabilidadController = TrazabilidadController;
__decorate([
    (0, common_2.Get)('tramos'),
    __param(0, (0, common_2.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TrazabilidadController.prototype, "consultar", null);
__decorate([
    (0, common_2.Get)('eventos'),
    __param(0, (0, common_2.Query)('entidad')),
    __param(1, (0, common_2.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TrazabilidadController.prototype, "eventos", null);
exports.TrazabilidadController = TrazabilidadController = __decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.Areas)('produccion', 'calidad'),
    (0, common_2.Controller)('api/trazabilidad'),
    __metadata("design:paramtypes", [trazabilidad_service_1.TrazabilidadService])
], TrazabilidadController);
//# sourceMappingURL=trazabilidad.controller.js.map