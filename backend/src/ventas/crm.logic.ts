import { BadRequestException } from '@nestjs/common';

export const ETAPAS_CRM = [
  'RECOLECCION',
  'EN_ANALISIS',
  'COTIZACION',
  'VENTA_ASEGURADA',
  'VENTA_NO_ASEGURADA',
] as const;
export type EtapaCrm = (typeof ETAPAS_CRM)[number];
export const ENTIDAD_CRM = 'VENTA_MUESTRA';
export const ACCION_CRM = 'SEGUIMIENTO_COMERCIAL';

export function etapaValida(value: unknown): EtapaCrm {
  if (typeof value !== 'string' || !ETAPAS_CRM.includes(value as EtapaCrm))
    throw new BadRequestException('Etapa comercial inválida.');
  return value as EtapaCrm;
}
export function filtrosCrm(q: Record<string, unknown>) {
  const pagina = q.pagina === undefined ? 1 : Number(q.pagina);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000)
    throw new BadRequestException('Página inválida.');
  if (q.q !== undefined && (typeof q.q !== 'string' || q.q.length > 120))
    throw new BadRequestException('Búsqueda inválida (máximo 120 caracteres).');
  const fecha = (v: unknown) => {
    if (v === undefined || v === '') return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
      throw new BadRequestException('Usa fechas AAAA-MM-DD.');
    const d = new Date(v + 'T00:00:00.000Z');
    if (isNaN(+d) || d.toISOString().slice(0, 10) !== v)
      throw new BadRequestException('Fecha inválida.');
    return d;
  };
  const desde = fecha(q.desde),
    hasta = fecha(q.hasta);
  if (desde && hasta && desde > hasta)
    throw new BadRequestException('El inicio debe ser anterior al fin.');
  // Cohorte por fecha de recolección UTC, ambos días incluidos.
  const hastaExclusiva = hasta ? new Date(+hasta + 86400000) : null;
  return {
    pagina,
    busqueda: String(q.q ?? '').trim(),
    etapa: q.etapa ? etapaValida(q.etapa) : null,
    desde,
    hastaExclusiva,
  };
}
export function seguimientoValido(
  body: Record<string, unknown>,
  actual: { etapa: EtapaCrm; recibido: boolean },
) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Seguimiento inválido.');
  const etapa = etapaValida(body.etapa);
  if (!Number.isSafeInteger(body.version) || Number(body.version) < 0)
    throw new BadRequestException('Versión inválida. Recarga la oportunidad.');
  etapaValida(body.etapaActual);
  if (
    typeof body.nota !== 'string' ||
    !body.nota.trim() ||
    body.nota.trim().length > 4000
  )
    throw new BadRequestException(
      'Escribe una nota o motivo de seguimiento (hasta 4000 caracteres).',
    );
  if (etapa === 'RECOLECCION' && actual.recibido)
    throw new BadRequestException(
      'ID ya recibió la muestra. Usa En análisis o una etapa comercial posterior.',
    );
  if (etapa === 'EN_ANALISIS' && !actual.recibido)
    throw new BadRequestException(
      'ID debe recibir la muestra antes de pasar a En análisis.',
    );
  let proximoContacto: string | null = null;
  if (
    body.proximoContacto !== null &&
    body.proximoContacto !== undefined &&
    body.proximoContacto !== ''
  ) {
    if (
      typeof body.proximoContacto !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.proximoContacto)
    )
      throw new BadRequestException('Fecha de contacto inválida.');
    const d = new Date(body.proximoContacto);
    if (isNaN(+d)) throw new BadRequestException('Fecha de contacto inválida.');
    proximoContacto = d.toISOString();
  }
  if (etapa === 'VENTA_ASEGURADA' || etapa === 'VENTA_NO_ASEGURADA')
    proximoContacto = null;
  return { etapa, nota: body.nota.trim(), proximoContacto };
}
export function conversion(aseguradas: number, total: number) {
  return total ? Math.round((aseguradas / total) * 10000) / 100 : 0;
}
