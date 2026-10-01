"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { API_URL, apiFetch, pedir, sesionActual } from "@/utils/api";
import { useSocket } from "@/context/SocketContext";
import MuestrasID from "./MuestrasID";
import styles from "./VentasCRM.module.css";

const etapas = [
  { id: "RECOLECCION", nombre: "Recolección", tono: "blue" },
  { id: "EN_ANALISIS", nombre: "En análisis", tono: "amber" },
  { id: "COTIZACION", nombre: "Cotización", tono: "violet" },
  { id: "VENTA_ASEGURADA", nombre: "Venta asegurada", tono: "green" },
  { id: "VENTA_NO_ASEGURADA", nombre: "Venta no asegurada", tono: "rose" },
] as const;
type Etapa = (typeof etapas)[number]["id"];
type Oportunidad = {
  id: number;
  folio: string | null;
  cliente: string | null;
  producto: string;
  cantidad: string | null;
  unidad: string | null;
  estadoLaboratorio: string;
  recoleccion: string | null;
  ingresoLaboratorio: string | null;
  etapa: Etapa;
  version: number;
  nota: string | null;
  proximoContacto: string | null;
  actualizado: string | null;
};
type Historial = {
  id: number;
  fecha: string;
  etapa: Etapa;
  etapaAnterior: Etapa;
  nota: string;
  usuario: string;
  proximoContacto: string | null;
};
type Respuesta = {
  data: Oportunidad[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  resumen: {
    total: number;
    aseguradas: number;
    noAseguradas: number;
    abiertas: number;
    conversion: number;
    porEtapa: Partial<Record<Etapa, number>>;
  };
};
const fecha = (value: string | null) =>
  value ? new Date(value).toLocaleString("es-MX") : "Sin registrar";
const nombreEtapa = (value: Etapa) =>
  etapas.find((e) => e.id === value)?.nombre ?? value;
const fechaInput = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const ruta = "/api/ventas/crm/oportunidades";

export default function VentasCRM() {
  const router = useRouter(),
    socket = useSocket();
  const [usuario, setUsuario] = useState<string | null>(null),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const [filtros, setFiltros] = useState({
      q: "",
      desde: "",
      hasta: "",
      etapa: "",
    }),
    [aplicados, setAplicados] = useState(filtros),
    [pagina, setPagina] = useState(1),
    [revision, setRevision] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null),
    [cargando, setCargando] = useState(true);
  const [registro, setRegistro] = useState(false),
    [seleccion, setSeleccion] = useState<number | null>(null),
    [detalle, setDetalle] = useState<Oportunidad | null>(null),
    [historial, setHistorial] = useState<Historial[]>([]);
  const [etapa, setEtapa] = useState<Etapa>("RECOLECCION"),
    [nota, setNota] = useState(""),
    [contacto, setContacto] = useState(""),
    [guardando, setGuardando] = useState(false),
    [cargandoDetalle, setCargandoDetalle] = useState(false),
    [revisionDetalle, setRevisionDetalle] = useState(0),
    [tecnico, setTecnico] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!sesionActual()?.token) {
      router.replace("/");
      return;
    }
    apiFetch(`${API_URL}/api/auth/sesion`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("No fue posible verificar tu sesión.");
        const u = await r.json();
        if (u.area !== "ventas") {
          router.replace("/");
          return;
        }
        setUsuario(u.usuario);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [router]);
  const refrescar = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const eventos = [
      "connect",
      "ID_MUESTRA_ACTUALIZADA",
      "CRM_OPORTUNIDAD_ACTUALIZADA",
    ];
    eventos.forEach((e) => socket?.on(e, refrescar));
    return () => eventos.forEach((e) => socket?.off(e, refrescar));
  }, [socket, refrescar]);
  useEffect(() => {
    if (!usuario) return;
    const controller = new AbortController(),
      q = new URLSearchParams({ pagina: String(pagina) });
    Object.entries(aplicados).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    setCargando(true);
    setError("");
    apiFetch(`${API_URL}${ruta}?${q}`, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "No se pudo cargar el CRM.");
        setRespuesta(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setRespuesta(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [usuario, aplicados, pagina, revision]);
  useEffect(() => {
    if (!seleccion || !usuario) return;
    const controller = new AbortController();
    setCargandoDetalle(true);
    setDetalle(null);
    setError("");
    apiFetch(`${API_URL}${ruta}/${seleccion}`, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.message || "No se pudo cargar el detalle.");
        setDetalle(d.data);
        setHistorial(d.historial);
        setEtapa(d.data.etapa);
        setContacto(fechaInput(d.data.proximoContacto));
        setNota("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoDetalle(false);
      });
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    panel.current?.focus({ preventScroll: true });
    return () => controller.abort();
  }, [seleccion, usuario, revisionDetalle]);
  const abrir = (id: number) => {
    setRegistro(false);
    setTecnico(false);
    setMensaje("");
    setSeleccion(id);
    setRevisionDetalle((v) => v + 1);
  };
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalle || guardando) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await pedir(`${ruta}/${detalle.id}/seguimiento`, {
        version: detalle.version,
        etapaActual: detalle.etapa,
        etapa,
        nota,
        proximoContacto: contacto ? new Date(contacto).toISOString() : null,
      });
      setMensaje("Seguimiento guardado.");
      setRevisionDetalle((v) => v + 1);
      refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible guardar.");
    } finally {
      setGuardando(false);
    }
  };
  const salir = async () => {
    try {
      await pedir("/api/auth/salir", {});
    } catch {
    } finally {
      localStorage.removeItem("sesion");
      window.dispatchEvent(new Event("sesion-cambiada"));
      router.replace("/");
    }
  };
  if (!usuario)
    return (
      <main className={styles.app}>
        <p role={error ? "alert" : "status"}>
          {error || "Verificando sesión…"}
        </p>
        <button onClick={() => router.replace("/")}>Volver al inicio</button>
      </main>
    );
  const resumen = respuesta?.resumen;
  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>US Technologies · Ventas</p>
          <h1>De muestra a venta</h1>
          <p>Gestiona tus oportunidades y sigue su avance comercial.</p>
        </div>
        <div className={styles.actions}>
          <span>{usuario}</span>
          <button onClick={() => void salir()}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </header>
      <section className={styles.metrics} aria-label="Conversión comercial">
        {[
          {
            label: "Muestras / oportunidades",
            value: resumen?.total,
            icon: FlaskConical,
          },
          {
            label: "Oportunidades abiertas",
            value: resumen?.abiertas,
            icon: CalendarClock,
          },
          {
            label: "Ventas aseguradas",
            value: resumen?.aseguradas,
            icon: CheckCircle2,
          },
          {
            label: "Conversión a venta",
            value: resumen ? `${resumen.conversion}%` : undefined,
            icon: TrendingUp,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon size={21} />
            <span>{label}</span>
            <strong>{cargando ? "…" : (value ?? "—")}</strong>
          </div>
        ))}
      </section>
      <p className={styles.help}>
        Conversión = ventas aseguradas ÷ todas las muestras de la búsqueda y el
        periodo. Incluye abiertas y no aseguradas; no depende de la página ni
        del filtro de etapa.
      </p>
      <section className={styles.controls}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPagina(1);
            setAplicados({ ...filtros });
          }}
        >
          <label className={styles.search}>
            <span>
              <Search size={15} />
              Buscar oportunidades
            </span>
            <input
              maxLength={120}
              placeholder="Cliente, producto o folio"
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
          </label>
          <label>
            Recolección desde (UTC)
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) =>
                setFiltros({ ...filtros, desde: e.target.value })
              }
            />
          </label>
          <label>
            Hasta (UTC)
            <input
              type="date"
              min={filtros.desde}
              value={filtros.hasta}
              onChange={(e) =>
                setFiltros({ ...filtros, hasta: e.target.value })
              }
            />
          </label>
          <label>
            Etapa
            <select
              value={filtros.etapa}
              onChange={(e) =>
                setFiltros({ ...filtros, etapa: e.target.value })
              }
            >
              <option value="">Todas las etapas</option>
              {etapas.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Aplicar filtros</button>
          <button
            type="button"
            onClick={() => {
              const f = { q: "", desde: "", hasta: "", etapa: "" };
              setFiltros(f);
              setAplicados(f);
              setPagina(1);
            }}
          >
            Limpiar
          </button>
        </form>
        <div className={styles.actions}>
          <button onClick={refrescar} disabled={cargando}>
            <RefreshCw size={16} />
            Actualizar
          </button>
          <button
            className={styles.primary}
            onClick={() => {
              setSeleccion(null);
              setDetalle(null);
              setRegistro(!registro);
            }}
          >
            <Plus size={16} />
            {registro ? "Cerrar registro" : "Nueva muestra / oportunidad"}
          </button>
        </div>
      </section>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className={styles.success} role="status">
          {mensaje}
        </p>
      )}
      {registro && (
        <section className={styles.panel}>
          <MuestrasID
            area="ventas"
            vista="registro"
            onRegistrada={(id) => {
              setRegistro(false);
              refrescar();
              abrir(id);
              setMensaje("Muestra registrada como oportunidad.");
            }}
          />
        </section>
      )}
      {seleccion && (
        <section
          ref={panel}
          tabIndex={-1}
          className={styles.panel}
          aria-label="Detalle de oportunidad"
        >
          <div className={styles.actions}>
            <h2>Seguimiento comercial · #{seleccion}</h2>
            <button
              disabled={guardando}
              onClick={() => setRevisionDetalle((v) => v + 1)}
            >
              <RefreshCw size={15} />
              Recargar detalle
            </button>
            <button
              disabled={guardando}
              aria-label="Cerrar detalle"
              onClick={() => {
                setSeleccion(null);
                setDetalle(null);
              }}
            >
              <X size={18} />
            </button>
          </div>
          {cargandoDetalle && <p role="status">Cargando oportunidad…</p>}
          {detalle && (
            <>
              <h3>
                {detalle.cliente || "Cliente sin nombre"} · {detalle.producto}
              </h3>
              <p className={styles.help}>
                Folio: {detalle.folio} · {detalle.cantidad} {detalle.unidad}
              </p>
              <div className={styles.facts}>
                <span>
                  Etapa comercial: <b>{nombreEtapa(detalle.etapa)}</b>
                </span>
                <span>
                  Estado de ID:{" "}
                  <b>{detalle.estadoLaboratorio.replaceAll("_", " ")}</b>
                </span>
                <span>Recolección: {fecha(detalle.recoleccion)}</span>
                <span>
                  Recepción en ID: {fecha(detalle.ingresoLaboratorio)}
                </span>
              </div>
              <form onSubmit={guardar} className={styles.editor}>
                <label>
                  Etapa comercial
                  <select
                    value={etapa}
                    disabled={guardando}
                    onChange={(e) => setEtapa(e.target.value as Etapa)}
                  >
                    {etapas.map((e) => (
                      <option
                        value={e.id}
                        key={e.id}
                        disabled={
                          e.id === "RECOLECCION"
                            ? !!detalle.ingresoLaboratorio ||
                              detalle.estadoLaboratorio !== "PENDIENTE"
                            : e.id === "EN_ANALISIS"
                              ? !detalle.ingresoLaboratorio &&
                                detalle.estadoLaboratorio === "PENDIENTE"
                              : false
                        }
                      >
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Próximo contacto (hora local)
                  <input
                    type="datetime-local"
                    value={contacto}
                    disabled={
                      guardando ||
                      etapa === "VENTA_ASEGURADA" ||
                      etapa === "VENTA_NO_ASEGURADA"
                    }
                    onChange={(e) => setContacto(e.target.value)}
                  />
                </label>
                <label className={styles.wide}>
                  Nota de seguimiento / motivo del cambio
                  <textarea
                    required
                    maxLength={4000}
                    rows={3}
                    value={nota}
                    disabled={guardando}
                    placeholder="Acuerdo con el cliente, cotización, motivo de cierre o siguiente paso…"
                    onChange={(e) => setNota(e.target.value)}
                  />
                </label>
                <p className={styles.help}>
                  La recepción en ID mueve Recolección a En análisis. Cotización
                  y cierre los confirma Ventas. Cada cambio conserva autor,
                  fecha y nota; cerrar la venta cancela el próximo contacto.
                  Puedes reabrirla registrando el motivo.
                </p>
                <button className={styles.primary} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar seguimiento"}
                </button>
              </form>
              <details className={styles.history}>
                <summary>
                  Historial comercial · últimos {historial.length} movimientos
                </summary>
                {historial.length ? (
                  historial.map((h) => (
                    <article key={h.id}>
                      <div>
                        <b>{nombreEtapa(h.etapaAnterior)}</b>
                        <ArrowRight size={14} />
                        <b>{nombreEtapa(h.etapa)}</b>
                      </div>
                      <small>
                        {fecha(h.fecha)} · {h.usuario}
                      </small>
                      <p>{h.nota}</p>
                      {h.proximoContacto && (
                        <small>Contacto: {fecha(h.proximoContacto)}</small>
                      )}
                    </article>
                  ))
                ) : (
                  <p>
                    Aún no hay seguimientos comerciales. La etapa inicial se
                    obtiene de la recepción de la muestra.
                  </p>
                )}
              </details>
              <button onClick={() => setTecnico(!tecnico)}>
                <FlaskConical size={16} />
                {tecnico
                  ? "Ocultar muestra y tiempos de ID"
                  : "Ver muestra, ficha, etiqueta y tiempos de ID"}
              </button>
              {tecnico && (
                <MuestrasID
                  key={detalle.id}
                  area="ventas"
                  vista="detalle"
                  muestraId={detalle.id}
                  onCerrar={() => setTecnico(false)}
                />
              )}
            </>
          )}
        </section>
      )}
      <div className={styles.boardHeading}>
        <div>
          <h2>Mis oportunidades</h2>
          <p>
            {respuesta?.total ?? 0} resultados · página {pagina}. Las columnas
            muestran las oportunidades de esta página.
          </p>
        </div>
        <span>Vista por vendedor</span>
      </div>
      {cargando ? (
        <p role="status" className={styles.empty}>
          Cargando oportunidades…
        </p>
      ) : (
        respuesta && (
          <>
            <div className={styles.board}>
              {etapas
                .filter((e) => !aplicados.etapa || e.id === aplicados.etapa)
                .map((e) => {
                  const items = respuesta.data.filter((o) => o.etapa === e.id);
                  return (
                    <section
                      key={e.id}
                      className={styles.column}
                      data-tone={e.tono}
                    >
                      <header>
                        <h3>{e.nombre}</h3>
                        <span title="Total de esta etapa en la búsqueda y periodo">
                          {resumen?.porEtapa[e.id] ?? 0}
                        </span>
                      </header>
                      {items.map((o) => (
                        <button
                          key={o.id}
                          className={styles.card}
                          onClick={() => abrir(o.id)}
                        >
                          <span className={styles.eyebrow}>
                            Oportunidad #{o.id}
                          </span>
                          <h4>{o.cliente || "Sin cliente"}</h4>
                          <p>{o.producto}</p>
                          <span className={styles.amount}>
                            {o.cantidad} {o.unidad}
                          </span>
                          <span className={styles.lab}>
                            ID: {o.estadoLaboratorio.replaceAll("_", " ")}
                          </span>
                          {o.nota && <p className={styles.note}>{o.nota}</p>}
                          {o.proximoContacto && (
                            <span
                              className={
                                new Date(o.proximoContacto) < new Date()
                                  ? styles.overdue
                                  : styles.contact
                              }
                            >
                              <CalendarClock size={14} />
                              {new Date(o.proximoContacto) < new Date()
                                ? "Contacto vencido: "
                                : "Contacto: "}
                              {fecha(o.proximoContacto)}
                            </span>
                          )}
                          <span className={styles.cardAction}>
                            Gestionar oportunidad
                            <ArrowRight size={15} />
                          </span>
                        </button>
                      ))}
                      {!items.length && (
                        <p className={styles.empty}>
                          Sin oportunidades en esta página.
                        </p>
                      )}
                    </section>
                  );
                })}
            </div>
            <nav
              className={styles.pagination}
              aria-label="Páginas de oportunidades"
            >
              <button
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </button>
              <span>
                {pagina} /{" "}
                {Math.max(
                  1,
                  Math.ceil(respuesta.total / respuesta.tamanoPagina),
                )}
              </span>
              <button
                disabled={pagina * respuesta.tamanoPagina >= respuesta.total}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </button>
            </nav>
          </>
        )
      )}
    </main>
  );
}
