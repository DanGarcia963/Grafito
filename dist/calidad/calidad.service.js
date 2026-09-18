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
exports.CalidadService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let CalidadService = class CalidadService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async obtenerParametrosCalidad() {
        try {
            const parametros = await this.prisma.parametros_laboratorio.findMany();
            return { success: true, result: parametros };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async obtenerTodasLasMuestras() {
        try {
            const muestras = await this.prisma.muestras.findMany({
                include: {
                    personas_muestras_cliente_idTopersonas: {
                        select: {
                            id_Persona: true,
                            nombre: true,
                            tipo_persona: true,
                        },
                    },
                    personas_muestras_analista_idTopersonas: {
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
                            equipos_tanques: {
                                select: {
                                    id_Equipos_Tanques: true,
                                    nombre_Equipo: true,
                                },
                            },
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
                    equipos_tanques: {
                        select: {
                            id_Equipos_Tanques: true,
                            nombre_Equipo: true,
                            estatus_proceso: true,
                        },
                    },
                    resultado_analisis: true,
                },
                orderBy: {
                    fecha_Toma: 'desc',
                },
            });
            return {
                success: true,
                result: muestras,
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async buscarEspecificacionesMuestra(muestraID) {
        try {
            const id = Number(muestraID);
            if (isNaN(id)) {
                throw new common_1.NotFoundException('El ID de la muestra proporcionado no es válido.');
            }
            const especificaciones = await this.prisma.resultado_analisis.findMany({
                where: {
                    muestra_id: id,
                },
                select: {
                    valor_Obtenido_Num: true,
                    cumple_Especificacion: true,
                    muestras: {
                        select: {
                            id_Muestra: true,
                            no_Muestra: true,
                        },
                    },
                    parametros_laboratorio: {
                        select: {
                            id_Parametro: true,
                            nombre_Parametro: true,
                        },
                    },
                },
            });
            if (!especificaciones || especificaciones.length === 0) {
                throw new common_1.NotFoundException(`No se encontraron especificaciones o análisis para la muestra con ID ${id}`);
            }
            return especificaciones;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            console.error('Error al obtener especificaciones de la muestra:', error);
            throw new common_1.InternalServerErrorException('Ocurrió un error en el servidor al consultar las especificaciones.');
        }
    }
    async obtenerTodasMuestrasConDictamen() {
        try {
            const muestras = await this.prisma.muestras.findMany({
                include: {
                    personas: {
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
                            equipos_tanques: {
                                select: {
                                    id_Equipos_Tanques: true,
                                    nombre_Equipo: true,
                                },
                            },
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
                    equipos_tanques: {
                        select: {
                            id_Equipos_Tanques: true,
                            nombre_Equipo: true,
                            estatus_proceso: true,
                        },
                    }
                },
                where: {
                    estado_Muestra: {
                        in: ['APROBADO', 'RECHAZADO'],
                    },
                },
            });
            return {
                success: true,
                result: muestras,
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async crearResultadosMuestraCalidad(payload) {
        try {
            const { id_Muestra, mediciones } = payload;
            const muestra = await this.prisma.muestras.findUnique({
                where: { id_Muestra },
                select: {
                    producto_id: true,
                },
            });
            if (!muestra) {
                return { success: false, error: 'Muestra no encontrada' };
            }
            const idProducto = muestra.producto_id;
            const ahora = new Date();
            const fechaActualIso = new Date();
            const horaActual = ahora.toTimeString().split(' ')[0];
            const resultadosAInsertar = await Promise.all(mediciones.map(async (med) => {
                const parametro = await this.prisma.parametros_laboratorio.findUnique({
                    where: { id_Parametro: med.id_Parametro },
                });
                const especificacion = await this.prisma.especificaciones_producto.findFirst({
                    where: {
                        producto_id: idProducto,
                        parametro_id: med.id_Parametro,
                    },
                });
                let cumpleEspecificacion = false;
                const valorIngresado = String(med.valor ?? '').trim();
                const tipoDato = String(parametro?.tipo_Dato ?? '').toUpperCase();
                if (tipoDato === 'NUMERICO') {
                    const valorNum = parseFloat(valorIngresado);
                    const minStr = especificacion?.valor_Minimo != null ? String(especificacion.valor_Minimo).trim() : null;
                    const maxStr = especificacion?.valor_Maximo != null ? String(especificacion.valor_Maximo).trim() : null;
                    const minNum = minStr && minStr !== '' ? parseFloat(minStr) : -Infinity;
                    const maxNum = maxStr && maxStr !== '' ? parseFloat(maxStr) : Infinity;
                    if (!isNaN(valorNum)) {
                        cumpleEspecificacion = valorNum >= minNum && valorNum <= maxNum;
                    }
                    else {
                        cumpleEspecificacion = false;
                    }
                }
                else {
                    const valorMinimoEsperado = especificacion?.valor_Minimo != null
                        ? String(especificacion.valor_Minimo).trim().toLowerCase()
                        : '';
                    if (valorMinimoEsperado.length > 0) {
                        cumpleEspecificacion = valorIngresado.toLowerCase() === valorMinimoEsperado;
                    }
                    else {
                        cumpleEspecificacion = valorIngresado.length > 0;
                    }
                }
                return {
                    muestra_id: id_Muestra,
                    parametro_id: med.id_Parametro,
                    valor_Obtenido_Num: valorIngresado,
                    cumple_Especificacion: cumpleEspecificacion,
                    fecha_Resultado: fechaActualIso,
                };
            }));
            const res = await this.prisma.resultado_analisis.createMany({
                data: resultadosAInsertar,
            });
            return { success: true, count: res.count };
        }
        catch (error) {
            console.error('Error al guardar resultados:', error);
            return { success: false, error: error.message };
        }
    }
    async agregarEspecifProduct(data) {
        try {
            const especif = await this.prisma.especificaciones_producto.create({
                data
            });
            return { success: true, result: especif };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async actualizarEstadoMuestra({ idMuestra, dictamen, tipoMuestra, observaciones, analistaNombre, }) {
        try {
            let idAnalista = null;
            if (analistaNombre && analistaNombre.trim() !== '') {
                const nombreLimpio = analistaNombre.trim();
                let analista = await this.prisma.personas.findFirst({
                    where: {
                        nombre: {
                            equals: nombreLimpio,
                        },
                    },
                });
                if (!analista) {
                    analista = await this.prisma.personas.create({
                        data: {
                            nombre: nombreLimpio,
                            tipo_persona: 'LABORATORISTA',
                        },
                    });
                }
                idAnalista = analista.id_Persona;
            }
            const muestraActual = await this.prisma.muestras.findUnique({
                where: { id_Muestra: Number(idMuestra) },
                select: {
                    lote_id: true,
                    lotes_produccion: {
                        select: {
                            orden_Produccion_id: true,
                        },
                    },
                },
            });
            if (!muestraActual) {
                return { success: false, error: 'Muestra no encontrada' };
            }
            const idOrdenProduc = muestraActual.lotes_produccion?.orden_Produccion_id;
            if (tipoMuestra === 'MUESTRA_AJUSTADO' && dictamen === 'RECHAZADO') {
                if (idOrdenProduc) {
                    await this.prisma.ordenes_produccion.updateMany({
                        where: {
                            id_Orden_Produc: idOrdenProduc,
                        },
                        data: {
                            estatus_flujo: 'produccion',
                        },
                    });
                }
            }
            const update = await this.prisma.muestras.updateMany({
                where: {
                    id_Muestra: Number(idMuestra),
                },
                data: {
                    estado_Muestra: dictamen,
                    categoria_Muestra: tipoMuestra,
                    observaciones: observaciones,
                    analista_id: idAnalista,
                },
            });
            return {
                success: true,
                count: update.count,
            };
        }
        catch (error) {
            console.error('Error al actualizar el estado de la muestra:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async buscarAnalistas(query) {
        try {
            const analistas = await this.prisma.personas.findMany({
                where: {
                    nombre: {
                        contains: query,
                    },
                },
                take: 5,
                select: {
                    id_Persona: true,
                    nombre: true,
                },
            });
            return {
                success: true,
                analistas: analistas.map((a) => ({ id: a.id_Persona, nombre: a.nombre })),
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
};
exports.CalidadService = CalidadService;
exports.CalidadService = CalidadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CalidadService);
//# sourceMappingURL=calidad.service.js.map