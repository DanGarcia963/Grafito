import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, type entregas_logistica } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Usuario } from '../auth/auth.service';
import { PrismaService } from '../prisma.service';
import { bloquearMaterial } from '../inventario/inventario.logic';
import {
  CAPACIDADES_CONTENEDORES, compararCarga, decimalNoNegativo,
  decimalPositivo, expedienteComercialApto, idSeguro, saldoFisicoUbicacion,
  textoSeguro, tipoVehiculo, verificarRecepcion,
} from './logistica.logic';

type Tx = Prisma.TransactionClient;
type ContenedorSeleccionado = { id: number; lote_inventario_id: number; ubicacion_id: number; saldo_kg: Prisma.Decimal };
const D = (v: unknown) => new Prisma.Decimal(String(v ?? 0));

@Injectable()
export class LogisticaService {
  constructor(private readonly prisma: PrismaService) {}

  private validarPersonal(u: Usuario) {
    if (u.area === 'cliente') throw new ForbiddenException('Esta operación es exclusiva de Logística y Almacén.');
  }
  private async registrarEvento(tx: Tx, accion: string, actor: string, entregaId?: number, viajeId?: number, datos?: object) {
    await tx.logistica_eventos.create({
      data: {
        entrega_id: entregaId ?? null, viaje_id: viajeId ?? null,
        accion, actor, datos: datos ? (datos as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  }
  private async expedienteValido(tx: Tx, loteProduccionId: number) {
    const [lp, certificados, legado] = await Promise.all([
      tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: loteProduccionId },
        select: { estado: true, estado_Calida: true },
      }),
      tx.certificado_calidad.findMany({
        where: { lote_id: loteProduccionId },
        select: { estatus: true, estatus_Calidad: true, documento_contenido: true },
      }),
      tx.calidad_conciliaciones_legacy.findUnique({
        where: { lote_produccion_id: loteProduccionId },
        select: { estado: true, documento_contenido: true },
      }),
    ]);
    return lp ? expedienteComercialApto(lp, certificados, legado) : false;
  }
  private async saldoEnUbicacion(tx: Tx, lote: number, ubicacion: number) {
    const movimientos = await tx.movimientos_inventario.findMany({
      where: { lote_inventario_id: lote },
      select: { cantidad: true, ubicacion_origen_id: true, ubicacion_destino_id: true },
    });
    return saldoFisicoUbicacion(movimientos, ubicacion);
  }
  private async viajeConVehiculo(tx: Tx, id: number) {
    const viaje = await tx.viajes_logistica.findUnique({ where: { id } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado.');
    const vehiculo = await tx.vehiculos_logistica.findUnique({ where: { id: viaje.vehiculo_id } });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado.');
    return { viaje, vehiculo };
  }

  async catalogos(u: Usuario) {
    this.validarPersonal(u);
    const [vehiculos, viajes, ordenes, ubicaciones] = await Promise.all([
      this.prisma.vehiculos_logistica.findMany({ orderBy: { id: 'desc' }, take: 200 }),
      this.prisma.viajes_logistica.findMany({ orderBy: { id: 'desc' }, take: 100 }),
      this.prisma.crm_ordenes_venta.findMany({
        where: { estado: 'CONFIRMADA' },
        select: {
          id: true, folio: true, persona_id: true, cantidad: true, unidad: true,
          cliente: { select: { nombre: true } }, producto: { select: { nombre_Producto: true } },
        },
        orderBy: { id: 'desc' }, take: 200,
      }),
      this.prisma.inventario_ubicaciones.findMany({ where: { activo: true }, orderBy: { id: 'asc' } }),
    ]);
    return { success: true, vehiculos, viajes, ordenes, ubicaciones };
  }

  async contenedores(u: Usuario, loteId?: string) {
    this.validarPersonal(u);
    const id = loteId ? idSeguro(loteId, 'Lote') : undefined;
    const data = await this.prisma.inventario_contenedores.findMany({
      where: id ? { lote_inventario_id: id } : {},
      orderBy: [{ lote_inventario_id: 'desc' }, { codigo: 'asc' }], take: 1000,
    });
    return { success: true, data };
  }

  /** Conciliación física inicial: no genera movimientos de entrada ni reescribe el inventario. */
  async conciliarContenedores(b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    const loteId = idSeguro(b.lote_inventario_id, 'Lote');
    const ubicacionId = idSeguro(b.ubicacion_id, 'Ubicación');
    const motivo = textoSeguro(b.motivo, 'Motivo y origen de conciliación', 4000);
    if (motivo.length < 12) throw new BadRequestException('Documenta la revisión física con al menos 12 caracteres.');
    if (!Array.isArray(b.contenedores) || !b.contenedores.length || b.contenedores.length > 500)
      throw new BadRequestException('Registra entre 1 y 500 contenedores verificados.');
    const datos = b.contenedores.map((entrada: any) => ({
      codigo: textoSeguro(entrada?.codigo, 'Código', 100).toUpperCase(),
      kg: decimalPositivo(entrada?.peso_kg, 'Peso de contenedor'),
    }));
    if (new Set(datos.map(x => x.codigo)).size !== datos.length)
      throw new BadRequestException('No puede haber códigos duplicados en la conciliación.');
    return this.prisma.$transaction(async tx => {
      await bloquearMaterial(tx, [loteId]);
      const lote = await tx.lotes_inventario.findUnique({ where: { id: loteId } });
      if (!lote || lote.unidad !== 'Kilogramos') throw new BadRequestException('Lote inválido o incompatible con kilogramos.');
      const ubicacion = await tx.inventario_ubicaciones.findUnique({ where: { id: ubicacionId } });
      if (!ubicacion?.activo) throw new BadRequestException('Ubicación no disponible.');
      if (await tx.inventario_contenedores.count({ where: { lote_inventario_id: loteId } }))
        throw new ConflictException('El lote ya tiene contenedores identificados; no se permite sustituirlos por otra conciliación.');
      const saldo = await this.saldoEnUbicacion(tx, loteId, ubicacionId);
      const total = datos.reduce((t, x) => t.add(x.kg), D(0));
      if (!saldo.gt(0) || !total.eq(saldo))
        throw new ConflictException('La suma de pesos verificados debe coincidir exactamente con el saldo físico actual en esa ubicación: ' + saldo.toFixed(4) + ' kg.');
      for (const item of datos) {
        const c = await tx.inventario_contenedores.create({
          data: {
            lote_inventario_id: loteId, ubicacion_id: ubicacionId, codigo: item.codigo,
            peso_inicial_kg: item.kg, saldo_kg: item.kg, estado: 'VERIFICADO',
            verificado_en: new Date(), verificado_por: u.usuario,
          },
        });
        await tx.contenedor_movimientos.create({
          data: {
            contenedor_id: c.id, tipo: 'CONCILIACION', cantidad: item.kg, actor: u.usuario,
            observaciones: motivo,
          },
        });
      }
      return { success: true, lote_inventario_id: loteId, contenedores: datos.length, kg: total.toString() };
    }, { timeout: 30000 });
  }

  async vehiculoNuevo(b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    const tipo = tipoVehiculo(b.tipo);
    const placa = textoSeguro(b.placa, 'Placas', 30).toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9-]{4,30}$/.test(placa)) throw new BadRequestException('Formato de placas inválido.');
    const capacidadKg = decimalPositivo(b.capacidad_kg, 'Capacidad en kg');
    const creado = await this.prisma.vehiculos_logistica.create({
      data: {
        tipo, placa, capacidad_contenedores: CAPACIDADES_CONTENEDORES[tipo],
        capacidad_kg: capacidadKg,
        transportista: String(b.transportista ?? '').trim().slice(0, 150) || null,
      },
    });
    return { success: true, data: creado };
  }

  async viajeNuevo(b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    const vehiculoId = idSeguro(b.vehiculo_id, 'Vehículo');
    const vehiculo = await this.prisma.vehiculos_logistica.findUnique({ where: { id: vehiculoId } });
    if (!vehiculo?.activo) throw new BadRequestException('Vehículo inactivo o inexistente.');
    const operador = textoSeguro(b.operador, 'Operador', 150);
    const fecha = b.fecha_programada ? new Date(String(b.fecha_programada)) : null;
    if (fecha && !Number.isFinite(fecha.getTime())) throw new BadRequestException('Fecha de programación inválida.');
    const viaje = await this.prisma.viajes_logistica.create({
      data: {
        folio: 'VIA-' + randomUUID(), vehiculo_id: vehiculoId, operador,
        fecha_programada: fecha, creado_por: u.usuario,
        observaciones: String(b.observaciones ?? '').slice(0, 4000) || null,
      },
    });
    return { success: true, data: viaje };
  }

  async entregaNueva(b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    const ordenId = idSeguro(b.orden_venta_id, 'Orden de venta');
    const viajeId = idSeguro(b.viaje_id, 'Viaje');
    const destino = textoSeguro(b.destino, 'Destino', 1000);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM viajes_logistica WHERE id=$1 FOR UPDATE', viajeId);
      const { viaje } = await this.viajeConVehiculo(tx, viajeId);
      if (viaje.estado !== 'PROGRAMADO') throw new ConflictException('Solo puede añadirse una entrega a un viaje programado.');
      const ov = await tx.crm_ordenes_venta.findUnique({ where: { id: ordenId } });
      if (!ov || ov.estado !== 'CONFIRMADA') throw new BadRequestException('Solo puede entregarse una OV confirmada.');
      const entrega = await tx.entregas_logistica.create({
        data: {
          folio: 'ENT-' + randomUUID(), viaje_id: viajeId, orden_venta_id: ordenId,
          destino, estado_entrega: 'BORRADOR', creado_por: u.usuario,
          fecha_programada: viaje.fecha_programada,
        },
      });
      await this.registrarEvento(tx, 'ENTREGA_CREADA', u.usuario, entrega.id_Entrega, viajeId);
      return { success: true, data: entrega };
    });
  }

  async listar(u: Usuario) {
    const where: Prisma.entregas_logisticaWhereInput = u.area === 'cliente'
      ? { orden_venta: { persona_id: u.personaId } } : {};
    const entregas = await this.prisma.entregas_logistica.findMany({
      where,
      orderBy: { id_Entrega: 'desc' }, take: 300,
      include: {
        orden_venta: { select: { folio: true, persona_id: true, cantidad: true, unidad: true,
          cliente: { select: { nombre: true } } } },
        detalles: { include: { lote: { select: { folio: true, lote_produccion_id: true } } } },
      },
    });
    const viajeIds = [...new Set(entregas.flatMap(e => e.viaje_id == null ? [] : [e.viaje_id]))];
    const viajes = viajeIds.length ? await this.prisma.viajes_logistica.findMany({
      where: { id: { in: viajeIds } },
    }) : [];
    const vIds = [...new Set(viajes.map(x => x.vehiculo_id))];
    const vehiculos = vIds.length ? await this.prisma.vehiculos_logistica.findMany({
      where: { id: { in: vIds } }, select: {
        id: true, tipo: true, placa: true, capacidad_contenedores: true,
      },
    }) : [];
    const detallesIds = entregas.flatMap(e => e.detalles.map(d => d.id));
    const asignaciones = detallesIds.length ? await this.prisma.entrega_contenedores.findMany({
      where: { entrega_material_id: { in: detallesIds } },
    }) : [];
    return {
      success: true,
      data: entregas.map(e => ({
        ...e,
        viaje: viajes.find(v => v.id === e.viaje_id) ?? null,
        vehiculo: vehiculos.find(v => v.id === viajes.find(v => v.id === e.viaje_id)?.vehiculo_id) ?? null,
        detalles: e.detalles.map(d => ({
          ...d, contenedores: asignaciones.filter(a => a.entrega_material_id === d.id),
        })),
        // Nunca retornar bytea del comprobante en listados.
        comprobante_contenido: undefined,
      })),
    };
  }

  async obtenerComprobante(id: number, u: Usuario) {
    const entrega = await this.prisma.entregas_logistica.findUnique({
      where: { id_Entrega: id },
      include: { orden_venta: { select: { persona_id: true } } },
    });
    if (!entrega || (u.area === 'cliente' && entrega.orden_venta.persona_id !== u.personaId))
      throw new NotFoundException('Comprobante no encontrado.');
    if (!entrega.comprobante_contenido?.length)
      throw new NotFoundException('La entrega no tiene comprobante adjunto.');
    return {
      nombre: entrega.comprobante_nombre ?? 'acuse.pdf',
      mime: 'application/pdf',
      buffer: Buffer.from(entrega.comprobante_contenido),
    };
  }

  async prepararEntrega(id: number, b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    if (!Array.isArray(b.contenedor_ids) || !b.contenedor_ids.length || b.contenedor_ids.length > 22) {
      throw new BadRequestException('Selecciona entre 1 y 22 contenedores reales.');
    }
    const ids: number[] = b.contenedor_ids.map((v: unknown) => idSeguro(v, 'Contenedor'));
    if (new Set(ids).size !== ids.length) throw new BadRequestException('No repitas contenedores.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id_Entrega" FROM entregas_logistica WHERE "id_Entrega"=$1 FOR UPDATE', id);
      const entrega = await tx.entregas_logistica.findUnique({ where: { id_Entrega: id } });
      if (!entrega || entrega.estado_entrega !== 'BORRADOR' || entrega.viaje_id == null) {
        throw new BadRequestException('Entrega no disponible para preparación.');
      }
      const { viaje, vehiculo } = await this.viajeConVehiculo(tx, entrega.viaje_id);
      await tx.$queryRawUnsafe('SELECT id FROM viajes_logistica WHERE id=$1 FOR UPDATE', viaje.id);
      if (viaje.estado !== 'PROGRAMADO') throw new ConflictException('Viaje ya cargado o despachado.');
      if (await tx.entrega_materiales.count({ where: { entrega_id: id } }))
        throw new ConflictException('La entrega ya tiene carga asignada; cancela y crea otra para cambiarla.');
      const ov = await tx.crm_ordenes_venta.findUnique({ where: { id: entrega.orden_venta_id } });
      if (!ov || ov.estado !== 'CONFIRMADA' || ov.unidad !== 'Kilogramos') {
        throw new BadRequestException('Se requiere una OV confirmada en kilogramos.');
      }
      const contenedores = await tx.inventario_contenedores.findMany({ where: { id: { in: ids } } });
      if (contenedores.length !== ids.length) throw new NotFoundException('Uno o más contenedores no existen.');
      const lotesIds = [...new Set(contenedores.map(x => x.lote_inventario_id))].sort((a,b) => a-b);
      await bloquearMaterial(tx, lotesIds);
      for (const cid of [...ids].sort((a,b) => a-b)) {
        await tx.$queryRawUnsafe('SELECT id FROM inventario_contenedores WHERE id=$1 FOR UPDATE', cid);
      }
      const recargados = await tx.inventario_contenedores.findMany({ where: { id: { in: ids } } });
      if (recargados.some(x => x.estado !== 'VERIFICADO' || x.saldo_kg.lte(0))) {
        throw new ConflictException('Seleccionaste un contenedor sin saldo o pendiente de verificación física.');
      }
      const asignacionesAnteriores = await tx.entrega_contenedores.findMany({
        where: { contenedor_id: { in: ids } },
        select: { entrega_material_id: true },
      });
      if (asignacionesAnteriores.length) {
        const anteriores = await tx.entrega_materiales.findMany({
          where: { id: { in: asignacionesAnteriores.map(x => x.entrega_material_id) } },
          select: { entrega_id: true },
        });
        const activas = await tx.entregas_logistica.count({
          where: {
            id_Entrega: { in: anteriores.map(x => x.entrega_id) },
            estado_entrega: { in: ['BORRADOR', 'DESPACHADA', 'ENTREGADA'] },
          },
        });
        if (activas) throw new ConflictException('Al menos un contenedor ya pertenece a otra entrega activa.');
      }
      const lotes = await tx.lotes_inventario.findMany({
        where: { id: { in: lotesIds } },
        include: { lote_produccion: { select: { id_Lote_Produccion: true, orden_Produccion_id: true } } },
      });
      const lotePorId = new Map(lotes.map(l => [l.id, l]));
      const asignacionesOV = await tx.crm_ordenes_venta_produccion.findMany({
        where: { orden_venta_id: ov.id },
        select: { orden_produccion_id: true, cantidad_producto_terminado: true },
      });
      const autorizadoOP = new Map(asignacionesOV.map(x => [x.orden_produccion_id, x.cantidad_producto_terminado]));
      const porOP = new Map<number, Prisma.Decimal>();
      const porLoteUbicacion = new Map<string, { lote: number; ubicacion: number; kg: Prisma.Decimal }>();
      let nuevoTotal = D(0);
      for (const item of recargados) {
        const lote = lotePorId.get(item.lote_inventario_id);
        if (!lote || lote.producto_id !== ov.producto_id ||
            lote.origen !== 'PRODUCCION' || !['REGENERADO','TERMINADO'].includes(lote.condicion) ||
            lote.unidad !== 'Kilogramos' ||
            (ov.tipo_venta === 'SERVICIO_REGENERACION'
              ? lote.propietario_id !== ov.persona_id || lote.propiedad !== 'DE_CLIENTE'
              : lote.propiedad !== 'PROPIO') ||
            !lote.lote_produccion?.orden_Produccion_id) {
          throw new ConflictException('Contenedor con lote, producto, unidad o propietario incompatibles con la OV.');
        }
        if (!autorizadoOP.has(lote.lote_produccion.orden_Produccion_id)) {
          throw new ConflictException('El lote pertenece a una OP sin producto terminado asignado a esta OV.');
        }
        if (!(await this.expedienteValido(tx, lote.lote_produccion.id_Lote_Produccion))) {
          throw new ConflictException('El lote no tiene expediente de Calidad aprobado o conciliación histórica validada con evidencia.');
        }
        const opId = lote.lote_produccion.orden_Produccion_id;
        porOP.set(opId, (porOP.get(opId) ?? D(0)).add(item.saldo_kg));
        const llave = item.lote_inventario_id + ':' + item.ubicacion_id;
        const anterior = porLoteUbicacion.get(llave);
        porLoteUbicacion.set(llave, {
          lote: item.lote_inventario_id, ubicacion: item.ubicacion_id,
          kg: (anterior?.kg ?? D(0)).add(item.saldo_kg),
        });
        nuevoTotal = nuevoTotal.add(item.saldo_kg);
      }
      for (const grupo of porLoteUbicacion.values()) {
        const stock = await this.saldoEnUbicacion(tx, grupo.lote, grupo.ubicacion);
        if (stock.lt(grupo.kg)) {
          throw new ConflictException('Los contenedores no concilian con el saldo físico del lote/ubicación.');
        }
      }
      const existentes = await tx.entregas_logistica.findMany({
        where: { orden_venta_id: ov.id, estado_entrega: { not: 'CANCELADA' } },
        include: { detalles: { select: { cantidad: true, lote_inventario_id: true } } },
      });
      let comprometidoOV = D(0);
      const comprometidoOP = new Map<number, Prisma.Decimal>();
      const listaLotesPrevios = [...new Set(existentes.flatMap(e => e.detalles.map(d => d.lote_inventario_id)))];
      const anterioresLotes = listaLotesPrevios.length
        ? await tx.lotes_inventario.findMany({
          where: { id: { in: listaLotesPrevios } },
          select: { id: true, lote_produccion: { select: { orden_Produccion_id: true } } },
        }) : [];
      const prevPorLote = new Map(anterioresLotes.map(l => [l.id, l.lote_produccion?.orden_Produccion_id ?? null]));
      for (const anterior of existentes) for (const detalle of anterior.detalles) {
        comprometidoOV = comprometidoOV.add(detalle.cantidad);
        const opId = prevPorLote.get(detalle.lote_inventario_id);
        if (opId != null) comprometidoOP.set(opId, (comprometidoOP.get(opId) ?? D(0)).add(detalle.cantidad));
      }
      if (comprometidoOV.add(nuevoTotal).gt(ov.cantidad)) {
        throw new ConflictException('La OV no tiene saldo de entrega suficiente para esta carga.');
      }
      for (const [opId, kg] of porOP) {
        if (kg.add(comprometidoOP.get(opId) ?? D(0)).gt(autorizadoOP.get(opId)!)) {
          throw new ConflictException('La cantidad excede lo asignado de la OP a esta OV.');
        }
      }
      const enviosViaje = await tx.entregas_logistica.findMany({
        where: { viaje_id: viaje.id, estado_entrega: 'BORRADOR' },
        select: { detalles: { select: { id: true, cantidad: true } } },
      });
      const detallesViaje = enviosViaje.flatMap(e => e.detalles);
      const cantidadViaje = detallesViaje.reduce((s, x) => s.add(x.cantidad), D(0));
      const idsDetalle = detallesViaje.map(x => x.id);
      const contenedoresViaje = idsDetalle.length
        ? await tx.entrega_contenedores.count({ where: { entrega_material_id: { in: idsDetalle } } }) : 0;
      compararCarga(contenedoresViaje + ids.length, cantidadViaje.add(nuevoTotal),
        tipoVehiculo(vehiculo.tipo), vehiculo.capacidad_kg);

      for (const grupo of porLoteUbicacion.values()) {
        const detalle = await tx.entrega_materiales.create({
          data: {
            entrega_id: entrega.id_Entrega, lote_inventario_id: grupo.lote,
            ubicacion_id: grupo.ubicacion, cantidad: grupo.kg,
          },
        });
        const idsGrupo = recargados.filter(x =>
          x.lote_inventario_id === grupo.lote && x.ubicacion_id === grupo.ubicacion);
        await tx.entrega_contenedores.createMany({
          data: idsGrupo.map(x => ({
            entrega_material_id: detalle.id, contenedor_id: x.id, cantidad_kg: x.saldo_kg,
          })),
        });
      }
      await this.registrarEvento(tx, 'ENTREGA_PREPARADA', u.usuario, id, viaje.id,
        { contenedor_ids: ids, kg: nuevoTotal.toFixed(4) });
      return { success: true, entrega_id: id, contenedores: ids.length, kg: nuevoTotal.toFixed(4) };
    }, { timeout: 30000 });
  }

  async confirmarCarga(id: number, b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    if (b.confirmo_carga !== true) throw new BadRequestException('Confirma explícitamente el cotejo físico de la carga.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM viajes_logistica WHERE id=$1 FOR UPDATE', id);
      const { viaje, vehiculo } = await this.viajeConVehiculo(tx, id);
      if (viaje.estado === 'CARGADO') return { success: true, repetido: true };
      if (viaje.estado !== 'PROGRAMADO') throw new ConflictException('Viaje no disponible para carga.');
      const entregas = await tx.entregas_logistica.findMany({
        where: { viaje_id: id, estado_entrega: 'BORRADOR' }, include: { detalles: true },
      });
      if (!entregas.length || entregas.some(e => !e.detalles.length)) {
        throw new ConflictException('Todas las entregas del viaje deben estar preparadas.');
      }
      const detalles = entregas.flatMap(e => e.detalles);
      const asignados = await tx.entrega_contenedores.findMany({
        where: { entrega_material_id: { in: detalles.map(d => d.id) } },
      });
      if (!asignados.length) throw new ConflictException('No se identificaron contenedores cargados.');
      compararCarga(asignados.length, detalles.reduce((s, x) => s.add(x.cantidad), D(0)),
        tipoVehiculo(vehiculo.tipo), vehiculo.capacidad_kg);
      const fisicos = await tx.inventario_contenedores.findMany({
        where: { id: { in: asignados.map(a => a.contenedor_id) } },
        select: { id: true, codigo: true, estado: true, saldo_kg: true },
      });
      const codigosDeclarados = Array.isArray(b.codigos_verificados)
        ? b.codigos_verificados.map(x => String(x ?? '').trim().toUpperCase()) : [];
      const codigosEsperados = fisicos.map(x => x.codigo.toUpperCase());
      if (new Set(codigosDeclarados).size !== codigosEsperados.length ||
          codigosEsperados.some(x => !codigosDeclarados.includes(x))) {
        throw new ConflictException('Verifica físicamente todos los códigos de contenedores antes de autorizar la carga.');
      }
      if (fisicos.some(x => x.estado !== 'VERIFICADO' || x.saldo_kg.lte(0)))
        throw new ConflictException('Un contenedor fue bloqueado o consumido antes de la carga.');
      await tx.viajes_logistica.update({ where: { id }, data: { estado: 'CARGADO' } });
      await this.registrarEvento(tx, 'CARGA_CONFIRMADA', u.usuario, undefined, id,
        { contenedores: codigosEsperados.length, vehiculo: vehiculo.placa });
      return { success: true, viaje_id: id, estado: 'CARGADO' };
    });
  }

  async despacharViaje(id: number, u: Usuario) {
    this.validarPersonal(u);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM viajes_logistica WHERE id=$1 FOR UPDATE', id);
      const { viaje, vehiculo } = await this.viajeConVehiculo(tx, id);
      if (viaje.estado === 'DESPACHADO') return { success: true, repetido: true };
      if (viaje.estado !== 'CARGADO') throw new ConflictException('Confirma primero la carga física.');
      const entregas = await tx.entregas_logistica.findMany({
        where: { viaje_id: id }, include: { detalles: true },
      });
      if (!entregas.length || entregas.some(e => e.estado_entrega !== 'BORRADOR' || !e.detalles.length)) {
        throw new ConflictException('El viaje contiene entregas no preparadas o ya despachadas.');
      }
      const detalles = entregas.flatMap(e => e.detalles);
      const asignados = await tx.entrega_contenedores.findMany({
        where: { entrega_material_id: { in: detalles.map(d => d.id) } },
      });
      const ids = [...new Set(asignados.map(a => a.contenedor_id))].sort((a,b) => a-b);
      if (!ids.length || ids.length !== asignados.length) throw new ConflictException('Contenedores duplicados o sin registro.');
      const lotes = [...new Set(detalles.map(d => d.lote_inventario_id))].sort((a,b) => a-b);
      await bloquearMaterial(tx, lotes);
      for (const cid of ids)
        await tx.$queryRawUnsafe('SELECT id FROM inventario_contenedores WHERE id=$1 FOR UPDATE', cid);
      const contenedores = await tx.inventario_contenedores.findMany({
        where: { id: { in: ids } },
      });
      const porContenedor = new Map(contenedores.map(x => [x.id,x]));
      compararCarga(ids.length, detalles.reduce((s,x)=>s.add(x.cantidad),D(0)),
        tipoVehiculo(vehiculo.tipo),vehiculo.capacidad_kg);
      const certificables = await tx.lotes_inventario.findMany({
        where: { id: { in: lotes } },
        select: { id: true, lote_produccion_id: true, condicion: true, origen: true },
      });
      for (const l of certificables) {
        if (l.origen !== 'PRODUCCION' || !['TERMINADO', 'REGENERADO'].includes(l.condicion) ||
            !l.lote_produccion_id || !(await this.expedienteValido(tx,l.lote_produccion_id))) {
          throw new ConflictException('La liberación de un lote cambió; despacho bloqueado.');
        }
      }
      for (const detalle of detalles) {
        const lineas = asignados.filter(a => a.entrega_material_id === detalle.id);
        const total = lineas.reduce((s,x) => s.add(x.cantidad_kg), D(0));
        if (!lineas.length || !total.eq(detalle.cantidad)) {
          throw new ConflictException('No cuadran los contenedores con el detalle de la entrega.');
        }
        const saldo = await this.saldoEnUbicacion(tx,detalle.lote_inventario_id,detalle.ubicacion_id);
        if (saldo.lt(detalle.cantidad)) {
          throw new ConflictException('Existencias insuficientes al momento del despacho.');
        }
        for (const linea of lineas) {
          const cont = porContenedor.get(linea.contenedor_id);
          if (!cont || cont.lote_inventario_id !== detalle.lote_inventario_id ||
              cont.ubicacion_id !== detalle.ubicacion_id ||
              cont.estado !== 'VERIFICADO' || !cont.saldo_kg.eq(linea.cantidad_kg)) {
            throw new ConflictException('Un contenedor cambió de ubicación, estado o cantidad. Revisa la carga.');
          }
        }
      }
      const ahora = new Date();
      for (const entrega of entregas) {
        for (const detalle of entrega.detalles) {
          const mov = await tx.movimientos_inventario.create({
            data: {
              folio_Movi: 'ENT-' + randomUUID(), clave_evento: 'entrega:' + detalle.id,
              tipo: 'SALIDA_ENTREGA', lote_inventario_id: detalle.lote_inventario_id,
              ubicacion_origen_id: detalle.ubicacion_id, entrega_material_id: detalle.id,
              cantidad: detalle.cantidad, realizado_por: u.usuario,
            },
          });
          for (const linea of asignados.filter(a => a.entrega_material_id === detalle.id)) {
            const cont = porContenedor.get(linea.contenedor_id)!;
            const restante = cont.saldo_kg.sub(linea.cantidad_kg);
            await tx.inventario_contenedores.update({
              where: { id: cont.id }, data: { saldo_kg: restante, estado: restante.isZero() ? 'AGOTADO' : cont.estado },
            });
            await tx.contenedor_movimientos.create({
              data: {
                contenedor_id: cont.id, movimiento_inventario_id: mov.id_Movi_Invent,
                tipo: 'DESPACHO', cantidad: linea.cantidad_kg, actor: u.usuario,
              },
            });
          }
        }
        await tx.entregas_logistica.update({
          where: { id_Entrega: entrega.id_Entrega },
          data: { estado_entrega: 'DESPACHADA', fecha_Salida_Transporte: ahora },
        });
        await this.registrarEvento(tx, 'ENTREGA_DESPACHADA', u.usuario, entrega.id_Entrega, id);
      }
      await tx.viajes_logistica.update({
        where: { id }, data: { estado: 'DESPACHADO', fecha_salida: ahora },
      });
      return { success: true, viaje_id: id, entregas: entregas.length,
        contenedores: ids.length, estado: 'DESPACHADO' };
    }, { timeout: 30000 });
  }

  async confirmarRecepcion(
    id: number, body: Record<string, unknown>,
    comprobante: Express.Multer.File | undefined, u: Usuario,
  ) {
    if (!comprobante?.buffer?.length || comprobante.mimetype !== 'application/pdf' ||
        comprobante.buffer.subarray(0,5).toString() !== '%PDF-' ||
        comprobante.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Adjunta un comprobante de recepción PDF de hasta 10 MB.');
    }
    const recibidoPor = textoSeguro(body.recibido_por, 'Recibido por', 150);
    let lista: unknown = body.detalles;
    if (typeof lista === 'string') {
      try { lista = JSON.parse(lista); }
      catch { throw new BadRequestException('Detalle de cantidades recibidas inválido.'); }
    }
    if (!Array.isArray(lista) || !lista.length) throw new BadRequestException('Captura las cantidades recibidas por lote.');
    const cantidades = lista.map((x: any) => ({
      id: idSeguro(x?.id, 'Detalle'), kg: decimalNoNegativo(x?.cantidad_recibida, 'Cantidad recibida'),
    }));
    if (new Set(cantidades.map(x => x.id)).size !== cantidades.length)
      throw new BadRequestException('No repitas detalles.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id_Entrega" FROM entregas_logistica WHERE "id_Entrega"=$1 FOR UPDATE', id);
      const entrega = await tx.entregas_logistica.findUnique({ where: { id_Entrega: id } });
      if (!entrega) throw new NotFoundException('Entrega no encontrada.');
      const ov = await tx.crm_ordenes_venta.findUnique({ where: { id: entrega.orden_venta_id } });
      if (u.area === 'cliente' && ov?.persona_id !== u.personaId)
        throw new NotFoundException('Entrega no encontrada para este cliente.');
      if (entrega.estado_entrega === 'ENTREGADA') return { success: true, repetido: true };
      if (entrega.estado_entrega !== 'DESPACHADA') throw new ConflictException('Solo se confirma material que ya fue despachado.');
      const detalles = await tx.entrega_materiales.findMany({ where: { entrega_id: id } });
      if (detalles.length !== cantidades.length ||
          detalles.some(d => !cantidades.some(c => c.id === d.id))) {
        throw new BadRequestException('Registra todas las cantidades recibidas, incluso cuando sean cero.');
      }
      let diferenciaTotal = D(0);
      for (const d of detalles) {
        const recibido = cantidades.find(x => x.id === d.id)!;
        const { diferencia } = verificarRecepcion(d.cantidad, recibido.kg);
        diferenciaTotal = diferenciaTotal.add(diferencia);
        await tx.entrega_materiales.update({
          where: { id: d.id },
          data: { cantidad_recibida: recibido.kg },
        });
      }
      const ahora = new Date();
      await tx.entregas_logistica.update({
        where: { id_Entrega: id },
        data: {
          estado_entrega: 'ENTREGADA', fecha_Entrega_Cliente: ahora,
          recibido_por: recibidoPor,
          comprobante_nombre: (comprobante.originalname || 'acuse.pdf').replace(/[\\/]/g,'_').slice(0,255),
          comprobante_mime: 'application/pdf',
          comprobante_contenido: new Uint8Array(comprobante.buffer),
          ...(diferenciaTotal.gt(0) ? {
            observaciones: 'INCIDENCIA: ' + diferenciaTotal.toFixed(4) +
              ' kg despachados no acreditados como recibidos. ' + String(body.observaciones ?? '').slice(0, 3000),
          } : { observaciones: String(body.observaciones ?? '').slice(0, 4000) || entrega.observaciones }),
        },
      });
      await this.registrarEvento(tx, 'RECEPCION_CONFIRMADA', u.usuario, id, entrega.viaje_id ?? undefined,
        { recibido_por: recibidoPor, diferencia_kg: diferenciaTotal.toFixed(4) });
      if (entrega.viaje_id != null) {
        await tx.$queryRawUnsafe('SELECT id FROM viajes_logistica WHERE id=$1 FOR UPDATE', entrega.viaje_id);
        const otras = await tx.entregas_logistica.findMany({
          where: { viaje_id: entrega.viaje_id, id_Entrega: { not: id } },
          select: { estado_entrega: true },
        });
        if (otras.every(e => e.estado_entrega === 'ENTREGADA')) {
          await tx.viajes_logistica.update({
            where: { id: entrega.viaje_id },
            data: { estado: 'ENTREGADO', fecha_cierre: ahora },
          });
        }
      }
      return {
        success: true, entrega_id: id, estado: 'ENTREGADA',
        diferencia_kg: diferenciaTotal.toFixed(4),
        requiere_aclaracion: diferenciaTotal.gt(0),
      };
    }, { timeout: 30000 });
  }

  async cancelarEntrega(id: number, b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    const motivo = textoSeguro(b.motivo, 'Motivo de cancelación', 4000);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id_Entrega" FROM entregas_logistica WHERE "id_Entrega"=$1 FOR UPDATE', id);
      const entrega = await tx.entregas_logistica.findUnique({ where: { id_Entrega: id } });
      if (!entrega) throw new NotFoundException('Entrega no encontrada.');
      if (entrega.estado_entrega === 'CANCELADA') return { success: true, repetido: true };
      if (entrega.estado_entrega !== 'BORRADOR')
        throw new ConflictException('No es posible cancelar salidas físicas. Registra una devolución verificada.');
      if (entrega.viaje_id != null) {
        const viaje = await tx.viajes_logistica.findUnique({ where: { id: entrega.viaje_id } });
        if (!viaje || viaje.estado !== 'PROGRAMADO') {
          throw new ConflictException('La carga ya fue confirmada, no se permite cancelar una entrega aislada.');
        }
      }
      await tx.entregas_logistica.update({
        where: { id_Entrega: id }, data: { estado_entrega: 'CANCELADA', motivo_cancelacion: motivo },
      });
      await this.registrarEvento(tx, 'ENTREGA_CANCELADA', u.usuario, id, entrega.viaje_id ?? undefined, { motivo });
      return { success: true, entrega_id: id, estado: 'CANCELADA' };
    });
  }

  async cancelarViaje(id: number, b: Record<string, unknown>, u: Usuario) {
    this.validarPersonal(u);
    const motivo = textoSeguro(b.motivo, 'Motivo', 4000);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT id FROM viajes_logistica WHERE id=$1 FOR UPDATE', id);
      const viaje = await tx.viajes_logistica.findUnique({ where: { id } });
      if (!viaje) throw new NotFoundException('Viaje no encontrado.');
      if (viaje.estado === 'CANCELADO') return { success: true, repetido: true };
      if (viaje.estado !== 'PROGRAMADO' && viaje.estado !== 'CARGADO')
        throw new ConflictException('No se puede cancelar un vehículo que ya salió de planta.');
      await tx.entregas_logistica.updateMany({
        where: { viaje_id: id, estado_entrega: 'BORRADOR' },
        data: { estado_entrega: 'CANCELADA', motivo_cancelacion: motivo },
      });
      await tx.viajes_logistica.update({
        where: { id }, data: { estado: 'CANCELADO', observaciones: motivo },
      });
      await this.registrarEvento(tx, 'VIAJE_CANCELADO', u.usuario, undefined, id, { motivo });
      return { success: true, viaje_id: id, estado: 'CANCELADO' };
    });
  }

  async conciliacionComercial(u: Usuario) {
    this.validarPersonal(u);
    const ordenes = await this.prisma.crm_ordenes_venta.findMany({
      where: { estado: 'CONFIRMADA' }, orderBy: { id: 'desc' }, take: 200,
      include: {
        cliente: { select: { nombre: true } },
        produccion_asignada: { select: { cantidad_producto_terminado: true } },
        entregas: {
          where: { estado_entrega: { not: 'CANCELADA' } },
          include: { detalles: { select: { cantidad: true, cantidad_recibida: true } } },
        },
        facturas: { select: { id: true, estado: true, total: true } },
        pagos: { select: { id: true, estado: true, importe: true } },
      },
    });
    return {
      success: true, data: ordenes.map(o => {
        const asignado = o.produccion_asignada.reduce((s,x)=>s.add(x.cantidad_producto_terminado),D(0));
        const entregado = o.entregas.filter(e=>e.estado_entrega==='ENTREGADA')
          .flatMap(e=>e.detalles).reduce((s,x)=>s.add(x.cantidad_recibida??0),D(0));
        const despachado = o.entregas.filter(e=>['DESPACHADA','ENTREGADA'].includes(e.estado_entrega))
          .flatMap(e=>e.detalles).reduce((s,x)=>s.add(x.cantidad),D(0));
        const discrepancia = o.entregas.filter(e=>e.estado_entrega==='ENTREGADA')
          .flatMap(e=>e.detalles).reduce((s,x)=>s.add(x.cantidad.sub(x.cantidad_recibida??0)),D(0));
        return {
          ov_id: o.id, folio: o.folio, cliente: o.cliente.nombre,
          unidad: o.unidad, cantidad_solicitada: o.cantidad.toString(),
          cantidad_asignada: asignado.toString(), cantidad_despachada: despachado.toString(),
          cantidad_recibida: entregado.toString(),
          pendiente_entrega: Prisma.Decimal.max(o.cantidad.sub(entregado),D(0)).toString(),
          discrepancia_kg: discrepancia.toString(),
          entregas: o.entregas.length,
          facturas_registradas: o.facturas.filter(f=>f.estado==='REGISTRADA').length,
          pagos_confirmados: o.pagos.filter(p=>p.estado==='CONFIRMADO').length,
          cerrada_fisicamente: o.cantidad.gt(0) && entregado.gte(o.cantidad) && discrepancia.isZero(),
          nota: 'Una factura fiscal externa no se emite desde este indicador; refleja solamente los registros existentes.',
        };
      }),
    };
  }

}
