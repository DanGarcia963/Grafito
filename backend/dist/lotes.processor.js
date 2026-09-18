"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LotesProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LotesProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
let LotesProcessor = LotesProcessor_1 = class LotesProcessor extends bullmq_1.WorkerHost {
    logger = new common_1.Logger(LotesProcessor_1.name);
    async process(job) {
        this.logger.log(`Procesando lote ID: ${job.id} - No. Lote: ${job.data.noLote}`);
        const loteProcesado = {
            ...job.data,
            estado: job.data.estado || 'PENDIENTE_CALIDAD',
            procesadoEn: new Date().toISOString(),
        };
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.logger.log(`Lote ${loteProcesado.noLote} procesado exitosamente.`);
        return loteProcesado;
    }
};
exports.LotesProcessor = LotesProcessor;
exports.LotesProcessor = LotesProcessor = LotesProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('lotes-queue')
], LotesProcessor);
//# sourceMappingURL=lotes.processor.js.map