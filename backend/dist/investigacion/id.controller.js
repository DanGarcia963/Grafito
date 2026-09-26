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
exports.InvestigacionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
require("multer");
const auth_guard_1 = require("../auth/auth.guard");
const id_service_1 = require("./id.service");
let InvestigacionController = class InvestigacionController {
    servicio;
    constructor(servicio) {
        this.servicio = servicio;
    }
    catalogos() { return this.servicio.catalogos(); }
    referencias(q) { return this.servicio.referencias(q); }
    procesoCatalogo(body, req) { return this.servicio.guardarCatalogo('proceso', body, req.usuario); }
    viabilidad(body, req) { return this.servicio.guardarCatalogo('viabilidad', body, req.usuario); }
    crear(body, ficha, req) { return this.servicio.crear(body, ficha, req.usuario); }
    listar(req, pagina) { return this.servicio.listar(req.usuario, pagina); }
    detalle(id, req) { return this.servicio.detalle(id, req.usuario); }
    async ficha(id, req, res) { const f = await this.servicio.ficha(id, req.usuario); res.setHeader('Content-Type', f.ficha_mime); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.ficha_nombre)}`); res.send(Buffer.from(f.ficha_contenido)); }
    plan(id, body, req) { return this.servicio.planificar(id, body, req.usuario); }
    recibir(id, req) { return this.servicio.recibir(id, req.usuario); }
    iniciar(id, e, req) { return this.servicio.proceso(id, e, 'iniciar', {}, req.usuario); }
    terminar(id, e, body, req) { return this.servicio.proceso(id, e, 'terminar', body, req.usuario); }
    finalizar(id, body, req) { return this.servicio.finalizar(id, body, req.usuario); }
    reporte(q) { return this.servicio.reporte(q); }
};
exports.InvestigacionController = InvestigacionController;
__decorate([
    (0, common_1.Get)('catalogos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "catalogos", null);
__decorate([
    (0, common_1.Get)('referencias'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "referencias", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Put)('catalogos/proceso'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "procesoCatalogo", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Put)('catalogos/viabilidad'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "viabilidad", null);
__decorate([
    (0, auth_guard_1.Areas)('ventas'),
    (0, common_1.Post)('muestras'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('ficha', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "crear", null);
__decorate([
    (0, common_1.Get)('muestras'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('pagina')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('muestras/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "detalle", null);
__decorate([
    (0, common_1.Get)('muestras/:id/ficha'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], InvestigacionController.prototype, "ficha", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Post)('muestras/:id/plan'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "plan", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Post)('muestras/:id/recibir'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "recibir", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Post)('muestras/:id/procesos/:ejecucion/iniciar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ejecucion', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "iniciar", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Post)('muestras/:id/procesos/:ejecucion/terminar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ejecucion', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "terminar", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Post)('muestras/:id/finalizar'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "finalizar", null);
__decorate([
    (0, auth_guard_1.Areas)('id'),
    (0, common_1.Get)('reporte'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InvestigacionController.prototype, "reporte", null);
exports.InvestigacionController = InvestigacionController = __decorate([
    (0, common_1.Controller)('api/investigacion'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.Areas)('id', 'ventas'),
    __metadata("design:paramtypes", [id_service_1.InvestigacionService])
], InvestigacionController);
//# sourceMappingURL=id.controller.js.map