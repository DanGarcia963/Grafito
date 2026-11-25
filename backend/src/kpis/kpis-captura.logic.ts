import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addDays, evaluate, iso } from './kpis.logic';

type Configuracion = {
  id_Configuracion: number;
  indicador_id: number;
  vigente_desde: Date;
  vigente_hasta: Date | null;
  periodicidad: string;
  tipo_dato: string;
  decimales: number;
  unidad: string;
  metodo_calculo: string;
  opciones_permitidas: string | null;
  dias_limite_captura: number;
  requiere_evidencia: boolean;
  regla_evaluacion: string;
  meta_minima: Prisma.Decimal | null;
  meta_maxima: Prisma.Decimal | null;
  meta_booleano: boolean | null;
  meta_opcion: string | null;
};
export type RegistroHistorico = {
  indicador_id: number;
  periodo_inicio: string;
  periodo_fin: string;
  configuracion_id: number;
  valor: string;
  fuente: string;
  fecha_documento: string | null;
  datos_base: string | null;
  observaciones: string | null;
  analisis: string | null;
  acciones_propuestas: string | null;
  justificacion_no_aplica: string | null;
  motivo: string;
  estado: 'BORRADOR' | 'EN_REVISION';
  revision_esperada: number;
};

export function fechaValida(value: unknown): string {
  const s = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException('Fecha inválida.');
  const d = new Date(s + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime()) || iso(d) !== s)
    throw new BadRequestException('Fecha inválida.');
  return s;
}
export function periodoConfigurado(
  config: Configuracion,
  inicio: string,
  fin: string,
  indicador: { activo_desde: Date; activo_hasta: Date | null },
) {
  const meses: Record<string, number> = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };
  const mesesPeriodo = meses[config.periodicidad];
  if (!mesesPeriodo) throw new BadRequestException('Periodicidad no reconocida.');
  const start = fechaValida(inicio), end = fechaValida(fin);
  const d = new Date(start + 'T00:00:00.000Z');
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  if (start !== new Date(Date.UTC(y, m-1, 1)).toISOString().slice(0,10) ||
      (m-1) % mesesPeriodo !== 0) {
    throw new BadRequestException('El periodo no coincide con el inicio de la periodicidad del indicador.');
  }
  const finCorrecto = new Date(Date.UTC(y, m-1 + mesesPeriodo, 0))
    .toISOString().slice(0,10);
  if (end !== finCorrecto || Number(end.slice(0,4)) !== y) {
    throw new BadRequestException('El periodo no corresponde a un mes/trimestre/semestre/año completo.');
  }
  if (start < iso(config.vigente_desde) ||
      (config.vigente_hasta && end > iso(config.vigente_hasta)) ||
      start < iso(indicador.activo_desde) ||
      (indicador.activo_hasta && end > iso(indicador.activo_hasta))) {
    throw new ConflictException('La configuración o el indicador no estaban vigentes durante todo el periodo.');
  }
  // Los resultados históricos son periodos completados, nunca futuros.
  const p = new Intl.DateTimeFormat('en-US', {timeZone:'America/Mexico_City',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const parte = (tipo: string) => p.find(x=>x.type===tipo)?.value || '';
  const fechaHoy = parte('year')+'-'+parte('month')+'-'+parte('day');
  if (end > fechaHoy) throw new ConflictException('No se puede registrar un periodo que aún no termina.');
  return { inicio: start, fin: end,
    limite: addDays(end, Math.max(0, Math.min(365, config.dias_limite_captura))) };
}
function campo(v: unknown, max: number): string | null {
  const s=String(v ?? '').trim();
  if (s.length > max) throw new BadRequestException('Un campo de texto supera la longitud permitida.');
  return s || null;
}
function parseJson(v: unknown, max=16000): string | null {
  const s=campo(v,max);
  if (!s) return null;
  try {
    const j=JSON.parse(s);
    if (j === null || typeof j!=='object' || Array.isArray(j))
      throw new Error();
    return JSON.stringify(j);
  } catch { throw new BadRequestException('Los datos base deben ser un objeto JSON válido.'); }
}
function opciones(config: Configuracion): string[] | null {
  if (!config.opciones_permitidas?.trim()) return null;
  try {
    const parsed=JSON.parse(config.opciones_permitidas);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed && Array.isArray(parsed.opciones)) return parsed.opciones.map(String);
  } catch { /* También se admiten catálogos CSV heredados. */ }
  return config.opciones_permitidas.split(/[\n,;]/).map(x=>x.trim()).filter(Boolean);
}
export function validarCapturaHistorica(
  raw: Record<string,unknown>, config: Configuracion,
): RegistroHistorico & {
  valor_numerico: Prisma.Decimal | null;
  valor_booleano: boolean | null;
  valor_opcion: string | null;
  evaluacion: 'CUMPLE' | 'NO_CUMPLE' | 'NO_EVALUABLE';
} {
  const indicadorId=Number(raw.indicador_id),
    configuracionId=Number(raw.configuracion_id);
  if (!Number.isSafeInteger(indicadorId) || indicadorId<=0 ||
      configuracionId!==config.id_Configuracion || indicadorId!==config.indicador_id)
    throw new BadRequestException('Indicador o versión de configuración inválidos.');
  const revision=Number(raw.revision_esperada);
  if (!Number.isSafeInteger(revision) || revision<0)
    throw new BadRequestException('Revisión inválida. Actualiza el calendario.');
  const estado=raw.estado;
  if (estado!=='BORRADOR' && estado!=='EN_REVISION')
    throw new BadRequestException('Estado de registro inválido.');
  const fuente=campo(raw.fuente,2000);
  if (!fuente || fuente.length<5) throw new BadRequestException('Describe la fuente histórica del resultado (mínimo 5 caracteres).');
  const fechaDocumento=raw.fecha_documento ? fechaValida(raw.fecha_documento) : null;
  const motivo=campo(raw.motivo,2000) ?? 'Captura histórica desde el calendario de KPIs.';
  const observaciones=campo(raw.observaciones,5000);
  const analisis=campo(raw.analisis,5000);
  const acciones=campo(raw.acciones_propuestas,5000);
  const datosBase=parseJson(raw.datos_base);
  const noAplica=raw.no_aplica===true || raw.no_aplica==='true';
  const justificacion=campo(raw.justificacion_no_aplica,3000);
  if(noAplica && (!justificacion || justificacion.length<15))
    throw new BadRequestException('Un periodo no aplicable necesita justificación de al menos 15 caracteres.');
  const valor=String(raw.valor ?? '').trim();
  let numerico: Prisma.Decimal | null=null, booleano: boolean | null=null, opcion: string | null=null;
  if(noAplica) {
    // Conservar valores nulos, sin crear mediciones ficticias.
  } else if(config.tipo_dato==='NUMERICO') {
    if (!/^[+-]?\d{1,12}(?:\.\d{1,6})?$/.test(valor))
      throw new BadRequestException('Escribe un valor numérico válido, máximo 6 decimales.');
    numerico=new Prisma.Decimal(valor);
    if (numerico.decimalPlaces()>Math.min(6,Math.max(0,config.decimales)))
      throw new BadRequestException('El valor excede la precisión configurada del indicador.');
    if(config.metodo_calculo!=='DIRECTO' && !datosBase)
      throw new BadRequestException('Este indicador utiliza un cálculo; documenta los datos base en JSON.');
  } else if(config.tipo_dato==='BOOLEANO') {
    if(valor!=='true' && valor!=='false')
      throw new BadRequestException('Selecciona Sí o No.');
    booleano=valor==='true';
  } else if(config.tipo_dato==='OPCION') {
    const permitidas=opciones(config);
    if(!valor || valor.length>100 || !permitidas?.includes(valor))
      throw new BadRequestException('Selecciona una opción configurada para el indicador.');
    opcion=valor;
  } else throw new BadRequestException('Tipo de indicador incompatible con captura manual.');
  const evaluacion=noAplica ? 'NO_EVALUABLE' : evaluate(config as any,{
    estado,valor_numerico:numerico,valor_booleano:booleano,valor_opcion:opcion,
  });
  if (estado==='EN_REVISION') {
    if (!noAplica && evaluacion==='NO_EVALUABLE')
      throw new BadRequestException('La medición no es evaluable; revisa valor y meta.');
    if (!noAplica && evaluacion==='NO_CUMPLE' && (!analisis || !acciones))
      throw new BadRequestException('Una desviación requiere análisis y acciones propuestas antes de enviarse.');
  }
  return {
    indicador_id:indicadorId,configuracion_id:configuracionId,
    periodo_inicio:fechaValida(raw.periodo_inicio),
    periodo_fin:fechaValida(raw.periodo_fin),
    valor,fuente,fecha_documento:fechaDocumento,datos_base:datosBase,
    observaciones,analisis,acciones_propuestas:acciones,
    justificacion_no_aplica:noAplica?justificacion:null,motivo,estado,
    revision_esperada:revision,valor_numerico:numerico,
    valor_booleano:booleano,valor_opcion:opcion,evaluacion,
  };
}
