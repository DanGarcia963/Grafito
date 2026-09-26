"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const auth_module_1 = require("./auth/auth.module");
const id_module_1 = require("./investigacion/id.module");
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const trazabilidad_module_1 = require("./trazabilidad/trazabilidad.module");
const lotes_producer_1 = require("./lotes.producer");
const lotes_processor_1 = require("./lotes.processor");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
const ventas_module_1 = require("./ventas/ventas.module");
const calidad_module_1 = require("./calidad/calidad.module");
const production_module_1 = require("./production/production.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, trazabilidad_module_1.TrazabilidadModule, id_module_1.InvestigacionModule,
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: '127.0.0.1',
                    port: 6379,
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: 'cola-lotes',
            }), ventas_module_1.VentasModule, production_module_1.ProductionModule, calidad_module_1.CalidadModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, prisma_service_1.PrismaService, lotes_producer_1.LotesProducer, lotes_processor_1.LotesProcessor],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map