import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  Prisma,
  crm_oportunidad_etapa,
  crm_oportunidad_estado_id,
  crm_oportunidad_historial_accion,
} from '@prisma/client';
import { Usuario } from '../auth/auth.service';
export const cerradas = ['GANADA', 'PERDIDA', 'CANCELADA'];
export async function bloquearOportunidad(
  tx: Prisma.TransactionClient,
  id: number,
  u: Usuario,
) {
  await tx.$queryRaw`SELECT id FROM crm_oportunidades WHERE id=${id} FOR UPDATE`;
  const o = await tx.crm_oportunidades.findFirst({
    where: { id, ...(u.area === 'ventas' ? { vendedor_id: u.personaId } : {}) },
  });
  if (!o) throw new NotFoundException('Oportunidad no encontrada');
  return o;
}
export function abierta(o: { etapa: string }) {
  if (cerradas.includes(o.etapa))
    throw new ConflictException('La oportunidad está cerrada');
}
export function versionValida(o: { version: number }, v: unknown) {
  if (Number(v) !== o.version)
    throw new ConflictException(
      'La oportunidad cambió; actualiza antes de guardar',
    );
}
export async function eventoCrm(
  tx: Prisma.TransactionClient,
  o: {
    id: number;
    etapa: crm_oportunidad_etapa;
    estado_tecnico: crm_oportunidad_estado_id;
  },
  u: Usuario,
  accion: crm_oportunidad_historial_accion,
  nota: string,
  data: Prisma.crm_oportunidadesUncheckedUpdateInput = {},
) {
  const nuevo = await tx.crm_oportunidades.update({
    where: { id: o.id },
    data: { ...data, version: { increment: 1 } },
  });
  await tx.crm_oportunidad_historial.create({
    data: {
      oportunidad_id: o.id,
      accion,
      nota,
      realizado_por: u.usuario,
      etapa_anterior: o.etapa,
      etapa_nueva: nuevo.etapa,
      estado_tecnico_anterior: o.estado_tecnico,
      estado_tecnico_nuevo: nuevo.estado_tecnico,
      proximo_contacto: nuevo.proximo_contacto,
    },
  });
  return nuevo;
}
// Un análisis nuevo invalida la habilitación comercial; conserva documentos previos.
export async function reiniciarTecnico(
  tx: Prisma.TransactionClient,
  o: Awaited<ReturnType<typeof bloquearOportunidad>>,
  u: Usuario,
  nota: string,
) {
  abierta(o);
  await tx.id_reportes_oportunidad.updateMany({
    where: { oportunidad_id: o.id, estado: 'PUBLICADO' },
    data: { estado: 'ANULADO', anulado_en: new Date(), motivo_anulacion: nota },
  });
  await tx.crm_cotizaciones.updateMany({
    where: {
      oportunidad_id: o.id,
      estado: { in: ['BORRADOR', 'ENVIADA', 'ACEPTADA'] },
    },
    data: { estado: 'CANCELADA' },
  });
  return eventoCrm(tx, o, u, 'MUESTRA_ASOCIADA', nota, {
    etapa: 'EN_ANALISIS_ID',
    estado_tecnico: 'EN_ANALISIS',
  });
}
export function fechaCrm(v: unknown, required = false): Date | null {
  if (v == null || v === '') {
    if (required) throw new BadRequestException('Fecha requerida');
    return null;
  }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v))
    throw new BadRequestException('Fecha inválida');
  const d = new Date(v);
  if (!Number.isFinite(+d)) throw new BadRequestException('Fecha inválida');
  return d;
}
export function decimalCrm(v: unknown, scale = 2, allowZero = false) {
  const s = String(v ?? '');
  if (!new RegExp(`^\\d{1,12}(\\.\\d{1,${scale}})?$`).test(s))
    throw new BadRequestException('Importe o cantidad inválida');
  const n = new Prisma.Decimal(s);
  if (n.lt(0) || (!allowZero && n.eq(0)))
    throw new BadRequestException('El valor debe ser positivo');
  return n;
}
export function recurrencia(fechas: Date[], esperada: number | null) {
  const ds = fechas.map(Number).sort((a, b) => a - b),
    intervalos = ds.slice(1).map((d, i) => (d - ds[i]) / 86400000);
  const media = intervalos.length
    ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length
    : null;
  const cv =
    media && intervalos.length
      ? Math.sqrt(
          intervalos.reduce((s, v) => s + (v - media) ** 2, 0) /
            intervalos.length,
        ) / media
      : 0;
  const suficiente = ds.length >= 3,
    irregular = suficiente && cv > 0.35;
  return {
    ordenes: ds.length,
    ultima_compra: ds.length ? new Date(ds.at(-1)!) : null,
    intervalo_dias: media,
    frecuencia_observada: !suficiente
      ? 'DATOS_INSUFICIENTES'
      : irregular
        ? 'IRREGULAR'
        : media! <= 40
          ? 'MENSUAL'
          : media! <= 80
            ? 'BIMESTRAL'
            : media! <= 120
              ? 'TRIMESTRAL'
              : media! <= 210
                ? 'SEMESTRAL'
                : 'OTRA',
    proxima_compra_estimada:
      suficiente && !irregular && media
        ? new Date(ds.at(-1)! + media * 86400000)
        : null,
    frecuencia_esperada_dias: esperada,
  };
}
