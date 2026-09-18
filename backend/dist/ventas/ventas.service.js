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
exports.VentasService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let VentasService = class VentasService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async crearOrdenVenta(data) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                let vendedorId = Number(data.vendedor_id);
                if (!vendedorId && data.nombreVendedor) {
                    let vendedor = await tx.personas.findFirst({
                        where: {
                            nombre: {
                                equals: data.nombreVendedor,
                            },
                        },
                    });
                    if (!vendedor) {
                        vendedor = await tx.personas.create({
                            data: {
                                nombre: data.nombreVendedor,
                                tipo_persona: 'Vendedor',
                            },
                        });
                    }
                    vendedorId = Number(vendedor.id_Persona || vendedor.id);
                }
                let clienteId = Number(data.cliente_id);
                if (!clienteId && data.cliente) {
                    let cliente = await tx.personas.findFirst({
                        where: {
                            nombre: {
                                equals: data.cliente,
                            },
                        },
                    });
                    if (!cliente) {
                        cliente = await tx.personas.create({
                            data: {
                                nombre: data.cliente,
                                tipo_persona: 'Cliente',
                            },
                        });
                    }
                    clienteId = Number(cliente.id_Persona || cliente.id);
                }
                let producto = await tx.productos_materiales.findFirst({
                    where: {
                        nombre_Producto: {
                            equals: data.producto,
                        }
                    },
                });
                if (!producto) {
                    producto = await tx.productos_materiales.create({
                        data: {
                            nombre_Producto: data.producto,
                            UM: data.unidadMedidaVentas,
                            presentacion: data.presentacion,
                        },
                    });
                }
                const productoId = Number(producto.id_Produc_Mater || producto.id);
                const orden = await tx.ordenes_produccion.create({
                    data: {
                        id_Venta_Origen: Number(data.idVenta),
                        vendedor_id: vendedorId,
                        cliente_id: clienteId,
                        linea_Produccion: data.lineaProduccion,
                        producto_id: productoId,
                        servicio: data.servicio,
                        cantidad_Venta: Number(data.cantidadVentas),
                        fecha_Confirmacion: data.fechaConfirmacion ? new Date(data.fechaConfirmacion) : null,
                        fecha_Compromiso: data.fechaCompromisoPago ? new Date(data.fechaCompromisoPago) : null,
                        urgencia: data.urgencia,
                        observaciones: data.observacionesVentas,
                    },
                });
                return {
                    success: true,
                    orden,
                    producto,
                    vendedorId,
                    clienteId
                };
            });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async obtenerTodasLasOrdenes() {
        try {
            const ordenes = await this.prisma.ordenes_produccion.findMany({
                include: {
                    personas_ordenes_produccion_vendedor_idTopersonas: {
                        select: {
                            id_Persona: true,
                            nombre: true,
                            tipo_persona: true,
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
                    lotes_produccion: true,
                },
                orderBy: {
                    id_Orden_Produc: 'desc',
                },
            });
            const etiquetasArea = {
                VENTAS: 'ventas',
                PLAN_PRODUCCION: 'plan_produccion',
                PRODUCCION: 'produccion',
                CALIDAD: 'calidad',
                ALMACEN: 'almacen',
                LOGISTICA: 'logistica',
                CLIENTE: 'cliente',
            };
            const result = ordenes.map((orden) => ({
                ...orden,
                estadoActual: {
                    area: orden.estatus_flujo.toLowerCase(),
                    label: etiquetasArea[orden.estatus_flujo],
                },
            }));
            return { success: true, result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
};
exports.VentasService = VentasService;
exports.VentasService = VentasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VentasService);
//# sourceMappingURL=ventas.service.js.map