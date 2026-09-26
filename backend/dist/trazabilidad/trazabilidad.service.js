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
exports.TrazabilidadService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let TrazabilidadService = class TrazabilidadService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    id(valor) {
        if (!['number', 'string'].includes(typeof valor) || !/^\d+$/.test(String(valor)))
            throw new common_1.BadRequestException('ID inválido');
        const id = Number(valor);
        if (!Number.isSafeInteger(id) || id <= 0)
            throw new common_1.BadRequestException('ID inválido');
        return id;
    }
    async evento(tx, ctx, ciclo, accion, detalle) {
        return tx.proceso_eventos.create({ data: { ...ctx, ciclo, accion, fecha: new Date(), detalle: detalle == null ? null : JSON.stringify(detalle) } });
    }
    async ultimo(tx, ctx) {
        return tx.proceso_tramos.findFirst({ where: { entidad: ctx.entidad, entidad_id: ctx.entidad_id }, orderBy: { id: 'desc' } });
    }
    async transicion(tx, ctx, etapa, nuevoCiclo = false) {
        const ultimo = await this.ultimo(tx, ctx);
        const abierto = ultimo?.fin == null ? ultimo : null;
        if (abierto && abierto.etapa === etapa && abierto.lote_id === (ctx.lote_id ?? null) && !nuevoCiclo)
            return abierto;
        const ahora = new Date();
        if (abierto)
            await tx.proceso_tramos.update({ where: { id: abierto.id }, data: { fin: ahora, activo: null } });
        const ciclo = ultimo ? ultimo.ciclo + (nuevoCiclo ? 1 : 0) : 1;
        if (!etapa)
            return ultimo;
        return tx.proceso_tramos.create({ data: { ...ctx, ciclo, etapa, inicio: ahora, activo: `${ctx.entidad}:${ctx.entidad_id}` } });
    }
    async consultar(q) {
        const where = { entidad: { in: ['MUESTRA', 'TANQUE'] } };
        if (q.entidad) {
            if (!['MUESTRA', 'TANQUE'].includes(q.entidad))
                throw new common_1.BadRequestException('Entidad inválida');
            where.entidad = q.entidad;
        }
        if (q.id)
            where.entidad_id = this.id(q.id);
        if (q.loteId)
            where.lote_id = this.id(q.loteId);
        const desde = q.desde ? new Date(q.desde) : undefined, hasta = q.hasta ? new Date(q.hasta) : undefined;
        if ((desde && isNaN(+desde)) || (hasta && isNaN(+hasta)) || (desde && hasta && desde > hasta))
            throw new common_1.BadRequestException('Rango de fechas inválido');
        if (desde || hasta)
            where.inicio = { gte: desde, lt: hasta };
        const pagina = q.pagina ? this.id(q.pagina) : 1;
        const [total, tramos] = await this.prisma.$transaction([
            this.prisma.proceso_tramos.count({ where }),
            this.prisma.proceso_tramos.findMany({ where, orderBy: { id: 'desc' }, skip: (pagina - 1) * 200, take: 200 }),
        ]);
        return { success: true, total, pagina, tamanoPagina: 200, data: tramos.map(t => ({ ...t, duracionSegundos: t.fin ? (t.fin.getTime() - t.inicio.getTime()) / 1000 : null })) };
    }
    async historial(entidad, id) {
        if (!['MUESTRA', 'TANQUE'].includes(entidad))
            throw new common_1.BadRequestException('Entidad inválida');
        return { success: true, data: await this.prisma.proceso_eventos.findMany({ where: { entidad, entidad_id: this.id(id) }, orderBy: { id: 'desc' }, take: 500 }) };
    }
};
exports.TrazabilidadService = TrazabilidadService;
exports.TrazabilidadService = TrazabilidadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TrazabilidadService);
//# sourceMappingURL=trazabilidad.service.js.map