export type Row = Record<string, any>;
export interface Filters {
  year: number;
  from: number;
  to: number;
  cutoff: string;
  area: number | null;
  indicator: number | null;
  mode: "oficial" | "preliminar";
  comparison: boolean;
}
export const iso = (v: unknown): string =>
  v instanceof Date
    ? v.toISOString().slice(0, 10)
    : String(v ?? "").slice(0, 10);
export const num = (v: unknown): number | null =>
  v === null || v === undefined || v === ""
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;
export function json(v: unknown): any {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}
const date = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
export const addDays = (v: string, days: number) => {
  const d = new Date(v + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
export function parseFilters(q: Row): Filters {
  const integer = (v: unknown, fallback: number, min: number, max: number) => {
    if (v === undefined || v === "") return fallback;
    if (!/^\d+$/.test(String(v)))
      throw Error("Los filtros numéricos deben ser enteros.");
    const n = Number(v);
    if (n < min || n > max) throw Error("Filtro numérico fuera de rango.");
    return n;
  };
  const now = iso(new Date());
  const year = integer(q.year, new Date().getUTCFullYear(), 2000, 2100);
  const from = integer(q.from, 1, 1, 12),
    to = integer(q.to, 12, 1, 12);
  if (from > to) throw Error("El mes inicial no puede superar al final.");
  const cutoff = String(q.cutoff || now);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(cutoff) ||
    !Number.isFinite(Date.parse(cutoff + "T00:00:00Z")) ||
    iso(new Date(cutoff + "T00:00:00Z")) !== cutoff ||
    cutoff > now
  )
    throw Error("Fecha de corte inválida o futura.");
  const mode = q.mode ?? "oficial";
  if (!["oficial", "preliminar"].includes(mode)) throw Error("Modo inválido.");
  if (q.comparison !== undefined && !["0", "1"].includes(String(q.comparison)))
    throw Error("Comparación inválida.");
  return {
    year,
    from,
    to,
    cutoff,
    mode,
    area: q.area ? integer(q.area, 0, 1, 2147483647) : null,
    indicator: q.indicator ? integer(q.indicator, 0, 1, 2147483647) : null,
    comparison: String(q.comparison) === "1",
  };
}
// Comparar DECIMAL(18,6) sin redondearlo a double. Number se usa sólo para gráficas.
function decimalUnits(v: unknown): bigint | null {
  if (v === null || v === undefined || v === "") return null;
  const m = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(v));
  if (!m) return null;
  const digits = m[2] + (m[3] ?? ""),
    power = 6 + Number(m[4] ?? 0) - (m[3]?.length ?? 0);
  if (Math.abs(power) > 100) return null;
  const n = BigInt(digits);
  return (
    (m[1] === "-" ? -1n : 1n) *
    (power >= 0 ? n * 10n ** BigInt(power) : n / 10n ** BigInt(-power))
  );
}
export function evaluate(
  c: Row,
  r: Row | null,
): "CUMPLE" | "NO_CUMPLE" | "NO_EVALUABLE" {
  if (!r || ["PENDIENTE", "NO_APLICA"].includes(r.estado))
    return "NO_EVALUABLE";
  if (c.tipo_dato === "BOOLEANO")
    return r.valor_booleano == null
      ? "NO_EVALUABLE"
      : Number(r.valor_booleano) === Number(c.meta_booleano)
        ? "CUMPLE"
        : "NO_CUMPLE";
  if (c.tipo_dato === "OPCION")
    return r.valor_opcion == null
      ? "NO_EVALUABLE"
      : r.valor_opcion === c.meta_opcion
        ? "CUMPLE"
        : "NO_CUMPLE";
  const v = decimalUnits(r.valor_numerico),
    lo = decimalUnits(c.meta_minima),
    hi = decimalUnits(c.meta_maxima);
  if (v === null) return "NO_EVALUABLE";
  const ok =
    c.regla_evaluacion === "MAYOR_IGUAL" && lo !== null
      ? v >= lo
      : c.regla_evaluacion === "MENOR_IGUAL" && hi !== null
        ? v <= hi
        : c.regla_evaluacion === "ENTRE" && lo !== null && hi !== null
          ? v >= lo && v <= hi
          : c.regla_evaluacion === "IGUAL" && lo !== null
            ? v === lo
            : null;
  return ok === null ? "NO_EVALUABLE" : ok ? "CUMPLE" : "NO_CUMPLE";
}
export function target(c: Row): string {
  if (c.tipo_dato === "BOOLEANO")
    return Number(c.meta_booleano) === 1 ? "Sí" : "No";
  if (c.tipo_dato === "OPCION") return String(c.meta_opcion ?? "—");
  const unit = c.unidad ?? "";
  return c.regla_evaluacion === "ENTRE"
    ? `${num(c.meta_minima)}–${num(c.meta_maxima)} ${unit}`
    : `${({ MAYOR_IGUAL: "≥", MENOR_IGUAL: "≤", IGUAL: "=" } as Row)[c.regla_evaluacion] ?? ""} ${num(c.meta_minima) ?? num(c.meta_maxima) ?? "—"} ${unit}`;
}
export function buildDashboard(
  indicators: Row[],
  configs: Row[],
  results: Row[],
  f: Filters,
) {
  const start = date(f.year, f.from, 1),
    end = date(f.year, f.to + 1, 0);
  const rows = indicators
    .filter(
      (i) =>
        (!f.area || i.area_id === f.area) &&
        (!f.indicator || i.id_Indicador === f.indicator),
    )
    .map((i) => {
      const cs = configs.filter((c) => c.indicador_id === i.id_Indicador),
        rs = results.filter((r) => r.indicador_id === i.id_Indicador);
      const warnings: string[] = [];
      const slots = new Map<
        string,
        { start: string; end: string; configs: Row[] }
      >();
      for (const c of cs) {
        const months = (
          { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 } as Row
        )[c.periodicidad];
        if (!months) {
          warnings.push("Periodicidad no reconocida.");
          continue;
        }
        for (let m = 1; m <= 12; m += months) {
          const a = date(f.year, m, 1),
            b = date(f.year, m + months, 0);
          if (
            a < start ||
            b > end ||
            a < iso(i.activo_desde) ||
            (i.activo_hasta && b > iso(i.activo_hasta))
          )
            continue;
          if (
            a < iso(c.vigente_desde) ||
            (c.vigente_hasta && b > iso(c.vigente_hasta))
          ) {
            if (
              b >= iso(c.vigente_desde) &&
              (!c.vigente_hasta || a <= iso(c.vigente_hasta))
            )
              warnings.push(
                `Configuración v${c.version} cambia dentro del periodo ${a}–${b}; revisar calendario.`,
              );
            continue;
          }
          const key = a + "|" + b,
            slot = slots.get(key) ?? { start: a, end: b, configs: [] };
          slot.configs.push(c);
          slots.set(key, slot);
        }
      }
      // Mostrar datos históricos que no encajen en la programación; excluirlos de estadísticas.
      for (const r of rs) {
        const a = iso(r.periodo_inicio),
          b = iso(r.periodo_fin);
        if (a >= start && b <= end && !slots.has(a + "|" + b))
          slots.set(a + "|" + b, { start: a, end: b, configs: [] });
      }
      const entries = [...slots.values()].sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      const cells = entries.map((slot) => {
        const found = rs.filter(
          (r) =>
            iso(r.periodo_inicio) === slot.start &&
            iso(r.periodo_fin) === slot.end,
        );
        const r = found.length === 1 ? found[0] : null;
        const linked = r
          ? cs.find((c) => c.id_Configuracion === r.configuracion_id)
          : undefined;
        const c = linked ?? slot.configs[0];
        const overlap = entries.some(
          (other) =>
            other !== slot &&
            other.start <= slot.end &&
            other.end >= slot.start,
        );
        const valid =
          slot.configs.length === 1 &&
          found.length <= 1 &&
          !overlap &&
          (!r || r.configuracion_id === slot.configs[0].id_Configuracion);
        if (!valid)
          warnings.push(
            `Revisar configuración/periodo ${slot.start}–${slot.end}; excluido de estadísticas.`,
          );
        const due =
          iso(r?.fecha_limite_captura) ||
          addDays(slot.end, Number(c?.dias_limite_captura ?? 0));
        const approved =
          r?.estado === "APROBADO" && !!r.revisado_por && !!r.revisado_en;
        const na =
          r?.estado === "NO_APLICA" &&
          !!r.revisado_por &&
          !!r.revisado_en &&
          !!String(r.justificacion_no_aplica ?? "").trim();
        const visible =
          !!r && (approved || f.mode === "preliminar") && slot.end <= f.cutoff;
        const ev = visible && c ? evaluate(c, r) : "NO_EVALUABLE";
        return {
          start: slot.start,
          end: slot.end,
          due,
          resultId: r?.id_Resultado ?? null,
          configId: c?.id_Configuracion ?? null,
          state: r?.estado ?? (slot.end > f.cutoff ? "EN_CURSO" : "SIN_DATO"),
          approved,
          na,
          valid,
          eligible: valid && !!i.activo && due <= f.cutoff && !na,
          visible,
          value: visible
            ? c?.tipo_dato === "NUMERICO"
              ? num(r?.valor_numerico)
              : c?.tipo_dato === "BOOLEANO"
                ? Number(r?.valor_booleano) === 1
                  ? "Sí"
                  : "No"
                : (r?.valor_opcion ?? null)
            : null,
          evaluation: ev,
          unit: c?.unidad ?? "",
          target: c ? target(c) : "Sin configuración",
          min: num(c?.meta_minima),
          max: num(c?.meta_maxima),
          type: c?.tipo_dato ?? "NUMERICO",
          rule: c?.regla_evaluacion ?? "",
          precision: Number(c?.decimales ?? 2),
          version: c?.version ?? null,
          evidenceCount: Number(r?.evidencias ?? 0),
          analysis: visible ? (r?.analisis ?? null) : null,
          actions: visible ? (r?.acciones_propuestas ?? null) : null,
          observations: visible ? (r?.observaciones ?? null) : null,
          method: c?.metodo_calculo ?? null,
          formula: c?.formula_descriptiva ?? null,
          source: c?.fuente_datos ?? null,
        };
      });
      for (let m = f.from; m <= f.to; m++) {
        const a = date(f.year, m, 1),
          b = date(f.year, m + 1, 0);
        if (
          a >= iso(i.activo_desde) &&
          (!i.activo_hasta || b <= iso(i.activo_hasta)) &&
          !cs.some(
            (c) =>
              iso(c.vigente_desde) <= a &&
              (!c.vigente_hasta || iso(c.vigente_hasta) >= b),
          )
        )
          warnings.push(
            `Sin configuración que cubra completamente ${a.slice(0, 7)}.`,
          );
      }
      if (!cs.length)
        warnings.push(
          "Sin configuración: falta definir meta, unidad o periodicidad.",
        );
      if (cs.length && !cells.length)
        warnings.push(
          "No hay periodos completos configurados dentro del rango elegido.",
        );
      return {
        id: i.id_Indicador,
        code: i.codigo,
        name: i.nombre,
        areaId: i.area_id,
        area: i.area,
        active: !!i.activo,
        objective: i.objetivo,
        cells,
        warnings: [...new Set(warnings)],
      };
    });
  const summarize = (list: typeof rows) => {
    const due = list.flatMap((i) => i.cells.filter((c) => c.eligible));
    const official = due.filter((c) => c.approved),
      evaluated = official.filter((c) => c.evaluation !== "NO_EVALUABLE");
    const met = evaluated.filter((c) => c.evaluation === "CUMPLE").length;
    const prelim = due.filter(
      (c) => c.visible && c.evaluation !== "NO_EVALUABLE",
    );
    return {
      expected: due.length,
      approved: official.length,
      evaluated: evaluated.length,
      met,
      failed: evaluated.length - met,
      pending: due.length - official.length,
      compliance: evaluated.length ? (100 * met) / evaluated.length : null,
      coverage: due.length ? (100 * official.length) / due.length : null,
      preliminaryEvaluated: prelim.length,
      preliminaryCompliance: prelim.length
        ? (100 * prelim.filter((c) => c.evaluation === "CUMPLE").length) /
          prelim.length
        : null,
    };
  };
  const areas = [...new Set(rows.map((i) => i.areaId))].map((id) => ({
    id,
    name: rows.find((i) => i.areaId === id)!.area,
    ...summarize(rows.filter((i) => i.areaId === id)),
  }));
  return {
    filters: f,
    generatedAt: new Date().toISOString(),
    summary: summarize(rows),
    areas,
    rows,
    pendingConfiguration: rows.filter((i) => !i.active || i.warnings.length > 0)
      .length,
    notes: [
      "Resumen oficial: únicamente indicadores activos y mediciones exigibles al corte.",
      "Cumplimiento por medición, sin ponderación: no es una calificación ISO ni un ranking anual de KPIs.",
      "Periodos completos contenidos en el rango; un semestre no se divide en meses.",
      "La fecha de corte delimita exigibilidad; el estado de aprobación es el actual, no una reconstrucción histórica.",
    ],
  };
}
