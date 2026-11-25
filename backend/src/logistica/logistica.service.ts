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

  // CONTINUA_LOGISTICA
}
