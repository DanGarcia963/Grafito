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
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let ProductionService = class ProductionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
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
            return { success: true, result: grafitos };
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
        const targetTanqueId = tanqueId !== null && tanqueId !== undefined ? Number(tanqueId) : null;
        await this.prisma.lotes_produccion.updateMany({
            where: {
                id_Lote_Produccion: Number(idLoteProduccion),
            },
            data: {
                tanque_id: targetTanqueId,
            },
        });
    }
    async actualizarEstatusCalidad({ idLoteProduccion, estadoCalidad, }) {
        return await this.prisma.lotes_produccion.updateMany({
            where: { id_Lote_Produccion: Number(idLoteProduccion) },
            data: {
                estado_Calida: 'LIBERADO',
            },
        });
    }
    async agregarRegistroBitacora({ idLoteProduccion, registro, }) {
        const lote = await this.prisma.lotes_produccion.findUnique({
            where: {
                id_Lote_Produccion: Number(idLoteProduccion),
            },
            select: {
                id_Lote_Produccion: true,
                bitacora: true,
            },
        });
        if (!lote) {
            throw new Error(`No se encontró el lote de producción ${idLoteProduccion}`);
        }
        let bitacoraActual = [];
        if (Array.isArray(lote.bitacora)) {
            bitacoraActual = lote.bitacora;
        }
        else if (typeof lote.bitacora === 'string') {
            try {
                const parsed = JSON.parse(lote.bitacora);
                bitacoraActual = Array.isArray(parsed) ? parsed : [];
            }
            catch {
                bitacoraActual = [];
            }
        }
        const nuevaBitacora = [
            ...bitacoraActual,
            registro,
        ];
        await this.prisma.lotes_produccion.update({
            where: {
                id_Lote_Produccion: Number(idLoteProduccion),
            },
            data: {
                bitacora: JSON.stringify(nuevaBitacora),
            },
        });
        return {
            id_Lote_Produccion: lote.id_Lote_Produccion,
            bitacora: nuevaBitacora,
        };
    }
    async actualizarEstatusTanque({ tanqueId, estatus_proceso, idVentaOrigen, }) {
        const statusFormatted = estatus_proceso
            ? estatus_proceso.trim().replace(/ /g, '_')
            : 'VACIO';
        let ordenVenta = null;
        let lote = null;
        if (idVentaOrigen) {
            ordenVenta = await this.prisma.ordenes_produccion.findFirst({
                where: { id_Venta_Origen: Number(idVentaOrigen) },
                select: { id_Orden_Produc: true, producto_id: true, cliente_id: true },
            });
            if (ordenVenta?.id_Orden_Produc) {
                lote = await this.prisma.lotes_produccion.findFirst({
                    where: { orden_Produccion_id: ordenVenta.id_Orden_Produc },
                    select: { id_Lote_Produccion: true, no_Lote: true },
                });
            }
        }
        if (statusFormatted === 'MUESTREO' && idVentaOrigen) {
            if (!lote || !lote.no_Lote) {
                console.warn(`[MUESTREO] No se encontró un lote válido asociado a la venta ID: ${idVentaOrigen}`);
            }
            else {
                const noMuestra = lote.no_Lote.slice(0, 5);
                console.log('Número de Muestra generado:', noMuestra);
                await this.prisma.muestras.create({
                    data: {
                        no_Muestra: noMuestra,
                        fecha_Toma: new Date().toLocaleString('es-MX'),
                        tanque_id: Number(tanqueId),
                        lote_id: Number(lote.id_Lote_Produccion),
                        producto_id: Number(ordenVenta?.producto_id),
                        cliente_id: Number(ordenVenta?.cliente_id),
                    },
                });
            }
        }
        if (statusFormatted === 'ESPERA_CALIDAD' && idVentaOrigen) {
            await this.prisma.ordenes_produccion.updateMany({
                where: {
                    id_Venta_Origen: Number(idVentaOrigen),
                },
                data: {
                    estatus_flujo: 'calidad',
                },
            });
            if (lote?.id_Lote_Produccion) {
                await this.prisma.muestras.updateMany({
                    where: {
                        lote_id: Number(lote.id_Lote_Produccion),
                        tanque_id: Number(tanqueId),
                        estado_Muestra: {
                            notIn: ['APROBADO', 'RECHAZADO'],
                        },
                    },
                    data: {
                        estado_Muestra: 'EN_ANALISIS',
                    },
                });
            }
        }
        await this.prisma.equipos_tanques.updateMany({
            where: {
                id_Equipos_Tanques: Number(tanqueId),
            },
            data: {
                estatus_proceso: statusFormatted,
            },
        });
    }
};
exports.ProductionService = ProductionService;
exports.ProductionService = ProductionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductionService);
//# sourceMappingURL=production.service.js.map