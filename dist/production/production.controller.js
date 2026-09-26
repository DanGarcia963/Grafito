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
exports.ProductionController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const common_2 = require("@nestjs/common");
const production_service_1 = require("./production.service");
let ProductionController = class ProductionController {
    productionService;
    constructor(productionService) {
        this.productionService = productionService;
    }
    async test() {
        return this.productionService.obtenerTodasLasOrdenesGrafito();
    }
    async getTanques(tipo) {
        return this.productionService.tanquesAreaProduccion(tipo);
    }
    async actualizar(body) {
        const result = await this.productionService.actualizarTanque(body);
        return {
            success: true,
            data: result
        };
    }
    async actualizarEstatusTanque(body) {
        const result = await this.productionService.actualizarEstatusTanque(body);
        return {
            success: true,
            data: result
        };
    }
    async actualizarEstatusCalidad(body) {
        const result = await this.productionService.actualizarEstatusCalidad(body);
        return {
            success: true,
            data: result
        };
    }
    async guardarBitacora(body) {
        const result = await this.productionService.agregarRegistroBitacora(body);
        return {
            success: true,
            data: result
        };
    }
};
exports.ProductionController = ProductionController;
__decorate([
    (0, common_2.Get)('test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "test", null);
__decorate([
    (0, common_2.Get)('tanques'),
    __param(0, (0, common_2.Query)('tipo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getTanques", null);
__decorate([
    (0, common_2.Put)('actualizar'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "actualizar", null);
__decorate([
    (0, common_2.Put)('actualizarEstatusTanque'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "actualizarEstatusTanque", null);
__decorate([
    (0, common_2.Put)('actualizarEstatusCalidad'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "actualizarEstatusCalidad", null);
__decorate([
    (0, common_2.Post)('guardarBitacora'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "guardarBitacora", null);
exports.ProductionController = ProductionController = __decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.Areas)('produccion', 'calidad'),
    (0, common_2.Controller)('api/produccion'),
    __metadata("design:paramtypes", [production_service_1.ProductionService])
], ProductionController);
//# sourceMappingURL=production.controller.js.map