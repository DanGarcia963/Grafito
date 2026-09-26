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
exports.CalidadController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const common_2 = require("@nestjs/common");
const calidad_service_1 = require("./calidad.service");
let CalidadController = class CalidadController {
    calidadService;
    constructor(calidadService) {
        this.calidadService = calidadService;
    }
    async obtenerParametros() {
        const result = await this.calidadService.obtenerParametrosCalidad();
        return { success: true, data: result };
    }
    async obtenerMuestras() {
        const result = await this.calidadService.obtenerTodasLasMuestras();
        return { success: true, data: result };
    }
    async buscarEspecificacionesMuestra(muestraID) {
        return await this.calidadService.buscarEspecificacionesMuestra(muestraID);
    }
    async obtenerMuestrasDictaminadas() {
        const result = await this.calidadService.obtenerTodasMuestrasConDictamen();
        return { success: true, data: result };
    }
    async crearResultado(body) {
        throw new common_2.BadRequestException('Usa POST finalizarAnalisis para guardar resultados y dictamen en una transacción.');
    }
    async crearVenta(body) {
        return this.calidadService.agregarEspecifProduct(body);
    }
    async actualizarEstadoMuestra(body) {
        throw new common_2.BadRequestException('Usa POST finalizarAnalisis para guardar resultados y dictamen en una transacción.');
    }
    async actualizarEstatusMuestra(body) {
        return this.calidadService.actualizarEstatusMuestra(body);
    }
    async buscarAnalistas(query) {
        if (!query || query.trim() === '') {
            return { success: true, analistas: [] };
        }
        return await this.calidadService.buscarAnalistas(query.trim());
    }
    async obtenerOrdenesPendientesDeLlegada(fechaFiltro) {
        return await this.calidadService.obtenerOrdenesPendientesDeLlegada(fechaFiltro);
    }
    async crearLoteConChecklist(body) {
        return await this.calidadService.crearLoteConChecklist(body);
    }
    finalizar(body) { return this.calidadService.finalizarAnalisis(body); }
    recibir(id) { return this.calidadService.cambiarEtapaMuestra(id, 'RECIBIR'); }
    iniciar(id) { return this.calidadService.cambiarEtapaMuestra(id, 'INICIAR'); }
    reabrir(id) { return this.calidadService.cambiarEtapaMuestra(id, 'REABRIR'); }
};
exports.CalidadController = CalidadController;
__decorate([
    (0, common_2.Get)('obtenerParametros'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerParametros", null);
__decorate([
    (0, common_2.Get)('obtenerMuestras'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerMuestras", null);
__decorate([
    (0, common_2.Get)(':muestraID/especificaciones'),
    __param(0, (0, common_2.Param)('muestraID', common_2.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "buscarEspecificacionesMuestra", null);
__decorate([
    (0, common_2.Get)('obtenerMuestrasDictaminadas'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerMuestrasDictaminadas", null);
__decorate([
    (0, common_2.Post)('crearResultado'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "crearResultado", null);
__decorate([
    (0, auth_guard_1.Areas)('calidad'),
    (0, common_2.Post)('agregarEspecifi'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "crearVenta", null);
__decorate([
    (0, common_2.Put)('actualizarEstadoMuestra'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "actualizarEstadoMuestra", null);
__decorate([
    (0, common_2.Put)('actualizarEstatusMuestra'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "actualizarEstatusMuestra", null);
__decorate([
    (0, common_2.Get)('buscarAnalistas'),
    __param(0, (0, common_2.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "buscarAnalistas", null);
__decorate([
    (0, common_2.Get)('obtenerOrdenesPendientesDeLlegada'),
    __param(0, (0, common_2.Query)('fechaFiltro')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerOrdenesPendientesDeLlegada", null);
__decorate([
    (0, auth_guard_1.Areas)('calidad'),
    (0, common_2.Post)('crearLoteConChecklist'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "crearLoteConChecklist", null);
__decorate([
    (0, auth_guard_1.Areas)('calidad'),
    (0, common_2.Post)('finalizarAnalisis'),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CalidadController.prototype, "finalizar", null);
__decorate([
    (0, auth_guard_1.Areas)('calidad'),
    (0, common_2.Post)(':id/recibir'),
    __param(0, (0, common_2.Param)('id', common_2.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CalidadController.prototype, "recibir", null);
__decorate([
    (0, auth_guard_1.Areas)('calidad'),
    (0, common_2.Post)(':id/iniciar'),
    __param(0, (0, common_2.Param)('id', common_2.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CalidadController.prototype, "iniciar", null);
__decorate([
    (0, auth_guard_1.Areas)('calidad'),
    (0, common_2.Post)(':id/reabrir'),
    __param(0, (0, common_2.Param)('id', common_2.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CalidadController.prototype, "reabrir", null);
exports.CalidadController = CalidadController = __decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.Areas)('produccion', 'calidad'),
    (0, common_2.Controller)('api/calidad'),
    __metadata("design:paramtypes", [calidad_service_1.CalidadService])
], CalidadController);
//# sourceMappingURL=calidad.controller.js.map