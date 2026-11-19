/**
 * Agregaciones del dashboard de grafito.
 * Los saldos se toman de ubicaciones físicas; reservas, traslados y órdenes
 * planificadas no se cuentan como material ingresado o transformado.
 */
export const PRENSAS_GRAFITO = ['Fagor', 'Forgemaster', 'Polymaster'] as const;
export type PrensaGrafito = (typeof PRENSAS_GRAFITO)[number];
export type EtapaGrafito = 'SUCIO' | 'PROCESANDO' | 'LIBERADO';

export type LoteGrafica = {
  id: number;
  unidad: string;
  condicion: string;
  origen: string;
  especificaciones: unknown;
  lote_produccion_id: number | null;
};
export type MovimientoGrafica = {
  id_Movi_Invent: number;
  lote_inventario_id: number;
  lote_produccion_id: number | null;
  reversa_de_id: number | null;
  tipo: string;
  cantidad: unknown;
  ubicacion_origen_id: number | null;
  ubicacion_destino_id: number | null;
  fecha: Date | string;
};
export type ProduccionGrafica = {
  id_Lote_Produccion: number;
  estado: string;
  estado_Calida: string;
};
export type AnilloVuelta = {
  etapa: EtapaGrafito;
  prensa: PrensaGrafito;
  maxVuelta: number | null;
  vueltasDetectadas: number[];
  kg: number;
  sinVueltaKg: number;
  limite: number;
  excedida: boolean;
};
export type GraficasGrafito = {
  unidad: 'Kilogramos';
  estadoActual: Array<{ clave: EtapaGrafito; etiqueta: string; kg: number }>;
  acumulados: Array<{ clave: 'ENTRADAS' | 'LIBERADO'; etiqueta: string; kg: number }>;
  anillosVueltas: AnilloVuelta[];
  sinPrensaKg: Record<EtapaGrafito, number>;
  sinVueltaKg: Record<EtapaGrafito, number>;
  lotesConSaldoNegativo: number;
  alcance: {
    estadoActual: string;
    acumulados: string;
    nota: string;
  };
};

const ETAPAS: EtapaGrafito[] = ['SUCIO', 'PROCESANDO', 'LIBERADO'];
const LIMITE = 10;

function cantidad(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
export function identificarPrensa(especificaciones: unknown): PrensaGrafito | null {
  const attrs = (especificaciones as { atributos?: { tipo_prensa?: unknown } } | null)?.atributos;
  const prensa = String(attrs?.tipo_prensa ?? '').toLowerCase().trim();
  if (prensa === 'fagor') return 'Fagor';
  if (prensa === 'forgemaster') return 'Forgemaster';
  if (prensa === 'polymaster') return 'Polymaster';
  return null;
}
/** Acepta 4, "4TA", "7MA", "8VA", "10MA", etc.; no inventa vueltas ausentes. */
export function identificarVuelta(especificaciones: unknown): number | null {
  const attrs = (especificaciones as { atributos?: { numero_vuelta?: unknown } } | null)?.atributos;
  const valor = String(attrs?.numero_vuelta ?? '').trim().toUpperCase();
  const match = /^([1-9]\d?)(?:\s*(?:RA|DA|TA|VA|MA))?$/.exec(valor);
  return match ? Number(match[1]) : null;
}
function vigenteEnPeriodo(fecha: Date | string, desde?: Date | null, hastaExclusivo?: Date | null): boolean {
  const instante = new Date(fecha).getTime();
  return Number.isFinite(instante) &&
    (!desde || instante >= desde.getTime()) &&
    (!hastaExclusivo || instante < hastaExclusivo.getTime());
}

export function calcularGraficasGrafito(
  lotes: LoteGrafica[],
  movimientos: MovimientoGrafica[],
  produccion: ProduccionGrafica[],
  desde?: Date | null,
  hastaExclusivo?: Date | null,
): GraficasGrafito {
  const lotesKg = lotes.filter(l => l.unidad === 'Kilogramos');
  const porId = new Map(lotesKg.map(l => [l.id, l]));
  const estadosLP = new Map(produccion.map(lp => [lp.id_Lote_Produccion, lp]));
  const revertidos = new Set(movimientos
    .filter(m => m.reversa_de_id != null)
    .map(m => m.reversa_de_id!));
  const movimientosPorLote = new Map<number, MovimientoGrafica[]>();
  const movimientosValidos: MovimientoGrafica[] = [];
  for (const m of movimientos) {
    if (!porId.has(m.lote_inventario_id)) continue;
    const lista = movimientosPorLote.get(m.lote_inventario_id) ?? [];
    lista.push(m);
    movimientosPorLote.set(m.lote_inventario_id, lista);
    if (m.tipo !== 'REVERSION' && !revertidos.has(m.id_Movi_Invent)) {
      movimientosValidos.push(m);
    }
  }

  const estadoKg: Record<EtapaGrafito, number> = { SUCIO: 0, PROCESANDO: 0, LIBERADO: 0 };
  const sinPrensaKg: Record<EtapaGrafito, number> = { SUCIO: 0, PROCESANDO: 0, LIBERADO: 0 };
  const sinVueltaKg: Record<EtapaGrafito, number> = { SUCIO: 0, PROCESANDO: 0, LIBERADO: 0 };
  const anillos = new Map<string, AnilloVuelta>();
  const vueltas = new Map<string, Set<number>>();
  for (const etapa of ETAPAS) {
    for (const prensa of PRENSAS_GRAFITO) {
      const key = etapa + ':' + prensa;
      anillos.set(key, {
        etapa, prensa, maxVuelta: null, vueltasDetectadas: [],
        kg: 0, sinVueltaKg: 0, limite: LIMITE, excedida: false,
      });
      vueltas.set(key, new Set<number>());
    }
  }
  const agregar = (etapa: EtapaGrafito, lote: LoteGrafica, kg: number) => {
    if (kg <= 0) return;
    estadoKg[etapa] += kg;
    const prensa = identificarPrensa(lote.especificaciones);
    const vuelta = identificarVuelta(lote.especificaciones);
    if (vuelta == null) sinVueltaKg[etapa] += kg;
    if (!prensa) {
      sinPrensaKg[etapa] += kg;
      return;
    }
    const key = etapa + ':' + prensa;
    const anillo = anillos.get(key)!;
    anillo.kg += kg;
    if (vuelta == null) {
      anillo.sinVueltaKg += kg;
    } else {
      anillo.maxVuelta = Math.max(anillo.maxVuelta ?? 0, vuelta);
      vueltas.get(key)!.add(vuelta);
    }
  };
  const esLiberado = (lote: LoteGrafica) => {
    if (lote.origen !== 'PRODUCCION' ||
      !['REGENERADO', 'TERMINADO'].includes(lote.condicion) ||
      lote.lote_produccion_id == null) return false;
    const lp = estadosLP.get(lote.lote_produccion_id);
    return lp?.estado === 'FINALIZADO' && lp.estado_Calida === 'LIBERADO';
  };

  let lotesConSaldoNegativo = 0;
  for (const lote of lotesKg) {
    let saldo = 0;
    for (const m of movimientosPorLote.get(lote.id) ?? []) {
      const kg = cantidad(m.cantidad);
      if (m.ubicacion_origen_id == null && m.ubicacion_destino_id != null) saldo += kg;
      else if (m.ubicacion_origen_id != null && m.ubicacion_destino_id == null) saldo -= kg;
      // Transferencia: cambia ubicación, no existencia.
    }
    if (saldo < -0.0001) lotesConSaldoNegativo++;
    if (saldo <= 0) continue;
    if (lote.condicion === 'SUCIO') agregar('SUCIO', lote, saldo);
    else if (esLiberado(lote)) agregar('LIBERADO', lote, saldo);
  }

  let entradas = 0;
  let liberadoAcumulado = 0;
  for (const m of movimientosValidos) {
    const lote = porId.get(m.lote_inventario_id)!;
    const kg = cantidad(m.cantidad);
    if (m.tipo === 'SALIDA_CONSUMO' && m.lote_produccion_id != null) {
      const lp = estadosLP.get(m.lote_produccion_id);
      if (lp?.estado === 'EN_PROCESO' || lp?.estado === 'PENDIENTE') {
        // Cantidad física consumida; no contar órdenes, reservas ni litros.
        agregar('PROCESANDO', lote, kg);
      }
    }
    if (!vigenteEnPeriodo(m.fecha, desde, hastaExclusivo)) continue;
    if (m.tipo === 'ENTRADA_RECEPCION' && lote.origen === 'RECEPCION') entradas += kg;
    if (m.tipo === 'ENTRADA_PRODUCCION' && esLiberado(lote)) liberadoAcumulado += kg;
  }
  const anillosVueltas = [...anillos.entries()].map(([key, a]) => ({
    ...a,
    kg: redondear(a.kg),
    sinVueltaKg: redondear(a.sinVueltaKg),
    vueltasDetectadas: [...vueltas.get(key)!].sort((x, y) => x - y),
    excedida: a.maxVuelta != null && a.maxVuelta > LIMITE,
  }));
  return {
    unidad: 'Kilogramos',
    estadoActual: [
      { clave: 'SUCIO', etiqueta: 'Inventario sucio', kg: redondear(estadoKg.SUCIO) },
      { clave: 'PROCESANDO', etiqueta: 'En proceso', kg: redondear(estadoKg.PROCESANDO) },
      { clave: 'LIBERADO', etiqueta: 'Liberado en inventario', kg: redondear(estadoKg.LIBERADO) },
    ],
    acumulados: [
      { clave: 'ENTRADAS', etiqueta: 'Entradas acumuladas', kg: redondear(entradas) },
      { clave: 'LIBERADO', etiqueta: 'Liberado acumulado', kg: redondear(liberadoAcumulado) },
    ],
    anillosVueltas,
    sinPrensaKg: {
      SUCIO: redondear(sinPrensaKg.SUCIO),
      PROCESANDO: redondear(sinPrensaKg.PROCESANDO),
      LIBERADO: redondear(sinPrensaKg.LIBERADO),
    },
    sinVueltaKg: {
      SUCIO: redondear(sinVueltaKg.SUCIO),
      PROCESANDO: redondear(sinVueltaKg.PROCESANDO),
      LIBERADO: redondear(sinVueltaKg.LIBERADO),
    },
    lotesConSaldoNegativo,
    alcance: {
      estadoActual: 'Existencia al momento de consultar; incluye aperturas históricas. Procesando se basa en consumos hacia lotes activos.',
      acumulados: desde || hastaExclusivo
        ? 'Movimientos físicos registrados dentro del rango de fechas seleccionado.'
        : 'Movimientos físicos históricos registrados, sin límite de fecha.',
      nota: 'Entradas no incluyen aperturas ni ajustes. Liberado exige lote finalizado con dictamen LIBERADO; su acumulado incluye lo entregado después. No se suman inventario y procesado como si fueran etapas equivalentes de una misma unidad de producto.',
    },
  };
}
