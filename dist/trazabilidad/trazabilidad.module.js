"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrazabilidadModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const events_gateway_1 = require("../events.gateway");
const trazabilidad_service_1 = require("./trazabilidad.service");
const trazabilidad_controller_1 = require("./trazabilidad.controller");
let TrazabilidadModule = class TrazabilidadModule {
};
exports.TrazabilidadModule = TrazabilidadModule;
exports.TrazabilidadModule = TrazabilidadModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({ providers: [prisma_service_1.PrismaService, events_gateway_1.EventsGateway, trazabilidad_service_1.TrazabilidadService], exports: [events_gateway_1.EventsGateway, trazabilidad_service_1.TrazabilidadService], controllers: [trazabilidad_controller_1.TrazabilidadController] })
], TrazabilidadModule);
//# sourceMappingURL=trazabilidad.module.js.map