"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalidadModule = void 0;
const common_1 = require("@nestjs/common");
const calidad_controller_1 = require("./calidad.controller");
const calidad_service_1 = require("./calidad.service");
const prisma_service_1 = require("../prisma.service");
let CalidadModule = class CalidadModule {
};
exports.CalidadModule = CalidadModule;
exports.CalidadModule = CalidadModule = __decorate([
    (0, common_1.Module)({
        controllers: [calidad_controller_1.CalidadController],
        providers: [calidad_service_1.CalidadService, prisma_service_1.PrismaService],
    })
], CalidadModule);
//# sourceMappingURL=calidad.module.js.map