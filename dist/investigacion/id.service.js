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
exports.InvestigacionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma.service");
const events_gateway_1 = require("../events.gateway");
const trazabilidad_service_1 = require("../trazabilidad/trazabilidad.service");
const id_logic_1 = require("./id.logic");
const seleccion = { id_Muestra: true, no_Muestra: true, area_Muestra: true,
    estado_Muestra: true, categoria_Muestra: true, etapa_Muestra: true,
    producto_id: true, cliente_id: true, vendedor_id: true, caracterizacion: true,
    cantidad_proyecto: true, unidad_proyecto: true,
    viabilidad_nombre: true, viabilidad_id: true, fecha_recoleccion: true,
    fecha_ingreso_laboratorio: true, ficha_nombre: true, observaciones: true,
    productos_materiales: { select: { nombre_Producto: true } },
    personas_muestras_cliente_idTopersonas: { select: { nombre: true } },
    personas_muestras_vendedor_idTopersonas: { select: { nombre: true } },
    id_ejecuciones: { select: { id: true, ciclo: true, orden: true, nombre: true,
            estandar_segundos: true, estandar_version: true, disponible_desde: true,
            inicio: true, fin: true, inicio_por: true, fin_por: true, resultado: true },
        orderBy: [{ ciclo: 'asc' }, { orden: 'asc' }] }
};
let InvestigacionService = class InvestigacionService {
    prisma;
    eventos;
    tiempos;
    constructor(prisma, eventos, tiempos) {
        this.prisma = prisma;
        this.eventos = eventos;
        this.tiempos = tiempos;
    }
    filtro(u) { return { area_Muestra: 'INVESTIGACION_DESARROLLO', ...(u.area === 'ventas' ? { vendedor_id: u.personaId } : {}) }; }
    async muestra(db, id, u) {
        const m = await db.muestras.findFirst({ where: { ...this.filtro(u), id_Muestra: id }, select: seleccion });
        if (!m)
            throw new common_1.NotFoundException('Muestra de I+D no encontrada');
        return m;
    }
    ctx(id) { return { entidad: 'MUESTRA_ID', entidad_id: id }; }
    avisar(id) { this.eventos.notificar('ID_MUESTRA_ACTUALIZADA', { id_Muestra: id }); }
    async catalogos() {
        return { success: true,
            viabilidades: await this.prisma.id_viabilidades.findMany({ orderBy: { nombre: 'asc' } }),
            procesos: await this.prisma.id_procesos.findMany({ orderBy: { nombre: 'asc' } }) };
    }
    async referencias(q) {
        const whereNombre = { contains: String(q || '').slice(0, 100) };
        return { success: true, productos: await this.prisma.productos_materiales.findMany({ where: { nombre_Producto: whereNombre }, select: { id_Produc_Mater: true, nombre_Producto: true }, take: 50 }),
            clientes: await this.prisma.personas.findMany({ where: { tipo_persona: 'CLIENTE', nombre: whereNombre }, select: { id_Persona: true, nombre: true }, take: 50 }) };
    }
    async guardarCatalogo(tipo, body, u) {
        const nombre = (0, id_logic_1.texto)(body?.nombre), activo = body.activo == null ? true : body.activo;
        if (typeof activo !== 'boolean')
            throw new common_1.BadRequestException('Activo debe ser booleano');
        const id = body.id == null ? null : (0, id_logic_1.idValido)(body.id);
        const result = await this.prisma.$transaction(async (tx) => {
            let row;
            if (tipo === 'proceso') {
                const data = { nombre, activo, estandar_segundos: (0, id_logic_1.estandar)(body.estandar_segundos) };
                row = id ? await tx.id_procesos.update({ where: { id }, data: { ...data, version: { increment: 1 } } }) : await tx.id_procesos.create({ data });
            }
            else
                row = id ? await tx.id_viabilidades.update({ where: { id }, data: { nombre, activo } }) : await tx.id_viabilidades.create({ data: { nombre, activo } });
            await this.tiempos.evento(tx, { entidad: 'MUESTRA_ID', entidad_id: 0 }, 1, 'CATALOGO_ACTUALIZADO', { tipo, id: row.id, usuario: u.usuario, nombre });
            return row;
        });
        this.eventos.notificar('ID_CATALOGO_ACTUALIZADO', {});
        return { success: true, data: result };
    }
    async crear(body, file, u) {
        const f = (0, id_logic_1.fichaValida)(file), producto = (0, id_logic_1.idValido)(body.producto_id), cliente = (0, id_logic_1.idValido)(body.cliente_id), viabilidad = (0, id_logic_1.idValido)(body.viabilidad_id);
        if (!['FILTRACION', 'REGENERACION'].includes(body.caracterizacion))
            throw new common_1.BadRequestException('Caracterización inválida');
        const cantidad = String(body.cantidad_proyecto ?? '');
        if (!/^\d{1,10}(\.\d{1,4})?$/.test(cantidad) || Number(cantidad) <= 0)
            throw new common_1.BadRequestException('Cantidad positiva con hasta 4 decimales');
        const unidad = (0, id_logic_1.texto)(body.unidad_proyecto, 30), recoleccion = new Date(body.fecha_recoleccion);
        if (isNaN(+recoleccion) || +recoleccion > Date.now())
            throw new common_1.BadRequestException('Fecha de recolección inválida o futura');
        const result = await this.prisma.$transaction(async (tx) => {
            const [prod, cli, vend, v] = await Promise.all([tx.productos_materiales.findUnique({ where: { id_Produc_Mater: producto } }), tx.personas.findFirst({ where: { id_Persona: cliente, tipo_persona: 'CLIENTE' } }), tx.personas.findUnique({ where: { id_Persona: u.personaId } }), tx.id_viabilidades.findFirst({ where: { id: viabilidad, activo: true } })]);
            if (!prod || !cli || !vend || !v)
                throw new common_1.BadRequestException('Producto, cliente, vendedor o viabilidad inválidos');
            const m = await tx.muestras.create({ data: { no_Muestra: `ID-${(0, crypto_1.randomUUID)()}`, area_Muestra: 'INVESTIGACION_DESARROLLO', producto_id: producto, cliente_id: cliente, vendedor_id: u.personaId,
                    fecha_Toma: recoleccion, Hora_Toma: recoleccion, fecha_recoleccion: recoleccion, caracterizacion: body.caracterizacion, cantidad_proyecto: new client_1.Prisma.Decimal(cantidad), unidad_proyecto: unidad,
                    viabilidad_id: viabilidad, viabilidad_nombre: v.nombre, ficha_nombre: f.nombre, ficha_mime: f.mime, ficha_contenido: new Uint8Array(file.buffer), observaciones: body.observaciones ? (0, id_logic_1.texto)(body.observaciones, 4000) : null }, select: { id_Muestra: true } });
            const tramo = await this.tiempos.transicion(tx, this.ctx(m.id_Muestra), 'TRASLADO');
            await tx.proceso_tramos.update({ where: { id: tramo.id }, data: { inicio: recoleccion } });
            await this.tiempos.evento(tx, this.ctx(m.id_Muestra), 1, 'REGISTRO_VENTAS', { usuario: u.usuario, fechaRecoleccionDeclarada: recoleccion.toISOString() });
            return m;
        });
        this.avisar(result.id_Muestra);
        return { success: true, data: result };
    }
    async listar(u, paginaEntrada) {
        const pagina = paginaEntrada ? (0, id_logic_1.idValido)(paginaEntrada) : 1, where = this.filtro(u);
        const [total, data] = await this.prisma.$transaction([this.prisma.muestras.count({ where }), this.prisma.muestras.findMany({ where, select: seleccion, orderBy: { id_Muestra: 'desc' }, take: 50, skip: (pagina - 1) * 50 })]);
        return { success: true, total, pagina, data: data.map(m => ({ ...m, procesos_id: m.id_ejecuciones.map(p => ({ ...p, ...(0, id_logic_1.metricas)(p) })) })) };
    }
    async detalle(id, u) { const m = await this.muestra(this.prisma, id, u); return { success: true, data: { ...m, procesos_id: m.id_ejecuciones.map(p => ({ ...p, ...(0, id_logic_1.metricas)(p) })), eventos: await this.prisma.proceso_eventos.findMany({ where: { entidad: 'MUESTRA_ID', entidad_id: id }, orderBy: { id: 'desc' }, take: 500 }) } }; }
    async ficha(id, u) { await this.muestra(this.prisma, id, u); const f = await this.prisma.muestras.findUnique({ where: { id_Muestra: id }, select: { ficha_contenido: true, ficha_nombre: true, ficha_mime: true } }); if (!f?.ficha_contenido)
        throw new common_1.NotFoundException('Sin ficha técnica'); return f; }
    async planificar(id, body, u) {
        if (!Array.isArray(body?.procesos) || !body.procesos.length || body.procesos.length > 50)
            throw new common_1.BadRequestException('Selecciona entre 1 y 50 procesos en orden');
        const ids = body.procesos.map(id_logic_1.idValido);
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra=${id} FOR UPDATE`;
            const m = await this.muestra(tx, id, u), ciclo = m.id_ejecuciones.at(-1)?.ciclo ?? 1;
            const anteriores = m.id_ejecuciones.filter(p => p.ciclo === ciclo);
            const nuevo = body.nuevoCiclo === true;
            if (nuevo && !['APROBADO', 'RECHAZADO'].includes(m.estado_Muestra))
                throw new common_1.BadRequestException('Finaliza el ciclo antes de abrir otro');
            if (!nuevo && (anteriores.some(p => p.inicio) || ['APROBADO', 'RECHAZADO'].includes(m.estado_Muestra)))
                throw new common_1.BadRequestException('El plan ya inició. Abre otro ciclo al finalizar');
            if (nuevo && !anteriores.length)
                throw new common_1.BadRequestException('No hay un ciclo anterior');
            const num = nuevo ? ciclo + 1 : ciclo;
            const cat = await tx.id_procesos.findMany({ where: { id: { in: ids }, activo: true } });
            if (ids.some((pid) => !cat.some(c => c.id === pid)))
                throw new common_1.BadRequestException('Proceso inexistente o inactivo');
            if (!nuevo)
                await tx.id_ejecuciones.deleteMany({ where: { muestra_id: id, ciclo } });
            const ahora = new Date();
            await tx.id_ejecuciones.createMany({ data: ids.map((pid, i) => { const p = cat.find(c => c.id === pid); return { muestra_id: id, proceso_id: pid, ciclo: num, orden: i + 1, nombre: p.nombre, estandar_segundos: p.estandar_segundos, estandar_version: p.version, disponible_desde: i === 0 ? (nuevo ? ahora : m.fecha_ingreso_laboratorio) : null }; }) });
            if (nuevo) {
                await tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: 'PENDIENTE' } });
                await this.tiempos.transicion(tx, this.ctx(id), 'ESPERA_ANALISIS', true);
            }
            await this.tiempos.evento(tx, this.ctx(id), num, 'PLAN_PROCESOS', { usuario: u.usuario, procesos: ids, nuevoCiclo: nuevo });
            return { success: true };
        });
        this.avisar(id);
        return result;
    }
    async recibir(id, u) {
        const r = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra=${id} FOR UPDATE`;
            const m = await this.muestra(tx, id, u);
            if (m.fecha_ingreso_laboratorio)
                return { success: true, repetida: true };
            const ahora = new Date();
            await tx.muestras.update({ where: { id_Muestra: id }, data: { fecha_ingreso_laboratorio: ahora } });
            await tx.id_ejecuciones.updateMany({ where: { muestra_id: id, ciclo: 1, orden: 1, inicio: null }, data: { disponible_desde: ahora } });
            await this.tiempos.transicion(tx, this.ctx(id), 'ESPERA_ANALISIS');
            await this.tiempos.evento(tx, this.ctx(id), 1, 'RECEPCION_LABORATORIO', { usuario: u.usuario });
            return { success: true };
        });
        this.avisar(id);
        return r;
    }
    async proceso(id, ejecucion, accion, body, u) {
        const r = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra=${id} FOR UPDATE`;
            const m = await this.muestra(tx, id, u);
            if (!m.fecha_ingreso_laboratorio)
                throw new common_1.BadRequestException('Registra la recepción primero');
            const ciclo = m.id_ejecuciones.at(-1)?.ciclo, lista = m.id_ejecuciones.filter(p => p.ciclo === ciclo), p = lista.find(p => p.id === ejecucion);
            if (!p)
                throw new common_1.NotFoundException('Proceso no pertenece al ciclo actual');
            const ahora = new Date();
            if (accion === 'iniciar') {
                if (p.inicio)
                    return { success: true, repetida: true };
                if (lista.some(x => x.orden < p.orden && !x.fin))
                    throw new common_1.BadRequestException('Termina los procesos previos');
                if (['APROBADO', 'RECHAZADO'].includes(m.estado_Muestra))
                    throw new common_1.BadRequestException('Ciclo finalizado');
                await tx.id_ejecuciones.update({ where: { id: p.id }, data: { inicio: ahora, inicio_por: u.usuario } });
                await tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: 'EN_ANALISIS' } });
                await this.tiempos.transicion(tx, this.ctx(id), `PROCESO_ID_${p.id}`);
            }
            else {
                if (p.fin)
                    return { success: true, repetida: true };
                if (!p.inicio)
                    throw new common_1.BadRequestException('Inicia el proceso primero');
                await tx.id_ejecuciones.update({ where: { id: p.id }, data: { fin: ahora, fin_por: u.usuario, resultado: (0, id_logic_1.texto)(body?.resultado, 8000) } });
                const siguiente = lista.find(x => x.orden === p.orden + 1);
                if (siguiente)
                    await tx.id_ejecuciones.update({ where: { id: siguiente.id }, data: { disponible_desde: ahora } });
                await this.tiempos.transicion(tx, this.ctx(id), siguiente ? 'ESPERA_ANALISIS' : 'ESPERA_DICTAMEN');
            }
            await this.tiempos.evento(tx, this.ctx(id), p.ciclo, accion === 'iniciar' ? 'INICIO_PROCESO' : 'FIN_PROCESO', { ejecucion: p.id, nombre: p.nombre, usuario: u.usuario });
            return { success: true };
        });
        this.avisar(id);
        return r;
    }
    async finalizar(id, body, u) {
        if (!['APROBADO', 'RECHAZADO'].includes(body?.dictamen))
            throw new common_1.BadRequestException('Dictamen inválido');
        const r = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id_Muestra FROM muestras WHERE id_Muestra=${id} FOR UPDATE`;
            const m = await this.muestra(tx, id, u);
            if (['APROBADO', 'RECHAZADO'].includes(m.estado_Muestra))
                throw new common_1.BadRequestException('Ciclo ya finalizado');
            const ciclo = m.id_ejecuciones.at(-1)?.ciclo, lista = m.id_ejecuciones.filter(p => p.ciclo === ciclo);
            if (!lista.length || lista.some(p => !p.fin))
                throw new common_1.BadRequestException('Completa todos los procesos');
            await tx.muestras.update({ where: { id_Muestra: id }, data: { estado_Muestra: body.dictamen } });
            await this.tiempos.transicion(tx, this.ctx(id), null);
            await this.tiempos.evento(tx, this.ctx(id), ciclo, 'FIN_ANALISIS', { dictamen: body.dictamen, observaciones: body.observaciones ? (0, id_logic_1.texto)(body.observaciones, 4000) : null, usuario: u.usuario });
            return { success: true };
        });
        this.avisar(id);
        return r;
    }
    async reporte(q) {
        const desde = q.desde ? new Date(q.desde) : undefined, hasta = q.hasta ? new Date(q.hasta) : undefined;
        if ((desde && isNaN(+desde)) || (hasta && isNaN(+hasta)) || (desde && hasta && desde > hasta))
            throw new common_1.BadRequestException('Fechas inválidas');
        const where = { muestras: { area_Muestra: 'INVESTIGACION_DESARROLLO' }, ...(desde || hasta ? { inicio: { gte: desde, lt: hasta } } : {}) };
        const pagina = q.pagina ? (0, id_logic_1.idValido)(q.pagina) : 1;
        const [total, data] = await this.prisma.$transaction([this.prisma.id_ejecuciones.count({ where }), this.prisma.id_ejecuciones.findMany({ where, orderBy: { id: 'asc' }, take: 200, skip: (pagina - 1) * 200, include: { muestras: { select: { no_Muestra: true, producto_id: true, cliente_id: true } } } })]);
        return { success: true, total, pagina, data: data.map(p => ({ ...p, ...(0, id_logic_1.metricas)(p) })) };
    }
};
exports.InvestigacionService = InvestigacionService;
exports.InvestigacionService = InvestigacionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, events_gateway_1.EventsGateway, trazabilidad_service_1.TrazabilidadService])
], InvestigacionService);
//# sourceMappingURL=id.service.js.map