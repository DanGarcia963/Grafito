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
var CalidadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalidadService = void 0;
const trazabilidad_service_1 = require("../trazabilidad/trazabilidad.service");
const events_gateway_1 = require("../events.gateway");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let CalidadService = CalidadService_1 = class CalidadService {
    prisma;
    tiempos;
    eventos;
    constructor(prisma, tiempos, eventos) {
        this.prisma = prisma;
        this.tiempos = tiempos;
        this.eventos = eventos;
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
                where: { area_Muestra: 'CALIDAD' },
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
                result: await Promise.all(muestras.map(async (m) => ({ ...m, tiempoActual: await this.prisma.proceso_tramos.findFirst({ where: { entidad: 'MUESTRA', entidad_id: m.id_Muestra }, orderBy: { id: 'desc' } }) }))),
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
                    muestras: { area_Muestra: 'CALIDAD' },
                },
                select: {
                    valor_Obtenido_Num: true,
                    ciclo_analisis: true,
                    fecha_Resultado: true,
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
                    }
                },
                where: {
                    area_Muestra: 'CALIDAD',
                    estado_Muestra: {
                        in: ['APROBADO', 'RECHAZADO'],
                    },
                    categoria_Muestra: {
                        in: ['MUESTRA_AJUSTADO']
                    }
                },
            });
            return {
                success: true,
                result: await Promise.all(muestras.map(async (m) => ({ ...m, tiempoActual: await this.prisma.proceso_tramos.findFirst({ where: { entidad: 'MUESTRA', entidad_id: m.id_Muestra }, orderBy: { id: 'desc' } }) }))),
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
                    ciclo_analisis: payload.ciclo_analisis,
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
    async cambiarEtapaMuestra(idEntrada, accion) {
        const id = this.tiempos.id(idEntrada);
        const resultado = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra = ${id} FOR UPDATE`;
            const muestra = await tx.muestras.findUnique({ where: { id_Muestra: id } });
            if (!muestra || muestra.area_Muestra !== 'CALIDAD')
                throw new common_1.NotFoundException('Muestra de Calidad no encontrada');
            const ctx = { entidad: 'MUESTRA', entidad_id: id, lote_id: muestra.lote_id, tanque_id: muestra.tanque_id };
            const ultimo = await this.tiempos.ultimo(tx, ctx);
            const etapa = ultimo?.fin == null ? ultimo?.etapa : null;
            const finalizada = ['APROBADO', 'RECHAZADO'].includes(muestra.estado_Muestra);
            if (accion === 'REABRIR') {
                if (!finalizada)
                    throw new common_1.BadRequestException('Solo se puede reabrir una muestra dictaminada');
                const tramo = await this.tiempos.transicion(tx, ctx, 'REANALISIS_PENDIENTE', true);
                await tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: 'PENDIENTE' } });
                await this.tiempos.evento(tx, ctx, tramo.ciclo, 'REANALISIS_SOLICITADO', { estadoAnterior: muestra.estado_Muestra });
            }
            else {
                if (finalizada)
                    throw new common_1.BadRequestException('La muestra ya fue dictaminada');
                if (accion === 'RECIBIR') {
                    if (etapa === 'ESPERA_ANALISIS' || etapa === 'ANALISIS')
                        return { success: true, repetida: true };
                    const tramo = await this.tiempos.transicion(tx, ctx, 'ESPERA_ANALISIS');
                    await this.tiempos.evento(tx, ctx, tramo.ciclo, 'RECEPCION_MUESTRA', { sinTomaHorariaPrevia: !ultimo });
                    await tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: 'PENDIENTE' } });
                }
                else {
                    if (etapa === 'ANALISIS')
                        return { success: true, repetida: true };
                    if (etapa !== 'ESPERA_ANALISIS')
                        throw new common_1.BadRequestException('Primero registra la recepción de la muestra');
                    const tramo = await this.tiempos.transicion(tx, ctx, 'ANALISIS');
                    await tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: 'EN_ANALISIS' } });
                    await this.tiempos.evento(tx, ctx, tramo.ciclo, 'INICIO_ANALISIS');
                }
            }
            return { success: true };
        });
        this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
        return resultado;
    }
    async finalizarAnalisis(payload) {
        const id = this.tiempos.id(payload?.idMuestra);
        if (!['APROBADO', 'RECHAZADO'].includes(payload?.dictamen))
            throw new common_1.BadRequestException('Dictamen inválido');
        if (!Array.isArray(payload?.mediciones) || !payload.mediciones.length)
            throw new common_1.BadRequestException('Captura al menos un resultado');
        if (new Set(payload.mediciones.map((m) => m.id_Parametro)).size !== payload.mediciones.length)
            throw new common_1.BadRequestException('Parámetros duplicados');
        for (const m of payload.mediciones) {
            this.tiempos.id(m?.id_Parametro);
            if (typeof m.valor !== 'string' || !m.valor.trim())
                throw new common_1.BadRequestException('Resultado vacío');
        }
        const resultado = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra = ${id} FOR UPDATE`;
            const muestra = await tx.muestras.findUnique({ where: { id_Muestra: id } });
            if (!muestra || muestra.area_Muestra !== 'CALIDAD')
                throw new common_1.NotFoundException('Muestra de Calidad no encontrada');
            const ctx = { entidad: 'MUESTRA', entidad_id: id, lote_id: muestra.lote_id, tanque_id: muestra.tanque_id };
            const tramo = await this.tiempos.ultimo(tx, ctx);
            if (!tramo || tramo.fin || tramo.etapa !== 'ANALISIS')
                throw new common_1.BadRequestException('Inicia el análisis antes de finalizar; si ya terminó, consulta el historial');
            const worker = new CalidadService_1(tx, this.tiempos, this.eventos);
            const resultados = await worker.crearResultadosMuestraCalidad({ id_Muestra: id, mediciones: payload.mediciones, ciclo_analisis: tramo.ciclo });
            if (!resultados.success)
                throw new common_1.BadRequestException(resultados.error);
            const dictamen = await worker.actualizarEstadoMuestra({ ...payload, idMuestra: id });
            if (!dictamen.success || !dictamen.count)
                throw new common_1.BadRequestException(dictamen.error || 'No se guardó el dictamen');
            await this.tiempos.transicion(tx, ctx, null);
            await this.tiempos.evento(tx, ctx, tramo.ciclo, 'FIN_ANALISIS', { dictamen: payload.dictamen, tipoMuestra: payload.tipoMuestra, analistaDeclarado: payload.analistaNombre ?? null, observaciones: payload.observaciones ?? null });
            return { success: true, ciclo: tramo.ciclo };
        }, { timeout: 30000 });
        this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
        this.eventos.notificar('TANQUE_ACTUALIZADO', { muestraId: id });
        return resultado;
    }
    async actualizarEstatusMuestra(payload) {
        const id = this.tiempos.id(payload?.id_Muestra);
        const estado = String(payload?.estatus_Muestra ?? '').trim().toUpperCase();
        if (estado !== 'APROBADO')
            throw new common_1.BadRequestException('Usa recibir, iniciar o finalizar para registrar el ciclo. Este endpoint libera una muestra rechazada.');
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra = ${id} FOR UPDATE`;
            const muestra = await tx.muestras.findUnique({ where: { id_Muestra: id } });
            if (!muestra || muestra.area_Muestra !== 'CALIDAD')
                throw new common_1.NotFoundException('Muestra de Calidad no encontrada');
            if (muestra.estado_Muestra === 'APROBADO')
                return muestra;
            if (muestra.estado_Muestra !== 'RECHAZADO')
                throw new common_1.BadRequestException('Solo puedes liberar una muestra rechazada');
            const ctx = { entidad: 'MUESTRA', entidad_id: id, lote_id: muestra.lote_id, tanque_id: muestra.tanque_id };
            const ultimo = await this.tiempos.ultimo(tx, ctx);
            await this.tiempos.evento(tx, ctx, ultimo?.ciclo ?? 1, 'LIBERACION_MANUAL', { anterior: muestra.estado_Muestra, nuevo: estado });
            return tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: 'APROBADO' } });
        });
        this.eventos.notificar('MUESTRA_ACTUALIZADA', { id_Muestra: id });
        return { success: true, data: result };
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
    async obtenerOrdenesPendientesDeLlegada(fechaFiltro) {
        try {
            const fechaLimite = fechaFiltro ? new Date(fechaFiltro) : new Date();
            fechaLimite.setHours(23, 59, 59, 999);
            const ordenes = await this.prisma.ordenes_produccion.findMany({
                where: {
                    linea_Produccion: 'GRAFITO',
                    fecha_Llegada: {
                        not: null,
                        lte: fechaLimite,
                    },
                    lotes_llegada: {
                        none: {},
                    },
                },
                select: {
                    id_Orden_Produc: true,
                    no_Orden_Produc: true,
                    linea_Produccion: true,
                    fecha_Llegada: true,
                    cantidad_Venta: true,
                    observaciones: true,
                },
                orderBy: {
                    fecha_Llegada: 'asc',
                },
            });
            return {
                success: true,
                result: ordenes,
            };
        }
        catch (error) {
            console.error('Error al obtener ordenes pendientes de llegada:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async crearLoteConChecklist(payload) {
        try {
            const { no_lote, orden_produccion_id, reviso_nombre, estado_checklist, fecha_llegada, fecha_Revision, observaciones, contenedores, } = payload;
            if (!no_lote || !orden_produccion_id || !reviso_nombre || !contenedores || contenedores.length === 0) {
                return {
                    success: false,
                    error: 'Faltan campos requeridos (no_lote, orden_produccion_id, reviso_nombre o contenedores).'
                };
            }
            const nuevoLote = await this.prisma.lotes_llegada.create({
                data: {
                    no_lote,
                    orden_produccion_id: Number(orden_produccion_id),
                    reviso_nombre,
                    estado_checklist,
                    fecha_Revision,
                    fecha_llegada,
                    observaciones: observaciones == null ? observaciones : JSON.stringify(observaciones),
                },
            });
            await this.prisma.checklist_contenedor.createMany({
                data: contenedores.map((c) => ({
                    lote_llegada_id: nuevoLote.id,
                    no_consecutivo: Number(c.no_consecutivo),
                    numero_contenedor: c.numero_contenedor,
                    tapa_valvula: Boolean(c.tapa_valvula),
                    rejilla_danada: Boolean(c.rejilla_danada),
                    base_danada: Boolean(c.base_danada),
                    derrame: Boolean(c.derrame),
                    observaciones: c.observaciones || null,
                })),
            });
            return { success: true, result: nuevoLote };
        }
        catch (error) {
            console.error('Error al registrar lote de llegada con checklist:', error);
            return { success: false, error: error.message };
        }
    }
};
exports.CalidadService = CalidadService;
exports.CalidadService = CalidadService = CalidadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, trazabilidad_service_1.TrazabilidadService, events_gateway_1.EventsGateway])
], CalidadService);
//# sourceMappingURL=calidad.service.js.map