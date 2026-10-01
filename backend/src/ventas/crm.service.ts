import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { Usuario } from '../auth/auth.service';
import {
  ACCION_CRM,
  ENTIDAD_CRM,
  EtapaCrm,
  conversion,
  filtrosCrm,
  seguimientoValido,
} from './crm.logic';

type Oportunidad = {
  id: number;
  folio: string | null;
  cliente: string | null;
  producto: string;
  cantidad: string | null;
  unidad: string | null;
  estadoLaboratorio: string;
  recoleccion: Date | null;
  ingresoLaboratorio: Date | null;
  etapa: EtapaCrm;
  version: number;
  nota: string | null;
  proximoContacto: string | null;
  actualizado: Date | null;
};
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventsGateway,
  ) {}

  // El estado comercial es la última entrada de su propia bitácora. No modifica
  // estado_Muestra, id_ejecuciones ni proceso_tramos de investigación.
  private base(u: Usuario, f: ReturnType<typeof filtrosCrm>, id?: number) {
    const busqueda = '%' + f.busqueda.replace(/[\\%_]/g, '\\$&') + '%';
    return Prisma.sql`WITH oportunidades AS (
      SELECT m."id_Muestra" AS id, m."no_Muestra" AS folio, c.nombre AS cliente,
        p."nombre_Producto" AS producto, m.cantidad_proyecto::text AS cantidad,
        m.unidad_proyecto AS unidad, m."estado_Muestra"::text AS "estadoLaboratorio",
        m.fecha_recoleccion AS recoleccion, m.fecha_ingreso_laboratorio AS "ingresoLaboratorio",
        CASE WHEN COALESCE(e.detalle::jsonb->>'etapa', 'RECOLECCION') = 'RECOLECCION'
          AND (m.fecha_ingreso_laboratorio IS NOT NULL OR m."estado_Muestra"::text <> 'PENDIENTE')
          THEN 'EN_ANALISIS'
          ELSE COALESCE(e.detalle::jsonb->>'etapa', 'RECOLECCION') END AS etapa,
        COALESCE(e.id, 0) AS version, e.detalle::jsonb->>'nota' AS nota,
        e.detalle::jsonb->>'proximoContacto' AS "proximoContacto", e.fecha AS actualizado
      FROM muestras m
      JOIN productos_materiales p ON p."id_Produc_Mater" = m.producto_id
      LEFT JOIN personas c ON c."id_Persona" = m.cliente_id
      LEFT JOIN LATERAL (
        SELECT id, detalle, fecha FROM proceso_eventos
        WHERE entidad = ${ENTIDAD_CRM} AND entidad_id = m."id_Muestra" AND accion = ${ACCION_CRM}
        ORDER BY id DESC LIMIT 1
      ) e ON true
      WHERE m."area_Muestra" = 'INVESTIGACION_DESARROLLO' AND m.vendedor_id = ${u.personaId}
        ${id === undefined ? Prisma.empty : Prisma.sql`AND m."id_Muestra" = ${id}`}
        ${f.desde ? Prisma.sql`AND m.fecha_recoleccion >= ${f.desde}` : Prisma.empty}
        ${f.hastaExclusiva ? Prisma.sql`AND m.fecha_recoleccion < ${f.hastaExclusiva}` : Prisma.empty}
        ${f.busqueda ? Prisma.sql`AND (m."no_Muestra" ILIKE ${busqueda} OR c.nombre ILIKE ${busqueda} OR p."nombre_Producto" ILIKE ${busqueda})` : Prisma.empty}
    )`;
  }
  async listar(u: Usuario, q: Record<string, unknown>) {
    const f = filtrosCrm(q),
      base = this.base(u, f),
      tamanoPagina = 50;
    return this.prisma.$transaction(
      async (tx) => {
        const grupos = await tx.$queryRaw<
          { etapa: EtapaCrm; cantidad: bigint }[]
        >`${base} SELECT etapa, COUNT(*) AS cantidad FROM oportunidades GROUP BY etapa`;
        const porEtapa = Object.fromEntries(
          grupos.map((g) => [g.etapa, Number(g.cantidad)]),
        );
        const totalCohorte = grupos.reduce(
          (sum, g) => sum + Number(g.cantidad),
          0,
        );
        const aseguradas = porEtapa.VENTA_ASEGURADA ?? 0,
          noAseguradas = porEtapa.VENTA_NO_ASEGURADA ?? 0;
        const data = await tx.$queryRaw<
          Oportunidad[]
        >`${base} SELECT * FROM oportunidades
        ${f.etapa ? Prisma.sql`WHERE etapa = ${f.etapa}` : Prisma.empty}
        ORDER BY id DESC LIMIT ${tamanoPagina} OFFSET ${(f.pagina - 1) * tamanoPagina}`;
        return {
          success: true,
          data,
          pagina: f.pagina,
          tamanoPagina,
          total: f.etapa ? (porEtapa[f.etapa] ?? 0) : totalCohorte,
          resumen: {
            total: totalCohorte,
            aseguradas,
            noAseguradas,
            abiertas: totalCohorte - aseguradas - noAseguradas,
            conversion: conversion(aseguradas, totalCohorte),
            porEtapa,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async oportunidad(
    db: Prisma.TransactionClient,
    id: number,
    u: Usuario,
  ) {
    const base = this.base(u, filtrosCrm({}), id);
    const rows = await db.$queryRaw<
      Oportunidad[]
    >`${base} SELECT * FROM oportunidades`;
    if (!rows[0]) throw new NotFoundException('Oportunidad no encontrada.');
    return rows[0];
  }
  async detalle(id: number, u: Usuario) {
    return this.prisma.$transaction(
      async (tx) => {
        const data = await this.oportunidad(tx, id, u);
        const historial = await tx.proceso_eventos.findMany({
          where: { entidad: ENTIDAD_CRM, entidad_id: id, accion: ACCION_CRM },
          orderBy: { id: 'desc' },
          take: 200,
        });
        return {
          success: true,
          data,
          historial: historial.map((e) => ({
            id: e.id,
            fecha: e.fecha,
            ...JSON.parse(e.detalle!),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async guardar(id: number, body: Record<string, unknown>, u: Usuario) {
    const result = await this.prisma.$transaction(async (tx) => {
      // El mismo bloqueo que ID: serializa recepción, cambio comercial y doble envío.
      const lock = await tx.$queryRaw<
        { id_Muestra: number }[]
      >`SELECT "id_Muestra" FROM muestras
        WHERE "id_Muestra"=${id} AND "area_Muestra"='INVESTIGACION_DESARROLLO' AND vendedor_id=${u.personaId} FOR UPDATE`;
      if (!lock.length)
        throw new NotFoundException('Oportunidad no encontrada.');
      const actual = await this.oportunidad(tx, id, u);
      const cambio = seguimientoValido(body, {
        etapa: actual.etapa,
        recibido:
          !!actual.ingresoLaboratorio ||
          actual.estadoLaboratorio !== 'PENDIENTE',
      });
      if (body.version !== actual.version || body.etapaActual !== actual.etapa)
        throw new ConflictException(
          'La oportunidad cambió. Recarga el detalle antes de guardar.',
        );
      const evento = await tx.proceso_eventos.create({
        data: {
          entidad: ENTIDAD_CRM,
          entidad_id: id,
          accion: ACCION_CRM,
          ciclo: 1,
          fecha: new Date(),
          detalle: JSON.stringify({
            ...cambio,
            etapaAnterior: actual.etapa,
            usuario: u.usuario,
            personaId: u.personaId,
          }),
        },
      });
      return { success: true, version: evento.id };
    });
    this.eventos.notificar('CRM_OPORTUNIDAD_ACTUALIZADA', { id_Muestra: id });
    return result;
  }
}
