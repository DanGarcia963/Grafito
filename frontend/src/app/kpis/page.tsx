"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, apiFetch } from "./kpis.api";
import type {
  Catalog,
  Cell,
  Dashboard,
  Detail,
  Evidence,
  Filters,
  Indicator,
} from "./kpis.types";
import "./kpis.css";
const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const initial = (): Filters => ({
  year: String(new Date().getFullYear()),
  from: "1",
  to: "12",
  cutoff: localToday(),
  area: "",
  indicator: "",
  mode: "oficial",
  comparison: "0",
});
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const percent = (v: number | null) =>
  v === null ? "Sin base" : `${v.toFixed(1)}%`;
function period(c: Pick<Cell, "start" | "end">) {
  const a = Number(c.start.slice(5, 7)),
    b = Number(c.end.slice(5, 7));
  return a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]}–${MONTHS[b - 1]}`;
}
function value(c: Cell) {
  if (c.value === null) return "—";
  return typeof c.value === "number"
    ? `${c.value.toLocaleString("es-MX", { maximumFractionDigits: c.precision })} ${c.unit}`
    : String(c.value);
}
function state(c: Cell) {
  if (!c.valid) return "Revisar periodo";
  if (c.na) return "No aplica";
  if (c.state === "NO_APLICA") return "No aplica sin validar";
  if (!c.visible)
    return c.state === "APROBADO"
      ? "Posterior al corte"
      : c.state === "EN_CURSO"
        ? "En curso"
        : c.state === "SIN_DATO"
          ? "Sin dato"
          : c.state.replace(/_/g, " ");
  return `${c.approved ? "" : "Borrador · "}${c.evaluation === "CUMPLE" ? "Cumple" : c.evaluation === "NO_CUMPLE" ? "No cumple" : "No evaluable"}`;
}
function tone(c: Cell) {
  return !c.valid
    ? "amber"
    : !c.approved
      ? "neutral"
      : c.evaluation === "CUMPLE"
        ? "good"
        : c.evaluation === "NO_CUMPLE"
          ? "bad"
          : "neutral";
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="kpi-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header className="kpi-dialog-head">
        <h2>{title}</h2>
        <button onClick={onClose} autoFocus className="kpi-button">
          Cerrar
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function KpisPage() {
  const [filters, setFilters] = useState<Filters>(initial),
    [applied, setApplied] = useState<Filters | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({
    areas: [],
    indicators: [],
    years: [],
  });
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [presentation, setPresentation] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [resultId, setResultId] = useState<number | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [detailError, setDetailError] = useState("");
  const [file, setFile] = useState<{
      url: string;
      name: string;
      pdf: boolean;
    } | null>(null),
    [fileError, setFileError] = useState(""),
    [fileLoading, setFileLoading] = useState(false);
  const fileRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search),
      f = initial();
    for (const key of Object.keys(f) as (keyof Filters)[]) {
      const v = q.get(key);
      if (v !== null) (f as unknown as Record<string, string>)[key] = v;
    }
    setFilters(f);
    setApplied(f);
  }, []);
  useEffect(() => {
    const ac = new AbortController();
    setCatalogError("");
    api<Catalog>("catalogos", ac.signal)
      .then(setCatalog)
      .catch((e) => {
        if (!ac.signal.aborted) setCatalogError(e.message);
      });
    return () => ac.abort();
  }, [refresh]);
  useEffect(() => {
    if (!applied) return;
    const ac = new AbortController();
    setLoading(true);
    setError("");
    api<Dashboard>(
      "dashboard?" + new URLSearchParams({ ...applied }),
      ac.signal,
    )
      .then((d) => {
        if (ac.signal.aborted) return;
        setData(d);
        setSelected((old) =>
          d.rows.some((r) => r.id === old) ? old : (d.rows[0]?.id ?? null),
        );
      })
      .catch((e) => {
        if (!ac.signal.aborted) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [applied, refresh]);
  useEffect(() => {
    if (resultId === null) return;
    const ac = new AbortController();
    setDetail(null);
    setDetailError("");
    api<Detail>(`resultados/${resultId}`, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setDetail(d);
      })
      .catch((e) => {
        if (!ac.signal.aborted) setDetailError(e.message);
      });
    return () => ac.abort();
  }, [resultId]);
  useEffect(
    () => () => {
      if (file) URL.revokeObjectURL(file.url);
    },
    [file],
  );
  useEffect(() => () => fileRequest.current?.abort(), []);
  function closeDetail() {
    fileRequest.current?.abort();
    setFile(null);
    setFileError("");
    setFileLoading(false);
    setResultId(null);
  }
  function apply(f: Filters) {
    setFilters(f);
    setApplied({ ...f });
    setResultId(null);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${new URLSearchParams({ ...f })}`,
    );
  }
  async function openEvidence(e: Evidence) {
    fileRequest.current?.abort();
    const ac = new AbortController();
    fileRequest.current = ac;
    setFileLoading(true);
    setFileError("");
    setFile(null);
    try {
      const response = await apiFetch(`evidencias/${e.id}/archivo`, ac.signal);
      const blob = await response.blob();
      if (ac.signal.aborted) return;
      const head = await blob.slice(0, 5).text();
      if (ac.signal.aborted) return;
      setFile({
        url: URL.createObjectURL(blob),
        name: e.nombre,
        pdf: head === "%PDF-",
      });
    } catch (err) {
      if (!ac.signal.aborted)
        setFileError(
          err instanceof Error ? err.message : "Error al cargar archivo.",
        );
    } finally {
      if (!ac.signal.aborted) setFileLoading(false);
    }
  }
  const current = data?.rows.find((i) => i.id === selected) ?? null;
  const previous = data?.comparison?.rows.find((i) => i.id === selected);
  const chart = useMemo(
    () =>
      current?.cells.map((c) => {
        const old = previous?.cells.find(
          (p) =>
            p.start.slice(5) === c.start.slice(5) &&
            p.end.slice(5) === c.end.slice(5),
        );
        const compatible =
          !!old &&
          old.unit === c.unit &&
          old.type === c.type &&
          old.rule === c.rule &&
          old.method === c.method &&
          old.formula === c.formula;
        return {
          period: period(c),
          resultado: typeof c.value === "number" ? c.value : null,
          metaMin: c.min,
          metaMax: c.max,
          anterior:
            compatible && typeof old?.value === "number" ? old.value : null,
        };
      }) ?? [],
    [current, previous],
  );
  const periods = [
    ...new Map(
      (data?.rows ?? []).flatMap((i) =>
        i.cells.map((c) => [c.start + "|" + c.end, c] as const),
      ),
    ).values(),
  ].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  );
  const mixedUnits =
    new Set(
      current?.cells.filter((c) => c.type === "NUMERICO").map((c) => c.unit),
    ).size > 1;
  const trend = current?.cells.some((c) => c.type !== "NUMERICO")
    ? false
    : current?.cells.some((c) => /%|MXN|puntos/.test(c.unit));
  const draftChanged =
    !!applied && JSON.stringify(filters) !== JSON.stringify(applied);
  return (
    <main className={`kpi-app ${presentation ? "kpi-presentation" : ""}`}>
      <header className="kpi-top">
        <div>
          <p className="kpi-eyebrow">
            US TECHNOLOGIES · SISTEMA DE GESTIÓN DE CALIDAD
          </p>
          <h1>Indicadores de desempeño</h1>
          <p>Resultados, metas y evidencia para la revisión del SGC.</p>
        </div>
        <div className="kpi-actions">
          <button
            className="kpi-button"
            onClick={() => setRefresh((v) => v + 1)}
            disabled={loading}
          >
            Actualizar
          </button>
          <button
            className="kpi-button primary"
            onClick={() => setPresentation((v) => !v)}
          >
            {presentation ? "Salir de presentación" : "Modo presentación"}
          </button>
        </div>
      </header>
      {!presentation && (
        <form
          className="kpi-panel kpi-filters"
          onSubmit={(e) => {
            e.preventDefault();
            apply(filters);
          }}
        >
          <label>
            Año
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            >
              {[...new Set([Number(filters.year), ...catalog.years])]
                .sort((a, b) => b - a)
                .map((y) => (
                  <option key={y}>{y}</option>
                ))}
            </select>
          </label>
          <label>
            Desde
            <select
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hasta
            <select
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha de corte
            <input
              type="date"
              max={localToday()}
              required
              value={filters.cutoff}
              onChange={(e) =>
                setFilters({ ...filters, cutoff: e.target.value })
              }
            />
          </label>
          <label>
            Área
            <select
              value={filters.area}
              onChange={(e) =>
                setFilters({ ...filters, area: e.target.value, indicator: "" })
              }
            >
              <option value="">Todas las autorizadas</option>
              {catalog.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Indicador
            <select
              value={filters.indicator}
              onChange={(e) =>
                setFilters({ ...filters, indicator: e.target.value })
              }
            >
              <option value="">Todos</option>
              {catalog.indicators
                .filter(
                  (i) => !filters.area || String(i.areaId) === filters.area,
                )
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.active ? "" : " · pendiente"}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Vista
            <select
              value={filters.mode}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  mode: e.target.value as Filters["mode"],
                })
              }
            >
              <option value="oficial">Oficial · aprobados</option>
              <option value="preliminar">
                Preliminar · incluye borradores
              </option>
            </select>
          </label>
          <label>
            Comparación
            <select
              value={filters.comparison}
              onChange={(e) =>
                setFilters({ ...filters, comparison: e.target.value })
              }
            >
              <option value="0">Sin comparación</option>
              <option value="1">Mismo periodo del año anterior</option>
            </select>
          </label>
          <div className="kpi-actions">
            <button
              type="submit"
              className="kpi-button primary"
              disabled={loading}
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              className="kpi-button"
              onClick={() => apply(initial())}
            >
              Limpiar
            </button>
          </div>
          {draftChanged && (
            <p className="kpi-small">Hay filtros sin aplicar.</p>
          )}
        </form>
      )}
      {catalogError && (
        <p role="alert" className="kpi-alert bad">
          Catálogos: {catalogError}
        </p>
      )}
      {error && (
        <p role="alert" className="kpi-alert bad">
          {error}{" "}
          <button
            onClick={() => setRefresh((v) => v + 1)}
            className="kpi-button"
          >
            Reintentar
          </button>
        </p>
      )}
      {loading ? (
        <div role="status" className="kpi-panel kpi-empty">
          Consultando indicadores y periodos…
        </div>
      ) : (
        data && (
          <>
            <div className="kpi-context">
              <strong>
                {applied?.year} · {MONTHS[Number(applied?.from) - 1]}–
                {MONTHS[Number(applied?.to) - 1]}
              </strong>
              <span>
                {catalog.areas.find((a) => String(a.id) === applied?.area)
                  ?.name ?? "Todas las áreas autorizadas"}{" "}
                · Corte {applied?.cutoff}
              </span>
              <span>
                Actualizado {new Date(data.generatedAt).toLocaleString("es-MX")}
              </span>
            </div>
            {applied?.mode === "preliminar" && (
              <p className="kpi-alert amber">
                <strong>Vista preliminar.</strong> La matriz y el detalle
                incluyen borradores. Las cuatro tarjetas principales conservan
                las cifras oficiales. Cumplimiento preliminar de mediciones
                exigibles de KPIs activos:{" "}
                <strong>{percent(data.summary.preliminaryCompliance)}</strong> (
                {data.summary.preliminaryEvaluated} evaluables).
              </p>
            )}
            <section className="kpi-cards" aria-label="Resumen oficial">
              {[
                [
                  "Cumplimiento oficial",
                  percent(data.summary.compliance),
                  `${data.summary.met} de ${data.summary.evaluated} mediciones aprobadas evaluables`,
                ],
                [
                  "Cobertura de reporte",
                  percent(data.summary.coverage),
                  `${data.summary.approved} de ${data.summary.expected} mediciones exigibles aprobadas`,
                ],
                [
                  "Fuera de meta",
                  String(data.summary.failed),
                  "Mediciones aprobadas exigibles que no cumplen",
                ],
                [
                  "Pendientes",
                  String(data.summary.pending),
                  "Exigibles sin aprobación; incluye borradores y sin dato",
                ],
              ].map(([name, v, note]) => (
                <article className="kpi-panel kpi-card" key={name}>
                  <p>{name}</p>
                  <strong>{v}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </section>
            <p className="kpi-small">
              {data.pendingConfiguration} indicadores inactivos o con
              advertencias. No se atribuye cumplimiento a datos pendientes de
              configuración.
            </p>
            {!data.rows.length ? (
              <div className="kpi-panel kpi-empty">
                No hay indicadores para los filtros seleccionados.
              </div>
            ) : (
              <>
                <section className="kpi-panel">
                  <div className="kpi-section-head">
                    <div>
                      <h2>Cumplimiento y cobertura por área</h2>
                      <p>
                        Por medición exigible · sin ponderación ni ranking
                        anual.
                      </p>
                    </div>
                  </div>
                  {data.areas.some((a) => a.expected > 0) ? (
                    <div className="kpi-chart-scroll">
                      <div
                        style={{
                          height: Math.max(260, data.areas.length * 78),
                          minWidth: 550,
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data.areas}
                            layout="vertical"
                            margin={{ left: 5, right: 25, bottom: 15 }}
                            accessibilityLayer
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              horizontal={false}
                            />
                            <XAxis type="number" domain={[0, 100]} unit="%" />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={155}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(v) =>
                                typeof v === "number"
                                  ? `${v.toFixed(1)}%`
                                  : "Sin base"
                              }
                            />
                            <Legend />
                            <Bar
                              dataKey="compliance"
                              name="Cumplimiento oficial"
                              fill="#0f766e"
                              radius={[0, 4, 4, 0]}
                            />
                            <Bar
                              dataKey="coverage"
                              name="Cobertura"
                              fill="#2563eb"
                              radius={[0, 4, 4, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <p className="kpi-empty">
                      Sin mediciones exigibles para calcular porcentajes.
                    </p>
                  )}
                  <div className="kpi-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Área</th>
                          <th>Cumplimiento</th>
                          <th>Cobertura</th>
                          <th>Evaluadas</th>
                          <th>Exigibles</th>
                          <th>Pendientes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.areas.map((a) => (
                          <tr key={a.id}>
                            <th>{a.name}</th>
                            <td>{percent(a.compliance)}</td>
                            <td>{percent(a.coverage)}</td>
                            <td>{a.evaluated}</td>
                            <td>{a.expected}</td>
                            <td>{a.pending}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="kpi-panel">
                  <div className="kpi-section-head">
                    <div>
                      <h2>Matriz de resultados</h2>
                      <p>
                        Selecciona el nombre para ver su evolución o una celda
                        para consultar evidencia.
                      </p>
                    </div>
                    <span className="kpi-badge neutral">
                      {data.rows.length} indicadores
                    </span>
                  </div>
                  <div className="kpi-table-scroll">
                    <table className="kpi-matrix">
                      <thead>
                        <tr>
                          <th>Indicador / área</th>
                          {periods.map((c) => (
                            <th key={c.start + c.end}>{period(c)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((i) => (
                          <tr key={i.id}>
                            <th>
                              <button
                                className="kpi-link"
                                onClick={() => {
                                  setSelected(i.id);
                                  document
                                    .getElementById("detalle-kpi")
                                    ?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                }}
                              >
                                {i.name}
                              </button>
                              <small>
                                {i.area}
                                {i.active
                                  ? ""
                                  : " · Pendiente de configuración"}
                              </small>
                              {i.warnings.length > 0 && (
                                <small className="kpi-warning">
                                  {i.warnings.join(" ")}
                                </small>
                              )}
                            </th>
                            {periods.map((p) => {
                              const c = i.cells.find(
                                (c) => c.start === p.start && c.end === p.end,
                              );
                              return (
                                <td key={p.start + p.end}>
                                  {c ? (
                                    <button
                                      className={`kpi-cell ${tone(c)}`}
                                      disabled={!c.resultId}
                                      onClick={() => setResultId(c.resultId)}
                                      title={`Meta: ${c.target}. Fecha límite: ${c.due}`}
                                    >
                                      <strong>{value(c)}</strong>
                                      <small>{state(c)}</small>
                                      <small>Meta: {c.target}</small>
                                    </button>
                                  ) : (
                                    <span className="kpi-small">
                                      No corresponde
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                {current && (
                  <section id="detalle-kpi" className="kpi-panel">
                    <div className="kpi-section-head">
                      <div>
                        <p className="kpi-eyebrow">
                          {current.area} · {current.code}
                        </p>
                        <h2>{current.name}</h2>
                      </div>
                      <select
                        aria-label="Seleccionar indicador para gráfica"
                        value={selected ?? ""}
                        onChange={(e) => setSelected(Number(e.target.value))}
                      >
                        {data.rows.map((i) => (
                          <option value={i.id} key={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!current.active && (
                      <p className="kpi-alert amber">
                        Definición pendiente de confirmar. Sus resultados no
                        entran en las estadísticas oficiales.
                      </p>
                    )}
                    {current.warnings.map((w) => (
                      <p className="kpi-alert amber" key={w}>
                        {w}
                      </p>
                    ))}
                    {mixedUnits ? (
                      <p className="kpi-alert amber">
                        La unidad cambió entre configuraciones. Consulta la
                        tabla; no se combinan unidades distintas en una gráfica.
                      </p>
                    ) : chart.some((p) => p.resultado !== null) ? (
                      <div className="kpi-chart-scroll">
                        <div style={{ height: 340, minWidth: 480 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={chart}
                              margin={{
                                top: 15,
                                right: 25,
                                bottom: 15,
                                left: 5,
                              }}
                              accessibilityLayer
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="period" />
                              <YAxis domain={["auto", "auto"]} />
                              <Tooltip />
                              <Legend />
                              {trend ? (
                                <Line
                                  type="linear"
                                  dataKey="resultado"
                                  name={`Resultado (${current.cells[0]?.unit ?? ""})`}
                                  stroke="#0f766e"
                                  strokeWidth={3}
                                  connectNulls={false}
                                />
                              ) : (
                                <Bar
                                  dataKey="resultado"
                                  name={`Resultado (${current.cells[0]?.unit ?? ""})`}
                                  fill="#0f766e"
                                />
                              )}
                              <Line
                                type="stepAfter"
                                dataKey="metaMin"
                                name="Meta mínima / esperada"
                                stroke="#d97706"
                                strokeDasharray="5 5"
                                connectNulls={false}
                              />
                              <Line
                                type="stepAfter"
                                dataKey="metaMax"
                                name="Meta máxima"
                                stroke="#dc2626"
                                strokeDasharray="5 5"
                                connectNulls={false}
                              />
                              {data.comparison && (
                                <Line
                                  dataKey="anterior"
                                  name={String(data.comparison.year)}
                                  stroke="#64748b"
                                  strokeDasharray="3 3"
                                  connectNulls={false}
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <p className="kpi-empty">
                        No hay resultados numéricos visibles para graficar.
                        Revisa el modo de consulta o los periodos.
                      </p>
                    )}
                    {data.comparison && (
                      <p className="kpi-small">
                        Comparación {data.comparison.year}: sólo se trazan
                        periodos con igual unidad, tipo, regla, método y
                        fórmula. Los huecos representan datos ausentes u
                        opciones no comparables. {data.comparison.notes}
                      </p>
                    )}
                    <div className="kpi-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Periodo</th>
                            <th>Resultado</th>
                            <th>Meta / versión</th>
                            <th>Estado</th>
                            <th>Evidencias de revisión actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {current.cells.map((c) => (
                            <tr key={c.start + c.end}>
                              <td>{period(c)}</td>
                              <td>{value(c)}</td>
                              <td>
                                {c.target} · v{c.version ?? "—"}
                              </td>
                              <td>{state(c)}</td>
                              <td>
                                {c.resultId ? (
                                  <button
                                    className="kpi-link"
                                    onClick={() => setResultId(c.resultId)}
                                  >
                                    {c.evidenceCount} · Ver detalle
                                  </button>
                                ) : (
                                  "Sin registro"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                <section className="kpi-panel">
                  <h2>Desviaciones y seguimiento</h2>
                  <p className="kpi-small">
                    Resultados visibles fuera de meta; en modo preliminar pueden
                    incluir propuestas inactivas y borradores.
                  </p>
                  {data.rows.flatMap((i) =>
                    i.cells
                      .filter((c) => c.evaluation === "NO_CUMPLE" && c.visible)
                      .map((c) => (
                        <article
                          className="kpi-followup"
                          key={`${i.id}-${c.start}`}
                        >
                          <strong>
                            {i.name} · {period(c)} · {value(c)}
                          </strong>
                          <span className="kpi-badge bad">{state(c)}</span>
                          <p>Meta: {c.target}</p>
                          <p>
                            <b>Análisis:</b>{" "}
                            {c.analysis || "Pendiente de documentar"}
                          </p>
                          <p>
                            <b>Acción:</b>{" "}
                            {c.actions || "Pendiente de documentar"}
                          </p>
                        </article>
                      )),
                  )}
                  {!data.rows.some((i) =>
                    i.cells.some(
                      (c) => c.evaluation === "NO_CUMPLE" && c.visible,
                    ),
                  ) && (
                    <p className="kpi-empty">
                      No hay desviaciones evaluadas visibles. Esto no significa
                      que todos los pendientes cumplan.
                    </p>
                  )}
                </section>
              </>
            )}
            <footer className="kpi-panel kpi-small">
              <strong>Criterios de lectura</strong>
              <ul>
                {data.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </footer>
          </>
        )
      )}
      {resultId !== null && (
        <Modal title="Detalle y evidencia de la medición" onClose={closeDetail}>
          <div className="kpi-dialog-body">
            {detailError ? (
              <p role="alert" className="kpi-alert bad">
                {detailError}
              </p>
            ) : !detail ? (
              <p role="status">Cargando detalle…</p>
            ) : (
              <>
                <p className="kpi-eyebrow">
                  {detail.area} · {detail.estado} · revisión{" "}
                  {detail.revision_actual}
                </p>
                <h2>{detail.indicador}</h2>
                {detail.estado !== "APROBADO" && (
                  <p className="kpi-alert amber">
                    Este registro no está aprobado. El detalle permite revisar
                    su origen, pero no forma parte del cumplimiento oficial.
                  </p>
                )}
                <dl className="kpi-definition">
                  {[
                    ["Responsable", detail.responsable],
                    ["Método", detail.metodo_calculo],
                    ["Fórmula", detail.formula_descriptiva],
                    ["Fuente", detail.fuente_datos],
                    ["Capturó", detail.capturado_por],
                    ["Fecha de captura", detail.capturado_en],
                    ["Revisó", detail.revisado_por],
                    ["Fecha de revisión", detail.revisado_en],
                    ["Observaciones", detail.observaciones],
                    ["Análisis", detail.analisis],
                    ["Acciones propuestas", detail.acciones_propuestas],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "Sin registrar"}</dd>
                    </div>
                  ))}
                </dl>
                <h3>Evidencias por revisión</h3>
                {!detail.evidence.length ? (
                  <p>
                    No hay archivos adjuntos. Una referencia a Excel no
                    sustituye al archivo de evidencia.
                  </p>
                ) : (
                  detail.evidence.map((e) => (
                    <div className="kpi-followup" key={e.id}>
                      <strong>{e.nombre}</strong>
                      <p>
                        Revisión {e.revision}
                        {e.revision === detail.revision_actual
                          ? " · actual"
                          : " · histórica"}{" "}
                        · {(Number(e.bytes) / 1024).toFixed(1)} KB
                      </p>
                      <button
                        className="kpi-button"
                        onClick={() => openEvidence(e)}
                      >
                        Abrir evidencia
                      </button>
                    </div>
                  ))
                )}
                {fileLoading && <p role="status">Cargando archivo…</p>}
                {fileError && (
                  <p role="alert" className="kpi-alert bad">
                    {fileError}
                  </p>
                )}
                {file && (
                  <section className="kpi-file">
                    <a
                      className="kpi-button"
                      href={file.url}
                      download={file.name}
                    >
                      Descargar {file.name}
                    </a>
                    {file.pdf ? (
                      <>
                        <a
                          className="kpi-button"
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir PDF en otra pestaña
                        </a>
                        <iframe title={file.name} src={file.url} />
                      </>
                    ) : (
                      <p>Este formato se consulta descargando el archivo.</p>
                    )}
                  </section>
                )}
                <details>
                  <summary>Datos base y referencia de origen</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        datos_base: detail.datos_base,
                        referencia_origen: detail.referencia_origen,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <h3>Historial</h3>
                {!detail.history.length && <p>Sin revisiones registradas.</p>}
                {detail.history.map((h) => (
                  <details key={h.id_Historial}>
                    <summary>
                      Revisión {h.revision} · {h.accion} · {h.realizado_por}
                    </summary>
                    <p>
                      {h.realizado_en} · {h.motivo}
                    </p>
                    <pre>{JSON.stringify(h.datos_revision, null, 2)}</pre>
                  </details>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
