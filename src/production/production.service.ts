import {
  aptitudMaterial,
  especificacionesValidas,
} from '../inventario/especificaciones.logic';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Usuario } from '../auth/auth.service';
import { texto, idValido } from '../investigacion/id.logic';
import { decimalCrm } from '../ventas/crm.workflow';
import {
  consumido,
  bloquearMaterial,
  crearOrdenProduccion,
  existencias,
} from '../inventario/inventario.logic';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { EventsGateway } from '../events.gateway';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  equipos_tanques_tipo,
  equipos_tanques_estatus_proceso,
  lotes_produccion_estado_Calida,
  muestras_estado_Muestra,
  muestras_etapa_Muestra,
} from '@prisma/client'; // <-- 1. Importar el Enum de Prisma

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiempos: TrazabilidadService,
    private readonly eventos: EventsGateway,
  ) {}

  async obtenerTodasLasOrdenesGrafito() {
    const result = await this.prisma.ordenes_produccion.findMany({
      where: { linea_Produccion: { equals: 'GRAFITO', mode: 'insensitive' } },
      include: {
        propietario: { select: { nombre: true } },
        productos_materiales: true,
        responsable: { select: { nombre: true } },
        crm_ordenes_venta: {
          include: { cliente: { select: { nombre: true } } },
        },
        reservas_material: {
          include: {
            lote: { include: { producto: true } },
            ubicacion: true,
            movimientos: { include: { reversion: true } },
          },
        },
        lotes_produccion: {
          include: {
            movimientos: { include: { reversion: true } },
            inventario_obtenido: true,
          },
          orderBy: { id_Lote_Produccion: 'asc' },
        },
      },
      orderBy: { creado_en: 'desc' },
    });
    const ids = result.flatMap((o) =>
      o.lotes_produccion.map((l) => l.id_Lote_Produccion),
    );
    const bitacora = await this.prisma.proceso_eventos.findMany({
      where: { lote_id: { in: ids } },
      orderBy: { id: 'desc' },
      take: 500,
    });
    return {
      success: true,
      result: result.map((o) => ({
        ...o,
        reservas_material: o.reservas_material.map((r) => ({
          ...r,
          pendiente: r.cantidad.sub(consumido(r.movimientos)),
        })),
        lotes_produccion: o.lotes_produccion.map((l) => ({
          ...l,
          cantidad_consumida: consumido(l.movimientos),
          cantidad_producida: l.movimientos
            .filter((m) => m.tipo === 'ENTRADA_PRODUCCION')
            .reduce(
              (a, m) => a.add(m.cantidad).sub(m.reversion?.cantidad ?? 0),
              new Prisma.Decimal(0),
            ),
        })),
      })),
      bitacora,
    };
  }

  async tanquesAreaProduccion(tipo: string) {
    try {
      const tipoNormalizado = String(tipo ?? '')
        .trim()
        .toUpperCase();
      if (
        !Object.values(equipos_tanques_tipo).includes(
          tipoNormalizado as equipos_tanques_tipo,
        )
      ) {
        throw new BadRequestException('Tipo de tanque inválido');
      }
      const tanques = await this.prisma.equipos_tanques.findMany({
        where: { tipo: tipoNormalizado as equipos_tanques_tipo },
        select: {
          id_Equipos_Tanques: true,
          codigo_Equipo: true,
          nombre_Equipo: true,
          status: true,
          estatus_proceso: true,
          capacidad: true,
          unidad_capacidad: true,
        },
        orderBy: { id_Equipos_Tanques: 'asc' },
      });

      return { success: true, result: tanques };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async actualizarTanque({
    idLoteProduccion,
    tanqueId,
  }: {
    idLoteProduccion: number;
    tanqueId: number | null;
  }) {
    const id = this.tiempos.id(idLoteProduccion);
    const destino = tanqueId == null ? null : this.tiempos.id(tanqueId);
    await this.prisma.$transaction(async (tx) => {
      // Orden de bloqueo consistente con las transiciones de tanque.
      await tx.$queryRaw`SELECT "id_Equipos_Tanques" FROM equipos_tanques ORDER BY "id_Equipos_Tanques" FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: id },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      if (lote.tanque_id === destino) return;
      if (lote.estado !== 'EN_PROCESO')
        throw new BadRequestException(
          'Solo se pueden trasladar lotes en proceso',
        );
      if (!destino)
        throw new BadRequestException(
          'Registra la descarga y su cantidad obtenida para vaciar el tanque',
        );
      if (destino) {
        const tanque = await tx.equipos_tanques.findUnique({
          where: { id_Equipos_Tanques: destino },
        });
        if (!tanque || tanque.status !== 'OPERATIVO')
          throw new BadRequestException('Tanque no disponible');
        const op = await tx.ordenes_produccion.findUniqueOrThrow({
          where: { id_Orden_Produc: Number(lote.orden_Produccion_id) },
        });
        if (op.linea_Produccion?.toUpperCase() !== tanque.tipo)
          throw new BadRequestException('Tanque de otra línea de producción');
        const ms = await tx.movimientos_inventario.findMany({
          where: { lote_produccion_id: id },
          include: { lote: true, reversion: true },
        });
        if (
          ms.some(
            (m) =>
              m.tipo === 'SALIDA_CONSUMO' &&
              m.lote.unidad !== tanque.unidad_capacidad,
          ) ||
          consumido(ms).gt(tanque.capacidad)
        )
          throw new BadRequestException(
            'Unidad o capacidad de tanque incompatible',
          );
        if (
          await tx.lotes_produccion.findFirst({
            where: { tanque_id: destino, id_Lote_Produccion: { not: id } },
          })
        )
          throw new BadRequestException('El tanque ya tiene otro lote');
      }
      if (lote.tanque_id) {
        await this.tiempos.transicion(
          tx,
          {
            entidad: 'TANQUE',
            entidad_id: lote.tanque_id,
            lote_id: id,
            tanque_id: lote.tanque_id,
          },
          null,
        );
        await tx.equipos_tanques.update({
          where: { id_Equipos_Tanques: lote.tanque_id },
          data: { estatus_proceso: 'VACIO' },
        });
      }
      await tx.lotes_produccion.update({
        where: { id_Lote_Produccion: id },
        data: { tanque_id: destino },
      });
      if (destino) {
        await tx.equipos_tanques.update({
          where: { id_Equipos_Tanques: destino },
          data: { estatus_proceso: 'CARGANDO_TANQUE' },
        });
        await this.tiempos.transicion(
          tx,
          {
            entidad: 'TANQUE',
            entidad_id: destino,
            lote_id: id,
            tanque_id: destino,
          },
          'CARGANDO_TANQUE',
          true,
        );
      }
      const ctx = {
        entidad: 'TANQUE' as const,
        entidad_id: destino ?? lote.tanque_id!,
        lote_id: id,
        tanque_id: destino ?? lote.tanque_id,
      };
      const ultimo = await this.tiempos.ultimo(tx, ctx);
      await this.tiempos.evento(
        tx,
        ctx,
        ultimo?.ciclo ?? 1,
        'ASIGNACION_LOTE',
        { origen: lote.tanque_id, destino },
      );
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion: id });
    return { idLoteProduccion: id, tanqueId: destino };
  }

  async actualizarEstatusCalidad({
    idLoteProduccion,
  }: {
    idLoteProduccion: number;
    estadoCalidad: 'LIBERADO';
  }) {
    const id = this.tiempos.id(idLoteProduccion);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion" = ${id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: id },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      if (lote.estado_Calida === 'FUERA_DE_ESPECIFICACION')
        throw new BadRequestException(
          'F.E. descargado requiere una nueva OP de reproceso',
        );
      await tx.$queryRaw`SELECT id FROM lotes_inventario WHERE lote_produccion_id=${id} ORDER BY id FOR UPDATE`;
      const ultima = await tx.muestras.findFirst({
        where: { lote_id: id, area_Muestra: 'CALIDAD' },
        orderBy: { id_Muestra: 'desc' },
      });
      if (!ultima || ultima.estado_Muestra !== 'APROBADO')
        throw new BadRequestException(
          'La última muestra debe estar aprobada por Calidad',
        );
      if (lote.estado_Calida !== 'LIBERADO' && lote.tanque_id) {
        const ctx = {
          entidad: 'TANQUE' as const,
          entidad_id: lote.tanque_id,
          tanque_id: lote.tanque_id,
          lote_id: id,
        };
        const ultimo = await this.tiempos.ultimo(tx, ctx);
        await this.tiempos.evento(
          tx,
          ctx,
          ultimo?.ciclo ?? 1,
          'LIBERACION_LOTE',
          { anterior: lote.estado_Calida },
        );
      }
      return tx.lotes_produccion.update({
        where: { id_Lote_Produccion: id },
        data: { estado_Calida: 'LIBERADO' },
      });
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion });
    return result;
  }

  async agregarRegistroBitacora({
    idLoteProduccion,
    registro,
  }: {
    idLoteProduccion: number;
    registro: any;
  }) {
    const id = this.tiempos.id(idLoteProduccion);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion" = ${id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: id },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      if (
        !registro ||
        typeof registro.observaciones !== 'string' ||
        !registro.observaciones.trim()
      )
        throw new BadRequestException('Escribe una observación');
      await tx.proceso_eventos.create({
        data: {
          entidad: 'LOTE',
          entidad_id: id,
          lote_id: id,
          tanque_id: lote.tanque_id,
          ciclo: 1,
          accion: 'NOTA_BITACORA',
          fecha: new Date(),
          detalle: JSON.stringify({
            observaciones: texto(registro.observaciones, 4000),
          }),
        },
      });
      const bitacora = await tx.proceso_eventos.findMany({
        where: { lote_id: id },
        orderBy: { id: 'desc' },
      });
      return { id_Lote_Produccion: id, bitacora };
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', { idLoteProduccion: id });
    return result;
  }

  async actualizarEstatusTanque({
    tanqueId,
    estatus_proceso,
  }: {
    tanqueId: number;
    estatus_proceso: string;
    idVentaOrigen?: number;
  }) {
    const id = this.tiempos.id(tanqueId);
    const estado = String(estatus_proceso ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (
      !Object.values(equipos_tanques_estatus_proceso).includes(
        estado as equipos_tanques_estatus_proceso,
      )
    )
      throw new BadRequestException('Etapa de tanque inválida');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Equipos_Tanques" FROM equipos_tanques WHERE "id_Equipos_Tanques" = ${id} FOR UPDATE`;
      const tanque = await tx.equipos_tanques.findUnique({
        where: { id_Equipos_Tanques: id },
      });
      if (!tanque) throw new NotFoundException('Tanque no encontrado');
      const lote = await tx.lotes_produccion.findFirst({
        where: { tanque_id: id },
        include: {
          ordenes_produccion: {
            include: { crm_ordenes_venta: true, productos_materiales: true },
          },
        },
      });
      if (lote)
        await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion"=${lote.id_Lote_Produccion} FOR UPDATE`;
      if (estado === 'LIBERADO_CALIDAD' && lote?.estado_Calida !== 'LIBERADO')
        throw new BadRequestException('Calidad debe liberar el lote');
      if (estado !== 'VACIO' && !lote)
        throw new BadRequestException('Asigna un lote al tanque primero');
      if (estado === 'VACIO' && lote)
        throw new BadRequestException(
          'Usa Vaciar para retirar el lote del tanque',
        );
      if (tanque.estatus_proceso === estado)
        return { muestraId: null, cambio: false };
      const ctx = {
        entidad: 'TANQUE' as const,
        entidad_id: id,
        tanque_id: id,
        lote_id: lote?.id_Lote_Produccion,
      };
      const tramo = await this.tiempos.transicion(
        tx,
        ctx,
        estado === 'VACIO' ? null : estado,
      );
      await this.tiempos.evento(tx, ctx, tramo?.ciclo ?? 1, 'CAMBIO_PROCESO', {
        anterior: tanque.estatus_proceso,
        nuevo: estado,
      });
      let muestraId: number | null = null;
      if (estado === 'MUESTREO' && lote) {
        // Repetir la petición/etapa no crea otra muestra ni reinicia el reloj.
        const pendiente = await tx.muestras.findFirst({
          where: {
            tanque_id: id,
            lote_id: lote.id_Lote_Produccion,
            estado_Muestra: { notIn: ['APROBADO', 'RECHAZADO'] },
          },
        });
        if (!pendiente) {
          const productoId = Number(lote?.ordenes_produccion?.producto_id ?? 0);
          const clienteId = Number(
            lote?.ordenes_produccion?.crm_ordenes_venta?.persona_id ?? 0,
          );
          const muestraData: Prisma.muestrasUncheckedCreateInput = {
            no_Muestra: lote.no_Lote,
            fecha_Toma: new Date(),
            Hora_Toma: new Date(),
            tanque_id: id,
            lote_id: lote.id_Lote_Produccion,
            producto_id:
              Number.isFinite(productoId) && productoId > 0 ? productoId : 0,
            cliente_id:
              Number.isFinite(clienteId) && clienteId > 0 ? clienteId : 0,
          };
          const muestra = await tx.muestras.create({
            data: muestraData,
          });
          await tx.lotes_produccion.update({
            where: { id_Lote_Produccion: lote.id_Lote_Produccion },
            data: { estado_Calida: 'ESPERANDO_MUESTRA' },
          });
          muestraId = muestra.id_Muestra;
          const mctx = {
            entidad: 'MUESTRA' as const,
            entidad_id: muestraId,
            tanque_id: id,
            lote_id: lote.id_Lote_Produccion,
          };
          await this.tiempos.transicion(tx, mctx, 'TRASLADO');
          await this.tiempos.evento(tx, mctx, 1, 'TOMA_MUESTRA');
        }
      }
      if (estado === 'ESPERA_CALIDAD' && lote)
        await tx.lotes_produccion.update({
          where: { id_Lote_Produccion: lote.id_Lote_Produccion },
          data: { estado_Calida: 'ESPERANDO_MUESTRA' },
        });
      // La recepción y el inicio de análisis los confirma Laboratorio.
      await tx.equipos_tanques.update({
        where: { id_Equipos_Tanques: id },
        data: { estatus_proceso: estado as equipos_tanques_estatus_proceso },
      });
      return { muestraId, cambio: true };
    });
    if (result.cambio)
      this.eventos.notificar('ESTATUS_TANQUE_CAMBIADO', {
        tanqueId: id,
        estatus: estado,
        estatus_proceso: estado,
      });
    if (result.muestraId)
      this.eventos.notificar('MUESTRA_CREADA', {
        id_Muestra: result.muestraId,
      });
    return result;
  }
  /**
   * Inventario de apertura: captura una existencia física previa a la
   * digitalización, sin fingir recepción reciente ni generar una muestra nueva.
   */
  async registrarApertura(b: any, u: Usuario) {
    const folio = texto(b.folio, 100);
    const cantidad = decimalCrm(b.cantidad, 4);
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`apertura:${folio}`}))::text`;
      const previo = await tx.lotes_inventario.findUnique({ where: { folio } });
      if (previo) {
        if (previo.origen !== 'APERTURA')
          throw new ConflictException('El folio ya pertenece a otro movimiento');
        return previo;
      }
      const producto = await tx.productos_materiales.findUnique({
        where: { id_Produc_Mater: idValido(b.producto_id) },
      });
      if (!producto) throw new BadRequestException('Producto inválido');
      const propiedad = b.propiedad;
      if (!['PROPIO', 'DE_CLIENTE'].includes(propiedad))
        throw new BadRequestException('Propiedad inválida');
      const propietarioId =
        propiedad === 'DE_CLIENTE' ? idValido(b.propietario_id) : null;
      if (propiedad === 'DE_CLIENTE' && !propietarioId)
        throw new BadRequestException('Selecciona el propietario del material');
      if (propiedad === 'PROPIO' && b.propietario_id)
        throw new BadRequestException('El inventario propio no lleva cliente propietario');
      const condicion = b.condicion;
      const condiciones = [
        'NUEVO', 'SUCIO', 'REZAGADO', 'FUERA_DE_ESPECIFICACION',
        'INTERMEDIO', 'REGENERADO', 'TERMINADO', 'INSUMO',
      ];
      if (!condiciones.includes(condicion))
        throw new BadRequestException('Condición de apertura inválida');
      const estadoCalidad = b.estado_calidad_recepcion;
      if (!['CUARENTENA', 'LIBERADO', 'BLOQUEADO', 'RECHAZADO'].includes(estadoCalidad))
        throw new BadRequestException('Estado de Calidad inválido');
      if (
        condicion === 'FUERA_DE_ESPECIFICACION'
          ? estadoCalidad !== 'RECHAZADO'
          : estadoCalidad === 'RECHAZADO'
      )
        throw new BadRequestException(
          'F.E. debe conservarse como rechazado; usa esa condición solo para producto rechazado por Calidad',
        );
      const ubicacionId = idValido(b.ubicacion_id);
      if (
        !(await tx.inventario_ubicaciones.count({
          where: { id: ubicacionId, activo: true, tipo: { not: 'TANQUE' } },
        }))
      )
        throw new BadRequestException('Ubicación inválida');
      const especificaciones = especificacionesValidas(
        b.especificaciones,
        producto.configuracion_operativa,
        producto.UM,
        cantidad,
      );
      const observaciones = texto(b.observaciones, 4000);
      if (!observaciones)
        throw new BadRequestException('Describe el origen o corte del inventario inicial');
      const lote = await tx.lotes_inventario.create({
        data: {
          folio,
          producto_id: producto.id_Produc_Mater,
          unidad: producto.UM,
          propiedad,
          propietario_id: propietarioId,
          condicion,
          estado_calidad_recepcion: estadoCalidad,
          origen: 'APERTURA',
          especificaciones,
          observaciones,
          liberado_en: estadoCalidad === 'LIBERADO' ? new Date() : null,
          liberado_por: estadoCalidad === 'LIBERADO' ? u.usuario : null,
        },
      });
      await tx.movimientos_inventario.create({
        data: {
          folio_Movi: `INI-${randomUUID()}`,
          clave_evento: `apertura:${folio}`,
          tipo: 'APERTURA',
          cantidad,
          lote_inventario_id: lote.id,
          ubicacion_destino_id: ubicacionId,
          realizado_por: u.usuario,
          motivo: observaciones,
        },
      });
      return lote;
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', {});
    return { success: true, data };
  }
  async catalogos() {
    const [productos, personas, ubicaciones] = await Promise.all([
      this.prisma.productos_materiales.findMany({
        select: {
          id_Produc_Mater: true,
          nombre_Producto: true,
          UM: true,
          configuracion_operativa: true,
        },
      }),
      this.prisma.personas.findMany({
        select: { id_Persona: true, nombre: true },
      }),
      this.prisma.inventario_ubicaciones.findMany({
        where: { activo: true, tipo: { not: 'TANQUE' } },
      }),
    ]);
    return { success: true, productos, personas, ubicaciones };
  }
  async stock() {
    return { success: true, data: await existencias(this.prisma) };
  }
  async crearOrden(b: any, u: Usuario) {
    return {
      success: true,
      data: await this.prisma.$transaction((tx) =>
        crearOrdenProduccion(tx, b, u),
      ),
    };
  }
  async iniciarLote(b: any, u: Usuario) {
    const opId = idValido(b.orden_produccion_id),
      tanqueId = idValido(b.tanque_id),
      folio = texto(b.no_Lote, 50);
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Equipos_Tanques" FROM equipos_tanques ORDER BY "id_Equipos_Tanques" FOR UPDATE`;
      await tx.$queryRaw`SELECT "id_Orden_Produc" FROM ordenes_produccion WHERE "id_Orden_Produc"=${opId} FOR UPDATE`;
      const op = await tx.ordenes_produccion.findUnique({
        where: { id_Orden_Produc: opId },
      });
      if (
        !op ||
        op.linea_Produccion?.toUpperCase() !== 'GRAFITO' ||
        !['PLANIFICADA', 'EN_PROCESO'].includes(op.estado_Plan)
      )
        throw new BadRequestException('Orden no disponible');
      const existente = await tx.lotes_produccion.findUnique({
        where: { no_Lote: folio },
      });
      if (existente) {
        if (existente.orden_Produccion_id !== opId)
          throw new BadRequestException('Folio ocupado');
        return existente;
      }
      const tanque = await tx.equipos_tanques.findUnique({
        where: { id_Equipos_Tanques: tanqueId },
      });
      if (
        !tanque ||
        tanque.tipo !== 'GRAFITO' ||
        tanque.status !== 'OPERATIVO' ||
        tanque.estatus_proceso !== 'VACIO' ||
        (await tx.lotes_produccion.count({ where: { tanque_id: tanqueId } }))
      )
        throw new BadRequestException('Tanque no disponible');
      if (!Array.isArray(b.consumos) || !b.consumos.length)
        throw new BadRequestException(
          'Selecciona materiales reservados para este lote',
        );
      const consumos: { id: number; cantidad: Prisma.Decimal }[] =
        b.consumos.map((c: any) => ({
          id: idValido(c.reserva_id),
          cantidad: decimalCrm(c.cantidad, 4),
        }));
      if (new Set(consumos.map((c) => c.id)).size !== consumos.length)
        throw new BadRequestException('Reserva duplicada');
      let reservas = await tx.inventario_reservas.findMany({
        where: {
          orden_produccion_id: opId,
          id: { in: consumos.map((c) => c.id) },
        },
        include: {
          lote: { include: { lote_produccion: true } },
          movimientos: { include: { reversion: true } },
        },
      });
      if (reservas.length !== consumos.length)
        throw new BadRequestException('Reserva ajena a la orden');
      await bloquearMaterial(
        tx,
        reservas.map((r) => r.lote_inventario_id),
      );
      reservas = await tx.inventario_reservas.findMany({
        where: {
          orden_produccion_id: opId,
          id: { in: consumos.map((c) => c.id) },
        },
        include: {
          lote: { include: { lote_produccion: true } },
          movimientos: { include: { reversion: true } },
        },
      });
      let carga = new Prisma.Decimal(0);
      for (const c of consumos) {
        const r = reservas.find((r) => r.id === c.id)!;
        if (
          r.estado !== 'ACTIVA' ||
          r.cantidad.sub(consumido(r.movimientos)).lt(c.cantidad)
        )
          throw new BadRequestException('Reserva insuficiente');
        const aptitud = aptitudMaterial(r.lote);
        if (!(op.es_reproceso ? aptitud.reprocesable : aptitud.venta))
          throw new BadRequestException(
            'Material bloqueado o caducado para esta operación',
          );
        if (r.lote.unidad !== tanque.unidad_capacidad)
          throw new BadRequestException(
            'Unidad incompatible con capacidad del tanque',
          );
        carga = carga.add(c.cantidad);
      }
      if (carga.gt(tanque.capacidad))
        throw new BadRequestException(
          'La carga excede la capacidad del tanque',
        );
      const lote = await tx.lotes_produccion.create({
        data: {
          no_Lote: folio,
          orden_Produccion_id: opId,
          tanque_id: tanqueId,
          estado: 'EN_PROCESO',
          fecha_inicio: new Date(),
        },
      });
      for (const c of consumos) {
        const r = reservas.find((r) => r.id === c.id)!;
        await tx.movimientos_inventario.create({
          data: {
            folio_Movi: `CON-${randomUUID()}`,
            clave_evento: `consumo:${lote.id_Lote_Produccion}:${r.id}`,
            tipo: 'SALIDA_CONSUMO',
            lote_inventario_id: r.lote_inventario_id,
            ubicacion_origen_id: r.ubicacion_id,
            lote_produccion_id: lote.id_Lote_Produccion,
            reserva_id: r.id,
            cantidad: c.cantidad,
            realizado_por: u.usuario,
          },
        });
        if (consumido(r.movimientos).add(c.cantidad).eq(r.cantidad))
          await tx.inventario_reservas.update({
            where: { id: r.id },
            data: {
              estado: 'CONSUMIDA',
              cerrado_en: new Date(),
              motivo_cierre: 'Material consumido',
            },
          });
      }
      await tx.ordenes_produccion.update({
        where: { id_Orden_Produc: opId },
        data: {
          estado_Plan: 'EN_PROCESO',
          fecha_Inicio_Produccion: op.fecha_Inicio_Produccion ?? new Date(),
        },
      });
      await tx.equipos_tanques.update({
        where: { id_Equipos_Tanques: tanqueId },
        data: { estatus_proceso: 'CARGANDO_TANQUE' },
      });
      const ctx = {
        entidad: 'TANQUE' as const,
        entidad_id: tanqueId,
        tanque_id: tanqueId,
        lote_id: lote.id_Lote_Produccion,
      };
      const tramo = await this.tiempos.transicion(
        tx,
        ctx,
        'CARGANDO_TANQUE',
        true,
      );
      await this.tiempos.evento(tx, ctx, tramo!.ciclo, 'INICIO_LOTE', {
        realizado_por: u.usuario,
        consumos: b.consumos,
      });
      return lote;
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', {});
    return { success: true, data };
  }
  async descargar(id: number, b: any, u: Usuario) {
    const cantidad = decimalCrm(b.cantidad, 4),
      ubicacion = idValido(b.ubicacion_id);
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Equipos_Tanques" FROM equipos_tanques ORDER BY "id_Equipos_Tanques" FOR UPDATE`;
      await tx.$queryRaw`SELECT "id_Lote_Produccion" FROM lotes_produccion WHERE "id_Lote_Produccion"=${id} FOR UPDATE`;
      const lote = await tx.lotes_produccion.findUnique({
        where: { id_Lote_Produccion: id },
        include: {
          ordenes_produccion: {
            include: { crm_ordenes_venta: true, productos_materiales: true },
          },
        },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      const previo = await tx.lotes_inventario.findFirst({
        where: { lote_produccion_id: id },
      });
      if (previo) return previo;
      if (lote.estado !== 'EN_PROCESO' || !lote.tanque_id)
        throw new BadRequestException('Lote no disponible para descarga');
      if (
        !(await tx.inventario_ubicaciones.count({
          where: { id: ubicacion, activo: true, tipo: { not: 'TANQUE' } },
        }))
      )
        throw new BadRequestException(
          'Selecciona una ubicación de destino activa',
        );
      const op = lote.ordenes_produccion;
      if (!op) {
        throw new BadRequestException(
          'La orden de producción asociada al lote no está disponible',
        );
      }
      const ov = op.crm_ordenes_venta;
      const cliente =
        op.propietario_id ??
        (ov?.tipo_venta === 'SERVICIO_REGENERACION' ? ov.persona_id : null);
      const fe = b.destino_calidad === 'FE';
      if (fe) {
        const ultima = await tx.muestras.findFirst({
          where: { lote_id: id, area_Muestra: 'CALIDAD' },
          orderBy: { id_Muestra: 'desc' },
        });
        if (
          lote.estado_Calida !== 'RECHAZADO' ||
          !ultima ||
          ultima.categoria_Muestra !== 'MUESTRA_AJUSTADO' ||
          ultima.estado_Muestra !== 'RECHAZADO'
        )
          throw new BadRequestException(
            'F.E. requiere la última muestra ajustada rechazada',
          );
        const abierto = await tx.proceso_tramos.count({
          where: {
            entidad: 'MUESTRA',
            entidad_id: ultima.id_Muestra,
            fin: null,
          },
        });
        if (abierto)
          throw new BadRequestException('Hay una revisión de Calidad abierta');
      } else if (
        ['RECHAZADO', 'FUERA_DE_ESPECIFICACION'].includes(lote.estado_Calida) ||
        (b.destino_calidad === 'LIBERADO' && lote.estado_Calida !== 'LIBERADO')
      ) {
        throw new BadRequestException(
          'Libera el lote o descarga explícitamente como F.E. tras el rechazo final',
        );
      }
      const especificaciones = especificacionesValidas(
        b.especificaciones,
        op.productos_materiales.configuracion_operativa,
        op.unidad,
        cantidad,
      );
      const material = await tx.lotes_inventario.create({
        data: {
          folio: `PT-${lote.no_Lote}`,
          producto_id: op.producto_id,
          unidad: op.unidad,
          propiedad: cliente ? 'DE_CLIENTE' : 'PROPIO',
          propietario_id: cliente,
          condicion: fe
            ? 'FUERA_DE_ESPECIFICACION'
            : cliente
              ? 'REGENERADO'
              : 'TERMINADO',
          especificaciones,
          origen: 'PRODUCCION',
          lote_produccion_id: id,
        },
      });
      await tx.movimientos_inventario.create({
        data: {
          folio_Movi: `PRO-${randomUUID()}`,
          clave_evento: `produccion:${id}`,
          tipo: 'ENTRADA_PRODUCCION',
          lote_inventario_id: material.id,
          lote_produccion_id: id,
          ubicacion_destino_id: ubicacion,
          cantidad,
          realizado_por: u.usuario,
        },
      });
      await tx.lotes_produccion.update({
        where: { id_Lote_Produccion: id },
        data: {
          estado: 'FINALIZADO',
          fecha_fin: new Date(),
          tanque_id: null,
          ...(fe ? { estado_Calida: 'FUERA_DE_ESPECIFICACION' } : {}),
        },
      });
      const ctx = {
        entidad: 'TANQUE' as const,
        entidad_id: lote.tanque_id,
        tanque_id: lote.tanque_id,
        lote_id: id,
      };
      const tramo = await this.tiempos.transicion(tx, ctx, null);
      await this.tiempos.evento(tx, ctx, tramo?.ciclo ?? 1, 'DESCARGA_LOTE', {
        cantidad: cantidad.toString(),
        destino_calidad: fe ? 'FE' : lote.estado_Calida,
        ubicacion,
        realizado_por: u.usuario,
      });
      await tx.equipos_tanques.update({
        where: { id_Equipos_Tanques: lote.tanque_id },
        data: { estatus_proceso: 'VACIO' },
      });
      return material;
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', {});
    return { success: true, data };
  }
  async ubicacion(b: any) {
    return {
      success: true,
      data: await this.prisma.inventario_ubicaciones.create({
        data: {
          codigo: texto(b.codigo, 50),
          nombre: texto(b.nombre, 150),
          tipo: 'ALMACEN',
        },
      }),
    };
  }
  async recibirMaterial(b: any, u: Usuario) {
    const folio = texto(b.folio, 80),
      cantidad = decimalCrm(b.cantidad, 4);
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`recepcion:${folio}`}))::text`;
      const previo = await tx.lotes_llegada.findUnique({
        where: { no_lote: folio },
      });
      if (previo) return previo;
      const remitente = idValido(b.remitente_id),
        producto = await tx.productos_materiales.findUnique({
          where: { id_Produc_Mater: idValido(b.producto_id) },
        });
      if (!producto) throw new BadRequestException('Producto inválido');
      if (!['PROPIO', 'DE_CLIENTE'].includes(b.propiedad))
        throw new BadRequestException('Propiedad inválida');
      const ov = b.orden_venta_id
        ? await tx.crm_ordenes_venta.findUnique({
            where: { id: idValido(b.orden_venta_id) },
          })
        : null;
      if (
        b.orden_venta_id &&
        (!ov ||
          ov.estado !== 'CONFIRMADA' ||
          ov.persona_id !== remitente ||
          ov.tipo_venta !== 'SERVICIO_REGENERACION' ||
          b.propiedad !== 'DE_CLIENTE')
      )
        throw new BadRequestException(
          'Orden de venta incompatible con el propietario',
        );
      const ubicacion = idValido(b.ubicacion_id);
      if (
        !(await tx.inventario_ubicaciones.count({
          where: { id: ubicacion, activo: true, tipo: { not: 'TANQUE' } },
        }))
      )
        throw new BadRequestException('Ubicación inválida');
      const especificaciones = especificacionesValidas(
        b.especificaciones,
        producto.configuracion_operativa,
        producto.UM,
        cantidad,
      );
      if (b.condicion && !['SUCIO', 'INSUMO', 'REZAGADO'].includes(b.condicion))
        throw new BadRequestException('Condición de recepción inválida');
      const recepcion = await tx.lotes_llegada.create({
        data: {
          no_lote: folio,
          remitente_id: remitente,
          creado_por: u.usuario,
          confirmado_por: u.usuario,
          confirmado_en: new Date(),
          estado_recepcion: 'CONFIRMADA',
        },
      });
      const lote = await tx.lotes_inventario.create({
        data: {
          folio: `MP-${folio}`,
          producto_id: producto.id_Produc_Mater,
          unidad: producto.UM,
          propiedad: b.propiedad,
          propietario_id: b.propiedad === 'DE_CLIENTE' ? remitente : null,
          condicion:
            b.condicion || (b.propiedad === 'DE_CLIENTE' ? 'SUCIO' : 'INSUMO'),
          especificaciones,
          origen: 'RECEPCION',
          recepcion_id: recepcion.id,
          orden_venta_id: ov?.id,
          estado_calidad_recepcion: 'CUARENTENA',
        },
      });
      await tx.movimientos_inventario.create({
        data: {
          folio_Movi: `REC-${randomUUID()}`,
          clave_evento: `recepcion:${recepcion.id}`,
          tipo: 'ENTRADA_RECEPCION',
          cantidad,
          lote_inventario_id: lote.id,
          ubicacion_destino_id: ubicacion,
          realizado_por: u.usuario,
        },
      });
      const muestra = await tx.muestras.create({
        data: {
          no_Muestra: `MP-${folio}`,
          fecha_Toma: new Date(),
          Hora_Toma: new Date(),
          area_Muestra: 'CALIDAD',
          lote_inventario_id: lote.id,
          producto_id: producto.id_Produc_Mater,
          cliente_id: b.propiedad === 'DE_CLIENTE' ? remitente : null,
        },
      });
      await this.tiempos.transicion(
        tx,
        { entidad: 'MUESTRA', entidad_id: muestra.id_Muestra },
        'TRASLADO',
      );
      return recepcion;
    });
    this.eventos.notificar('MUESTRA_CREADA', {});
    return { success: true, data };
  }
  async vincularVenta(id: number, b: any, u: Usuario) {
    const ventaId = idValido(b.orden_venta_id);
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id=${ventaId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id_Orden_Produc" FROM ordenes_produccion WHERE "id_Orden_Produc"=${id} FOR UPDATE`;
      const [ov, op] = await Promise.all([
        tx.crm_ordenes_venta.findUnique({ where: { id: ventaId } }),
        tx.ordenes_produccion.findUnique({
          where: { id_Orden_Produc: id },
          include: {
            reservas_material: { include: { lote: true } },
            lotes_produccion: { include: { inventario_obtenido: true } },
          },
        }),
      ]);
      if (!ov || !op) throw new NotFoundException('Orden no encontrada');
      if (ov.estado !== 'CONFIRMADA' || op.estado_Plan === 'CANCELADA')
        throw new BadRequestException('Orden cancelada');
      if (op.orden_venta_id === ventaId) return op;
      if (op.orden_venta_id)
        throw new BadRequestException('La OP ya tiene venta');
      if (op.producto_id !== ov.producto_id || op.unidad !== ov.unidad)
        throw new BadRequestException('Producto o unidad incompatible');
      const insumos = op.reservas_material.map((r) => r.lote);
      const salidas = op.lotes_produccion.flatMap((l) => l.inventario_obtenido);
      await bloquearMaterial(
        tx,
        [...insumos, ...salidas].map((l) => l.id),
      );
      const propietario = op.propietario_id;
      if (
        (ov.tipo_venta === 'SERVICIO_REGENERACION' &&
          propietario !== ov.persona_id) ||
        (ov.tipo_venta !== 'SERVICIO_REGENERACION' && propietario != null) ||
        insumos.some(
          (l) =>
            (l.propiedad === 'DE_CLIENTE' &&
              l.propietario_id !== propietario) ||
            (l.orden_venta_id && l.orden_venta_id !== ventaId),
        ) ||
        salidas.some((l) => l.propietario_id !== propietario)
      )
        throw new BadRequestException(
          'La venta no corresponde al propietario del material',
        );
      const plan = await tx.ordenes_produccion.aggregate({
        where: { orden_venta_id: ventaId, estado_Plan: { not: 'CANCELADA' } },
        _sum: { cantidad_Planificada: true },
      });
      if (
        op.cantidad_Planificada
          .add(plan._sum.cantidad_Planificada ?? 0)
          .gt(ov.cantidad)
      )
        throw new BadRequestException(
          'La OP excede la cantidad pendiente de planificar',
        );
      await tx.proceso_eventos.create({
        data: {
          entidad: 'OP',
          entidad_id: id,
          ciclo: 1,
          fecha: new Date(),
          accion: 'VINCULAR_VENTA',
          detalle: JSON.stringify({
            orden_venta_id: ventaId,
            realizado_por: u.usuario,
          }),
        },
      });
      return tx.ordenes_produccion.update({
        where: { id_Orden_Produc: id },
        data: { orden_venta_id: ventaId },
      });
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', {});
    return { success: true, data };
  }

  async marcarRezagado(id: number, b: any, u: Usuario) {
    const motivo = texto(b.motivo, 4000);
    return this.prisma.$transaction(async (tx) => {
      await bloquearMaterial(tx, [id]);
      const lote = await tx.lotes_inventario.findUnique({ where: { id } });
      if (!lote) throw new NotFoundException('Material no encontrado');
      if (['FUERA_DE_ESPECIFICACION', 'RESIDUO'].includes(lote.condicion))
        throw new BadRequestException('F.E. y residuos conservan su condición');
      await tx.proceso_eventos.create({
        data: {
          entidad: 'INVENTARIO',
          entidad_id: id,
          ciclo: 1,
          fecha: new Date(),
          accion: 'MARCAR_REZAGADO',
          detalle: JSON.stringify({
            motivo,
            anterior: lote.condicion,
            realizado_por: u.usuario,
          }),
        },
      });
      return {
        success: true,
        data: await tx.lotes_inventario.update({
          where: { id },
          data: { condicion: 'REZAGADO' },
        }),
      };
    });
  }

  async cerrarOrden(id: number, b: any, u: Usuario) {
    const estado = b.estado;
    if (!['FINALIZADA', 'CANCELADA'].includes(estado))
      throw new BadRequestException('Estado inválido');
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id_Orden_Produc" FROM ordenes_produccion WHERE "id_Orden_Produc"=${id} FOR UPDATE`;
      const op = await tx.ordenes_produccion.findUnique({
        where: { id_Orden_Produc: id },
        include: { lotes_produccion: true, reservas_material: true },
      });
      if (!op) throw new NotFoundException('Orden no encontrada');
      if (op.estado_Plan === estado) return op;
      if (['FINALIZADA', 'CANCELADA'].includes(op.estado_Plan))
        throw new BadRequestException('Orden cerrada');
      if (
        op.lotes_produccion.some((l) =>
          ['PENDIENTE', 'EN_PROCESO'].includes(l.estado),
        )
      )
        throw new BadRequestException(
          'Termina los lotes abiertos antes de cerrar la orden',
        );
      if (estado === 'FINALIZADA' && !op.fecha_Inicio_Produccion)
        throw new BadRequestException('La orden aún no inició');
      const motivo = texto(b.motivo, 4000);
      await bloquearMaterial(
        tx,
        op.reservas_material.map((r) => r.lote_inventario_id),
      );
      await tx.inventario_reservas.updateMany({
        where: { orden_produccion_id: id, estado: 'ACTIVA' },
        data: {
          estado: 'CANCELADA',
          cerrado_en: new Date(),
          motivo_cierre: motivo,
        },
      });
      await tx.proceso_eventos.create({
        data: {
          entidad: 'OP',
          entidad_id: id,
          ciclo: 1,
          accion: 'CIERRE_OP',
          fecha: new Date(),
          detalle: JSON.stringify({ estado, motivo, realizado_por: u.usuario }),
        },
      });
      return tx.ordenes_produccion.update({
        where: { id_Orden_Produc: id },
        data: {
          estado_Plan: estado,
          ...(estado === 'FINALIZADA'
            ? { fecha_Termino_Real: new Date() }
            : { motivo_cancelacion: motivo }),
        },
      });
    });
    this.eventos.notificar('TANQUE_ACTUALIZADO', {});
    return { success: true, data };
  }
}
