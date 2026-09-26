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
exports.ProductionService = void 0;
const trazabilidad_service_1 = require("../trazabilidad/trazabilidad.service");
const events_gateway_1 = require("../events.gateway");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const client_1 = require("@prisma/client");
let ProductionService = class ProductionService {
    prisma;
    tiempos;
    eventos;
    constructor(prisma, tiempos, eventos) {
        this.prisma = prisma;
        this.tiempos = tiempos;
        this.eventos = eventos;
    }
    async obtenerTodasLasOrdenesGrafito() {
        try {
            const grafitos = await this.prisma.ordenes_produccion.findMany({
                include: {
                    personas_ordenes_produccion_vendedor_idTopersonas: {
                        select: {
                            id_Persona: true,
                            nombre: true,
                            tipo_persona: true,
                        },
                    },
                    lotes_produccion: {
                        select: {
                            id_Lote_Produccion: true,
                            no_Lote: true,
                            cantidad_Total_Producida: true,
                            tanque_id: true,
                            bitacora: true,
                        },
                    },
                    personas_ordenes_produccion_cliente_idTopersonas: {
                        select: {
                            id_Persona: true,
                            nombre: true,
                            tipo_persona: true,
                        },
                    },
                    productos_materiales: {
                        select: {
                            id_Produc_Mater: true,
                            nombre_Producto: true,
                            UM: true,
                            presentacion: true,
                        },
                    },
                },
                where: {
                    linea_Produccion: 'GRAFITO',
                    lotes_produccion: {
                        some: {},
                    }
                },
                orderBy: { fecha_Confirmacion: 'desc' }
            });
            return { success: true, result: grafitos, bitacora: grafitos.flatMap(o => o.lotes_produccion.flatMap(l => {
                    try {
                        const lista = l.bitacora ? JSON.parse(l.bitacora) : [];
                        return Array.isArray(lista) ? lista : [];
                    }
                    catch {
                        return [];
                    }
                })) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async tanquesAreaProduccion(tipo) {
        try {
            const tanques = await this.prisma.$queryRaw `
      SELECT 
        id_Equipos_Tanques, 
        codigo_Equipo, 
        nombre_Equipo, 
        status, 
        estatus_proceso 
      FROM equipos_tanques 
      WHERE tipo = ${tipo}
    `;
            return { success: true, result: tanques };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async actualizarTanque({ idLoteProduccion, tanqueId }) {
        const id = this.tiempos.id(idLoteProduccion);
        const destino = tanqueId == null ? null : this.tiempos.id(tanqueId);
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Equipos_Tanques FROM equipos_tanques ORDER BY id_Equipos_Tanques FOR UPDATE`;
            const lote = await tx.lotes_produccion.findUnique({ where: { id_Lote_Produccion: id } });
            if (!lote)
                throw new common_1.NotFoundException('Lote no encontrado');
            if (lote.tanque_id === destino)
                return;
            if (destino) {
                const tanque = await tx.equipos_tanques.findUnique({ where: { id_Equipos_Tanques: destino } });
                if (!tanque || tanque.status !== 'OPERATIVO')
                    throw new common_1.BadRequestException('Tanque no disponible');
                if (await tx.lotes_produccion.findFirst({ where: { tanque_id: destino, id_Lote_Produccion: { not: id } } }))
                    throw new common_1.BadRequestException('El tanque ya tiene otro lote');
            }
            if (lote.tanque_id) {
                await this.tiempos.transicion(tx, { entidad: 'TANQUE', entidad_id: lote.tanque_id, lote_id: id, tanque_id: lote.tanque_id }, null);
                await tx.equipos_tanques.update({ where: { id_Equipos_Tanques: lote.tanque_id }, data: { estatus_proceso: 'VACIO' } });
            }
            await tx.lotes_produccion.update({ where: { id_Lote_Produccion: id }, data: { tanque_id: destino } });
            if (destino) {
                await tx.equipos_tanques.update({ where: { id_Equipos_Tanques: destino }, data: { estatus_proceso: 'CARGANDO_TANQUE' } });
                await this.tiempos.transicion(tx, { entidad: 'TANQUE', entidad_id: destino, lote_id: id, tanque_id: destino }, 'CARGANDO_TANQUE', true);
            }
            const ctx = { entidad: 'TANQUE', entidad_id: destino ?? lote.tanque_id, lote_id: id, tanque_id: destino ?? lote.tanque_id };
            const ultimo = await this.tiempos.ultimo(tx, ctx);
            await this.tiempos.evento(tx, ctx, ultimo?.ciclo ?? 1, 'ASIGNACION_LOTE', { origen: lote.tanque_id, destino });
        });
        this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion: id });
        return { idLoteProduccion: id, tanqueId: destino };
    }
    async actualizarEstatusCalidad({ idLoteProduccion }) {
        const id = this.tiempos.id(idLoteProduccion);
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Lote_Produccion FROM lotes_produccion WHERE id_Lote_Produccion = ${id} FOR UPDATE`;
            const lote = await tx.lotes_produccion.findUnique({ where: { id_Lote_Produccion: id } });
            if (!lote)
                throw new common_1.NotFoundException('Lote no encontrado');
            if (lote.estado_Calida !== 'LIBERADO' && lote.tanque_id) {
                const ctx = { entidad: 'TANQUE', entidad_id: lote.tanque_id, tanque_id: lote.tanque_id, lote_id: id };
                const ultimo = await this.tiempos.ultimo(tx, ctx);
                await this.tiempos.evento(tx, ctx, ultimo?.ciclo ?? 1, 'LIBERACION_LOTE', { anterior: lote.estado_Calida });
            }
            return tx.lotes_produccion.update({ where: { id_Lote_Produccion: id }, data: { estado_Calida: 'LIBERADO' } });
        });
        this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion });
        return result;
    }
    async agregarRegistroBitacora({ idLoteProduccion, registro }) {
        const id = this.tiempos.id(idLoteProduccion);
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Lote_Produccion FROM lotes_produccion WHERE id_Lote_Produccion = ${id} FOR UPDATE`;
            const lote = await tx.lotes_produccion.findUnique({ where: { id_Lote_Produccion: id } });
            if (!lote)
                throw new common_1.NotFoundException('Lote no encontrado');
            const anterior = lote.bitacora ? JSON.parse(lote.bitacora) : [];
            if (!Array.isArray(anterior))
                throw new common_1.BadRequestException('Formato de bitácora inválido');
            const bitacora = [...anterior, { ...registro, fechaHora: new Date().toISOString() }];
            await tx.lotes_produccion.update({ where: { id_Lote_Produccion: id }, data: { bitacora: JSON.stringify(bitacora) } });
            return { id_Lote_Produccion: id, bitacora };
        });
        this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion: id });
        return result;
    }
    async actualizarEstatusTanque({ tanqueId, estatus_proceso }) {
        const id = this.tiempos.id(tanqueId);
        const estado = String(estatus_proceso ?? '').trim().toUpperCase().replace(/\s+/g, '_');
        if (!Object.values(client_1.equipos_tanques_estatus_proceso).includes(estado))
            throw new common_1.BadRequestException('Etapa de tanque inválida');
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Equipos_Tanques FROM equipos_tanques WHERE id_Equipos_Tanques = ${id} FOR UPDATE`;
            const tanque = await tx.equipos_tanques.findUnique({ where: { id_Equipos_Tanques: id } });
            if (!tanque)
                throw new common_1.NotFoundException('Tanque no encontrado');
            const lote = await tx.lotes_produccion.findFirst({ where: { tanque_id: id }, include: { ordenes_produccion: true } });
            if (estado !== 'VACIO' && !lote)
                throw new common_1.BadRequestException('Asigna un lote al tanque primero');
            if (estado === 'VACIO' && lote)
                throw new common_1.BadRequestException('Usa Vaciar para retirar el lote del tanque');
            if (tanque.estatus_proceso === estado)
                return { muestraId: null, cambio: false };
            const ctx = { entidad: 'TANQUE', entidad_id: id, tanque_id: id, lote_id: lote?.id_Lote_Produccion };
            const tramo = await this.tiempos.transicion(tx, ctx, estado === 'VACIO' ? null : estado);
            await this.tiempos.evento(tx, ctx, tramo?.ciclo ?? 1, 'CAMBIO_PROCESO', { anterior: tanque.estatus_proceso, nuevo: estado });
            let muestraId = null;
            if (estado === 'MUESTREO' && lote) {
                const pendiente = await tx.muestras.findFirst({ where: { tanque_id: id, lote_id: lote.id_Lote_Produccion, estado_Muestra: { notIn: ['APROBADO', 'RECHAZADO'] } } });
                if (!pendiente) {
                    const muestra = await tx.muestras.create({ data: {
                            no_Muestra: lote.no_Lote, fecha_Toma: new Date(), Hora_Toma: new Date(), tanque_id: id,
                            lote_id: lote.id_Lote_Produccion, producto_id: lote.producto_id,
                            cliente_id: lote.ordenes_produccion.cliente_id,
                        } });
                    muestraId = muestra.id_Muestra;
                    const mctx = { entidad: 'MUESTRA', entidad_id: muestraId, tanque_id: id, lote_id: lote.id_Lote_Produccion };
                    await this.tiempos.transicion(tx, mctx, 'TRASLADO');
                    await this.tiempos.evento(tx, mctx, 1, 'TOMA_MUESTRA');
                }
            }
            if (estado === 'ESPERA_CALIDAD' && lote)
                await tx.ordenes_produccion.update({ where: { id_Orden_Produc: lote.orden_Produccion_id }, data: { estatus_flujo: 'calidad' } });
            await tx.equipos_tanques.update({ where: { id_Equipos_Tanques: id }, data: { estatus_proceso: estado } });
            return { muestraId, cambio: true };
        });
        if (result.cambio)
            this.eventos.notificar('ESTATUS_TANQUE_CAMBIADO', { tanqueId: id, estatus: estado, estatus_proceso: estado });
        if (result.muestraId)
            this.eventos.notificar('MUESTRA_CREADA', { id_Muestra: result.muestraId });
        return result;
    }
};
exports.ProductionService = ProductionService;
exports.ProductionService = ProductionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, trazabilidad_service_1.TrazabilidadService, events_gateway_1.EventsGateway])
], ProductionService);
//# sourceMappingURL=production.service.js.map