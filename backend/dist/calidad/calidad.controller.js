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
        return this.calidadService.crearResultadosMuestraCalidad(body);
    }
    async crearVenta(body) {
        return this.calidadService.agregarEspecifProduct(body);
    }
    async actualizarEstadoMuestra(body) {
        return this.calidadService.actualizarEstadoMuestra(body);
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
};
exports.CalidadController = CalidadController;
__decorate([
    (0, common_1.Get)('obtenerParametros'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerParametros", null);
__decorate([
    (0, common_1.Get)('obtenerMuestras'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerMuestras", null);
__decorate([
    (0, common_1.Get)(':muestraID/especificaciones'),
    __param(0, (0, common_1.Param)('muestraID', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "buscarEspecificacionesMuestra", null);
__decorate([
    (0, common_1.Get)('obtenerMuestrasDictaminadas'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerMuestrasDictaminadas", null);
__decorate([
    (0, common_1.Post)('crearResultado'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "crearResultado", null);
__decorate([
    (0, common_1.Post)('agregarEspecifi'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "crearVenta", null);
__decorate([
    (0, common_1.Put)('actualizarEstadoMuestra'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "actualizarEstadoMuestra", null);
__decorate([
    (0, common_1.Get)('buscarAnalistas'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "buscarAnalistas", null);
__decorate([
    (0, common_1.Get)('obtenerOrdenesPendientesDeLlegada'),
    __param(0, (0, common_1.Query)('fechaFiltro')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "obtenerOrdenesPendientesDeLlegada", null);
__decorate([
    (0, common_1.Post)('crearLoteConChecklist'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalidadController.prototype, "crearLoteConChecklist", null);
exports.CalidadController = CalidadController = __decorate([
    (0, common_1.Controller)('api/calidad'),
    __metadata("design:paramtypes", [calidad_service_1.CalidadService])
], CalidadController);
//# sourceMappingURL=calidad.controller.js.map