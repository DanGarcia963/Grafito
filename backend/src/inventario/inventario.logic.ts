import { aptitudMaterial } from './especificaciones.logic';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Usuario } from '../auth/auth.service';
import { idValido, texto } from '../investigacion/id.logic';
import { decimalCrm } from '../ventas/crm.workflow';
type Tx = Prisma.TransactionClient;
export async function existencias(
  tx: Tx,
  ov?: { persona_id: number; tipo_venta: string; id: number },
) {
  const lotes = await tx.lotes_inventario.findMany({
    where: ov
      ? {
          OR: [
            { propiedad: 'PROPIO' },
            ...(ov.tipo_venta === 'SERVICIO_REGENERACION'
              ? [
                  {
                    propiedad: 'DE_CLIENTE' as const,
                    propietario_id: ov.persona_id,
                    OR: [{ orden_venta_id: null }, { orden_venta_id: ov.id }],
                  },
                ]
              : []),
          ],
        }
      : {},
    include: {
      producto: true,
      lote_produccion: true,
      movimientos: true,
      reservas: {
        where: { estado: 'ACTIVA' },
        include: { movimientos: { include: { reversion: true } } },
      },
    },
  });
  const ubicaciones = await tx.inventario_ubicaciones.findMany({
    where: { activo: true },
  });
  return lotes
    .flatMap((l) =>
      ubicaciones.map((u) => {
        const fisico = l.movimientos.reduce(
          (a, m) =>
            a
              .add(m.ubicacion_destino_id === u.id ? m.cantidad : 0)
              .sub(m.ubicacion_origen_id === u.id ? m.cantidad : 0),
          new Prisma.Decimal(0),
        );
        const reservado = l.reservas
          .filter((r) => r.ubicacion_id === u.id)
          .reduce(
            (a, r) => a.add(r.cantidad.sub(consumido(r.movimientos))),
            new Prisma.Decimal(0),
          );
        const aptitud = aptitudMaterial(l);
        return {
          lote_inventario_id: l.id,
          folio: l.folio,
          producto_id: l.producto_id,
          producto: l.producto.nombre_Producto,
          unidad: l.unidad,
          propiedad: l.propiedad,
          propietario_id: l.propietario_id,
          condicion: l.condicion,
          especificaciones: l.especificaciones,
          orden_venta_id: l.orden_venta_id,
          ubicacion_id: u.id,
          ubicacion: u.nombre,
          fisico,
          reservado,
          disponible: aptitud.venta
            ? fisico.sub(reservado)
            : new Prisma.Decimal(0),
          disponible_reproceso: aptitud.reprocesable
            ? fisico.sub(reservado)
            : new Prisma.Decimal(0),
          liberado: aptitud.liberado,
        };
      }),
    )
    .filter((x) => !x.fisico.isZero() || !x.reservado.isZero());
}
export function consumido(
  ms: {
    tipo: string;
    cantidad: Prisma.Decimal;
    reversion?: { cantidad: Prisma.Decimal } | null;
  }[],
) {
  return ms.reduce(
    (a, m) =>
      m.tipo === 'SALIDA_CONSUMO'
        ? a.add(m.cantidad).sub(m.reversion?.cantidad ?? 0)
        : m.tipo === 'REVERSION'
          ? a.sub(m.cantidad)
          : a,
    new Prisma.Decimal(0),
  );
}
export async function bloquearMaterial(tx: Tx, ids: number[]) {
  if (ids.length)
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM lotes_inventario WHERE id IN (${Prisma.join([...new Set(ids)].sort((a, b) => a - b))}) ORDER BY id FOR UPDATE`,
    );
}
export async function crearOrdenProduccion(
  tx: Tx,
  b: any,
  u: Usuario,
  ventaId?: number,
) {
  const folio = texto(b.no_Orden_Produc, 50);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`op:${folio}`}))::text`;
  if (ventaId)
    await tx.$queryRaw`SELECT id FROM crm_ordenes_venta WHERE id=${ventaId} FOR UPDATE`;
  const ov = ventaId
    ? await tx.crm_ordenes_venta.findFirst({
        where: {
          id: ventaId,
          ...(u.area === 'ventas' ? { vendedor_id: u.personaId } : {}),
        },
      })
    : null;
  if (ventaId && !ov)
    throw new NotFoundException('Orden de venta no encontrada');
  if (ov?.estado === 'CANCELADA')
    throw new ConflictException('Venta cancelada');
  const anterior = await tx.ordenes_produccion.findUnique({
    where: { no_Orden_Produc: folio },
  });
  if (anterior) {
    if (
      anterior.orden_venta_id !== (ventaId ?? null) ||
      anterior.creado_por !== u.usuario
    )
      throw new ConflictException('Folio ocupado');
    return anterior;
  }
  const producto = await tx.productos_materiales.findUnique({
    where: { id_Produc_Mater: ov?.producto_id ?? idValido(b.producto_id) },
  });
  if (!producto) throw new BadRequestException('Producto inválido');
  const cantidad = decimalCrm(b.cantidad, 4);
  if (
    !Array.isArray(b.materiales) ||
    !b.materiales.length ||
    b.materiales_completos !== true
  )
    throw new BadRequestException(
      'Selecciona y confirma todos los materiales necesarios',
    );
  const materiales: {
    lote: number;
    ubicacion: number;
    cantidad: Prisma.Decimal;
  }[] = b.materiales.map((m: any) => ({
    lote: idValido(m.lote_inventario_id),
    ubicacion: idValido(m.ubicacion_id),
    cantidad: decimalCrm(m.cantidad, 4),
  }));
  if (
    new Set(materiales.map((m) => `${m.lote}:${m.ubicacion}`)).size !==
    materiales.length
  )
    throw new BadRequestException('Material duplicado');
  await bloquearMaterial(
    tx,
    materiales.map((m) => m.lote),
  );
  const stocks = await existencias(tx, ov ?? undefined);
  const reproceso = b.es_reproceso === true;
  const motivo = reproceso ? texto(b.motivo_reproceso, 4000) : null;
  const propietarios = new Set<number>();
  for (const m of materiales) {
    const stock = stocks.find(
      (s) => s.lote_inventario_id === m.lote && s.ubicacion_id === m.ubicacion,
    );
    if (
      !stock ||
      (reproceso ? stock.disponible_reproceso : stock.disponible).lt(m.cantidad)
    )
      throw new ConflictException(
        'Existencia liberada insuficiente; actualiza los materiales',
      );
    if (stock.orden_venta_id && stock.orden_venta_id !== ov?.id)
      throw new BadRequestException('Material comprometido con otra venta');
    if (stock.propiedad === 'DE_CLIENTE')
      propietarios.add(stock.propietario_id!);
  }
  if (propietarios.size > 1)
    throw new BadRequestException('No mezcles material de distintos clientes');
  const propietario = [...propietarios][0] ?? null;
  if (
    ov &&
    propietario &&
    (ov.tipo_venta !== 'SERVICIO_REGENERACION' || ov.persona_id !== propietario)
  )
    throw new BadRequestException('Venta incompatible con el propietario');
  if (ov) {
    const plan = await tx.ordenes_produccion.aggregate({
      where: { orden_venta_id: ov.id, estado_Plan: { not: 'CANCELADA' } },
      _sum: { cantidad_Planificada: true },
    });
    if (cantidad.add(plan._sum.cantidad_Planificada ?? 0).gt(ov.cantidad))
      throw new BadRequestException(
        'Cantidad superior al pendiente de planificar',
      );
    if (
      ov.tipo_venta === 'SERVICIO_REGENERACION' &&
      !materiales.some((m) =>
        stocks.some(
          (s) =>
            s.lote_inventario_id === m.lote &&
            s.propiedad === 'DE_CLIENTE' &&
            s.propietario_id === ov.persona_id,
        ),
      )
    )
      throw new BadRequestException(
        'Reserva el material recibido de este cliente',
      );
  }
  return tx.ordenes_produccion.create({
    data: {
      no_Orden_Produc: folio,
      es_reproceso: reproceso,
      motivo_reproceso: motivo,
      propietario_id: propietario,
      orden_venta_id: ov?.id,
      producto_id: producto.id_Produc_Mater,
      cantidad_Planificada: cantidad,
      unidad: ov?.unidad ?? producto.UM,
      tipo_Operacion: texto(b.tipo_Operacion, 100),
      linea_Produccion: texto(b.linea_Produccion, 50),
      responsable_id: idValido(b.responsable_id),
      creado_por: u.usuario,
      reservas_material: {
        create: materiales.map((m) => ({
          lote_inventario_id: m.lote,
          ubicacion_id: m.ubicacion,
          cantidad: m.cantidad,
          creado_por: u.usuario,
        })),
      },
    },
  });
}
