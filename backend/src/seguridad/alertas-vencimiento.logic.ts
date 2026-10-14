export const MESES_ALERTA_VENCIMIENTO = [6, 4, 2, 1] as const;

export type MesesAlertaVencimiento = (typeof MESES_ALERTA_VENCIMIENTO)[number];

type FechaCalendario = string | Date;

function fechaISO(fecha: FechaCalendario): string {
  const valor =
    fecha instanceof Date
      ? fecha.toISOString().slice(0, 10)
      : fecha.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error(`Fecha de vencimiento inválida: ${String(fecha)}`);
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    comprobacion.getUTCFullYear() !== anio ||
    comprobacion.getUTCMonth() !== mes - 1 ||
    comprobacion.getUTCDate() !== dia
  ) {
    throw new Error(`Fecha de vencimiento inválida: ${String(fecha)}`);
  }
  return valor;
}

/** Resta meses calendario y limita el día al último del mes destino. */
export function fechaHitoVencimiento(
  fechaVencimiento: FechaCalendario,
  meses: number,
): string {
  const [anio, mes, dia] = fechaISO(fechaVencimiento).split('-').map(Number);
  const indiceMes = anio * 12 + (mes - 1) - meses;
  const anioDestino = Math.floor(indiceMes / 12);
  const mesDestino = ((indiceMes % 12) + 12) % 12;
  const ultimoDia = new Date(
    Date.UTC(anioDestino, mesDestino + 1, 0),
  ).getUTCDate();
  const diaDestino = Math.min(dia, ultimoDia);
  return `${anioDestino}-${String(mesDestino + 1).padStart(2, '0')}-${String(diaDestino).padStart(2, '0')}`;
}

/** Devuelve hitos pendientes, incluidos los que se retrasaron por una caída del servicio. */
export function hitosVencimientoPendientes(
  fechaVencimiento: FechaCalendario,
  hoy: FechaCalendario,
): MesesAlertaVencimiento[] {
  const vencimiento = fechaISO(fechaVencimiento);
  const fechaHoy = fechaISO(hoy);
  if (fechaHoy >= vencimiento) return [];

  return MESES_ALERTA_VENCIMIENTO.filter(
    (meses) => fechaHitoVencimiento(vencimiento, meses) <= fechaHoy,
  );
}

export function fechaActualEnZona(
  ahora = new Date(),
  zona = 'America/Mexico_City',
): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

function escaparHtml(valor: unknown): string {
  const texto =
    typeof valor === 'string'
      ? valor
      : typeof valor === 'number' || typeof valor === 'bigint'
        ? String(valor)
        : '';
  return texto.replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[caracter];
  });
}

function urlSegura(url: string): string {
  try {
    const parseada = new URL(url);
    if (parseada.protocol === 'https:' || parseada.protocol === 'http:') {
      return parseada.toString();
    }
  } catch {
    // Enlaces no válidos se omiten del correo.
  }
  return '';
}

function fechaLegible(fecha: FechaCalendario): string {
  const iso = fechaISO(fecha);
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

export interface DatosCorreoAlertaVencimiento {
  id: number;
  nombreTramite: string;
  area: string;
  responsable: string;
  proveedor: string;
  fechaVencimiento: FechaCalendario;
  mesesAnticipacion: MesesAlertaVencimiento;
  urlMatriz: string;
}

export function construirCorreoAlertaVencimiento(
  datos: DatosCorreoAlertaVencimiento,
) {
  const nombre = escaparHtml(datos.nombreTramite);
  const area = escaparHtml(datos.area);
  const responsable = escaparHtml(datos.responsable);
  const proveedor = escaparHtml(datos.proveedor || 'Sin proveedor registrado');
  const fecha = fechaISO(datos.fechaVencimiento);
  const fechaTexto = escaparHtml(fechaLegible(datos.fechaVencimiento));
  const hito = datos.mesesAnticipacion;
  const plazo = hito === 1 ? '1 mes' : `${hito} meses`;
  const link = urlSegura(datos.urlMatriz);
  const subject = `Matriz legal: ${String(datos.nombreTramite)
    .replace(/[\r\n]+/g, ' ')
    .trim()} vence en ${plazo}`;
  const boton = link
    ? `<p style="margin:28px 0 8px"><a href="${escaparHtml(link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">Abrir Matriz Legal</a></p>`
    : '';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden"><tr><td style="background:#0f172a;padding:24px 28px;border-bottom:4px solid #0e7490"><p style="margin:0 0 8px;color:#67e8f9;font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase">US Technologies · Seguridad y SHyMA</p><h1 style="margin:0;color:#ffffff;font-size:23px;line-height:1.3">Matriz Legal</h1><p style="margin:7px 0 0;color:#cbd5e1;font-size:14px">Aviso automático de vencimiento</p></td></tr><tr><td style="padding:28px"><div style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:700">Vence en ${hito === 1 ? '1 mes' : `${hito} meses`}</div><h2 style="margin:18px 0 8px;color:#0f172a;font-size:21px;line-height:1.35">${nombre}</h2><p style="margin:0 0 22px;color:#64748b;font-size:14px">Este trámite requiere seguimiento para mantener vigente la documentación legal.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px"><tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;width:38%">ID del registro</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600">${datos.id}</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Área</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600">${area}</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Fecha de vencimiento</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#b45309;font-size:14px;font-weight:700">${fechaTexto}</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Responsable interno</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px">${responsable}</td></tr><tr><td style="padding:13px 16px;color:#64748b;font-size:12px">Proveedor</td><td style="padding:13px 16px;color:#0f172a;font-size:14px">${proveedor}</td></tr></table>${boton}<p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6">Aviso correspondiente al hito de ${plazo} antes del vencimiento. El sistema registra cada hito enviado para evitar duplicados.</p></td></tr><tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;color:#94a3b8;font-size:11px">Mensaje automático de la Matriz Legal · US Technologies</td></tr></table></td></tr></table></body></html>`;
  const text = [
    'MATRIZ LEGAL · AVISO DE VENCIMIENTO',
    `ID del registro: ${datos.id}`,
    `Trámite: ${datos.nombreTramite}`,
    `Área: ${datos.area}`,
    `Vencimiento: ${fecha}`,
    `Hito: ${plazo} antes del vencimiento`,
    `Responsable: ${datos.responsable}`,
    `Proveedor: ${datos.proveedor || 'Sin proveedor registrado'}`,
    link ? `Abrir Matriz Legal: ${link}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, html, text };
}
