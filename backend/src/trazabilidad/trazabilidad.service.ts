import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type Tx = Prisma.TransactionClient;
export type ContextoTiempo = { entidad: 'MUESTRA' | 'TANQUE' | 'MUESTRA_ID'; entidad_id: number; lote_id?: number | null; tanque_id?: number | null };

@Injectable()
export class TrazabilidadService {
  constructor(private readonly prisma: PrismaService) {}
  id(valor: unknown): number {
    if (!['number', 'string'].includes(typeof valor) || !/^\d+$/.test(String(valor))) throw new BadRequestException('ID inválido');
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('ID inválido');
    return id;
  }
  async evento(tx: Tx, ctx: ContextoTiempo, ciclo: number, accion: string, detalle?: unknown) {
    return tx.proceso_eventos.create({ data: { ...ctx, ciclo, accion, fecha: new Date(), detalle: detalle == null ? null : JSON.stringify(detalle) } });
  }
  async ultimo(tx: Tx, ctx: ContextoTiempo) {
    return tx.proceso_tramos.findFirst({ where: { entidad: ctx.entidad, entidad_id: ctx.entidad_id }, orderBy: { id: 'desc' } });
  }
  // El llamador bloquea la fila de muestra/tanque en la MISMA transacción.
  async transicion(tx: Tx, ctx: ContextoTiempo, etapa: string | null, nuevoCiclo = false) {
    const ultimo = await this.ultimo(tx, ctx);
    const abierto = ultimo?.fin == null ? ultimo : null;
    if (abierto && abierto.etapa === etapa && abierto.lote_id === (ctx.lote_id ?? null) && !nuevoCiclo) return abierto;
    const ahora = new Date();
    if (abierto) await tx.proceso_tramos.update({ where: { id: abierto.id }, data: { fin: ahora, activo: null } });
    const ciclo = ultimo ? ultimo.ciclo + (nuevoCiclo ? 1 : 0) : 1;
    if (!etapa) return ultimo;
    return tx.proceso_tramos.create({ data: { ...ctx, ciclo, etapa, inicio: ahora, activo: `${ctx.entidad}:${ctx.entidad_id}` } });
  }
  async consultar(q: { entidad?: string; id?: string; loteId?: string; desde?: string; hasta?: string; pagina?: string }) {
    const where: Prisma.proceso_tramosWhereInput = { entidad: { in: ['MUESTRA', 'TANQUE'] } };
    if (q.entidad) {
      if (!['MUESTRA', 'TANQUE'].includes(q.entidad)) throw new BadRequestException('Entidad inválida');
      where.entidad = q.entidad;
    }
    if (q.id) where.entidad_id = this.id(q.id);
    if (q.loteId) where.lote_id = this.id(q.loteId);
    const desde = q.desde ? new Date(q.desde) : undefined, hasta = q.hasta ? new Date(q.hasta) : undefined;
    if ((desde && isNaN(+desde)) || (hasta && isNaN(+hasta)) || (desde && hasta && desde > hasta)) throw new BadRequestException('Rango de fechas inválido');
    // Cohorte de etapas iniciadas en [desde, hasta); no recortar duraciones.
    if (desde || hasta) where.inicio = { gte: desde, lt: hasta };
    const pagina = q.pagina ? this.id(q.pagina) : 1;
    const [total, tramos] = await this.prisma.$transaction([
      this.prisma.proceso_tramos.count({ where }),
      this.prisma.proceso_tramos.findMany({ where, orderBy: { id: 'desc' }, skip: (pagina - 1) * 200, take: 200 }),
    ]);
    return { success: true, total, pagina, tamanoPagina: 200, data: tramos.map(t => ({ ...t, duracionSegundos: t.fin ? (t.fin.getTime() - t.inicio.getTime()) / 1000 : null })) };
  }
  async historial(entidad: string, id: string) {
    if (!['MUESTRA', 'TANQUE'].includes(entidad)) throw new BadRequestException('Entidad inválida');
    return { success: true, data: await this.prisma.proceso_eventos.findMany({ where: { entidad, entidad_id: this.id(id) }, orderBy: { id: 'desc' }, take: 500 }) };
  }
}
