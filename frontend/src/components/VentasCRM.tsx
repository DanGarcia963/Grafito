"use client";
import PlanProduccion from "./PlanProduccion";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, LogOut } from "lucide-react";
import { API_URL, apiFetch, pedir, sesionActual } from "@/utils/api";
import { useSocket } from "@/context/SocketContext";
import MuestrasID from "./MuestrasID";
import { descargarCrm } from "./CrmReportes";
import s from "./VentasCRM.module.css";
const base = "/api/ventas/crm",
  etapas = [
    "REGISTRADA",
    "MUESTRA_RECOLECTADA",
    "RECOLECCION_AGENDADA",
    "EN_ANALISIS_ID",
    "COTIZACION",
    "SEGUIMIENTO_COTIZACION",
    "GANADA",
    "PERDIDA",
    "CANCELADA",
  ];
const nombre = (x: string) => x.replaceAll("_", " "),
  fecha = (x: string | null) => (x ? new Date(x).toLocaleString("es-MX") : "—");
const dinero = (x: string, m: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: m }).format(
    Number(x),
  );
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  value?: string | number;
};
function Form({
  title,
  fields,
  onSave,
  busy,
  onClose,
}: {
  title: string;
  fields: Field[];
  onSave: (d: FormData) => Promise<unknown>;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <section className={s.panel}>
      <div className={s.actions}>
        <h2>{title}</h2>
        <button onClick={onClose}>Cerrar formulario</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          for (const field of fields) {
            const value = data.get(field.name);
            if (
              field.type === "datetime-local" &&
              typeof value === "string" &&
              value
            )
              data.set(field.name, new Date(value).toISOString());
          }
          void onSave(data);
        }}
      >
        <fieldset disabled={busy} className={s.formFields}>
          {fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.options ? (
                <select
                  name={f.name}
                  required={f.required}
                  defaultValue={f.value ?? ""}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  required={f.required}
                  defaultValue={f.value}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  defaultValue={f.value}
                  step={f.type === "number" ? "any" : undefined}
                  accept={f.type === "file" ? ".pdf,.doc,.docx" : undefined}
                />
              )}
            </label>
          ))}
          <button className={s.primary} type="submit">
            {busy ? "Guardando…" : "Guardar y confirmar"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
export default function VentasCRM() {
  const router = useRouter(),
    socket = useSocket();
  const [user, setUser] = useState<any>(null),
    [vista, setVista] = useState("oportunidades"),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState(""),
    [busy, setBusy] = useState(false);
  const [lista, setLista] = useState<any[]>([]),
    [total, setTotal] = useState(0),
    [pagina, setPagina] = useState(1),
    [cuentas, setCuentas] = useState<any[]>([]),
    [ordenes, setOrdenes] = useState<any[]>([]),
    [metricas, setMetricas] = useState<any>(null);
  const [q, setQ] = useState(""),
    [etapa, setEtapa] = useState(""),
    [desde, setDesde] = useState(""),
    [hasta, setHasta] = useState("");
  const [detalle, setDetalle] = useState<any>(null),
    [cuenta, setCuenta] = useState<any>(null),
    [form, setForm] = useState(""),
    [registro, setRegistro] = useState(false),
    [muestra, setMuestra] = useState<number>(),
    [cot, setCot] = useState<any>(null),
    [ov, setOv] = useState<any>(null);
  const [productos, setProductos] = useState<any[]>([]),
    [productoQ, setProductoQ] = useState("");
  useEffect(() => {
    const u = sesionActual();
    if (u?.area !== "ventas" || !u.token) {
      router.replace("/");
      return;
    }
    setUser(u);
  }, [router]);
  const cargar = useCallback(async () => {
    const qs = new URLSearchParams({
      q,
      etapa,
      desde,
      hasta,
      pagina: String(pagina),
    });
    const [l, c, v, m] = await Promise.all([
      pedir(`${base}/oportunidades?${qs}`, undefined, "GET"),
      pedir(`${base}/cuentas?q=${encodeURIComponent(q)}`, undefined, "GET"),
      pedir(`${base}/ordenes`, undefined, "GET"),
      pedir(`${base}/metricas?desde=${desde}&hasta=${hasta}`, undefined, "GET"),
    ]);
    setLista(l.data);
    setTotal(l.total);
    setCuentas(c.data);
    setOrdenes(v.data);
    setMetricas(m.data);
  }, [q, etapa, desde, hasta, pagina]);
  useEffect(() => {
    if (user) void cargar().catch((e) => setError(e.message));
  }, [user, cargar]);
  useEffect(() => {
    const f = () => void cargar().catch((e) => setError(e.message));
    socket?.on("CRM_OPORTUNIDAD_ACTUALIZADA", f);
    socket?.on("ID_MUESTRA_ACTUALIZADA", f);
    return () => {
      socket?.off("CRM_OPORTUNIDAD_ACTUALIZADA", f);
      socket?.off("ID_MUESTRA_ACTUALIZADA", f);
    };
  }, [socket, cargar]);
  const abrir = async (id: number) => {
    const r = await pedir(`${base}/oportunidades/${id}`, undefined, "GET");
    setDetalle(r.data);
    setForm("");
    setRegistro(false);
    setMuestra(undefined);
  };
  const verCuenta = async (id: number) => {
    const r = await pedir(`${base}/cuentas/${id}`, undefined, "GET");
    setCuenta(r.data);
  };
  const ejecutar = async (
    fn: () => Promise<unknown>,
    msg = "Guardado correctamente",
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMensaje("");
    try {
      await fn();
      await cargar();
      if (detalle) {
        const r = await pedir(
          `${base}/oportunidades/${detalle.id}`,
          undefined,
          "GET",
        );
        setDetalle((actual: any) =>
          actual?.id === detalle.id ? r.data : actual,
        );
      }
      setMensaje(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  };
  const field = (
    name: string,
    label: string,
    type = "text",
    required = false,
    value?: string | number,
  ): Field => ({ name, label, type, required, value });
  const select = (
    name: string,
    label: string,
    options: { value: string | number; label: string }[],
    value?: string | number,
  ): Field => ({ name, label, options, value, required: true });
  const opts = (xs: string[]) =>
    xs.map((x) => ({ value: x, label: nombre(x) }));
  let fields: Field[] = [],
    title = "";
  if (form === "cuenta") {
    title = "Perfil comercial permanente";
    fields = [
      field(
        "nombre",
        "Empresa / persona",
        "text",
        true,
        cuenta?.persona.nombre,
      ),
      ...[
        "nombre_contacto",
        "puesto_contacto",
        "correo",
        "telefono",
        "origen_prospecto",
        "frecuencia_esperada_dias",
        "frecuencia_esperada_descripcion",
        "observaciones",
      ].map((n) =>
        field(
          n,
          nombre(n),
          n === "correo"
            ? "email"
            : n === "frecuencia_esperada_dias"
              ? "number"
              : "text",
          false,
          cuenta?.persona.crm_perfil_comercial?.[n] ?? "",
        ),
      ),
    ];
  }
  if (form === "oportunidad") {
    title = "Nueva oportunidad · Recolección agendada";
    fields = [
      select(
        "persona_id",
        "Prospecto / cliente",
        [
          { value: "", label: "Seleccionar cuenta" },
          ...cuentas.map((c) => ({ value: c.id_Persona, label: c.nombre })),
        ],
        cuenta?.persona.id_Persona,
      ),
      field("titulo", "Título / necesidad de compra", "text", true),
      field("necesidad", "Descripción", "textarea"),
      field(
        "fecha_recoleccion_agendada",
        "Recolección agendada",
        "datetime-local",
        true,
      ),
      field("proximo_contacto", "Próximo contacto", "datetime-local"),
      field("cantidad_estimada", "Cantidad estimada", "number"),
      field("unidad", "Unidad"),
      {
        name: "producto_id",
        label: "Producto (opcional)",
        options: [
          { value: "", label: "Definir después" },
          ...productos.map((p) => ({
            value: p.id_Produc_Mater,
            label: p.nombre_Producto,
          })),
        ],
      },
    ];
  }
  if (form === "seguimiento") {
    title = "Seguimiento o cierre de oportunidad";
    fields = [
      select("etapa", "Acción", [
        { value: detalle.etapa, label: "Registrar seguimiento" },
        ...opts(["PERDIDA", "CANCELADA"]),
      ]),
      field("nota", "Nota / motivo de cierre", "textarea", true),
      field("proximo_contacto", "Próximo contacto", "datetime-local"),
      field(
        "fecha_recoleccion_agendada",
        "Reagendar recolección (opcional)",
        "datetime-local",
      ),
    ];
  }
  if (form === "asociar") {
    title = "Vincular muestra histórica de esta cuenta y vendedor";
    fields = [
      field("muestra_id", "ID de muestra sin oportunidad", "number", true),
    ];
  }
  if (form === "cotizacion") {
    title = "Nueva versión de cotización";
    fields = [
      select("moneda", "Moneda", opts(["MXN", "USD", "EUR"])),
      select(
        "tipo_venta",
        "Tipo de venta",
        opts(["PRODUCTO_NUEVO", "SERVICIO_REGENERACION"]),
      ),
      field(
        "producto_id",
        "ID del producto",
        "number",
        true,
        detalle.producto_id ?? "",
      ),
      field("servicio", "Servicio", "text", true),
      field(
        "cantidad",
        "Cantidad",
        "number",
        true,
        detalle.cantidad_estimada ?? "",
      ),
      select("unidad", "Unidad", opts(["Litros", "Kilogramos", "Piezas"])),
      field("subtotal", "Subtotal", "number", true),
      field("impuestos", "Impuestos", "number", true),
      field("total", "Total", "number", true),
      field("vigencia_hasta", "Vigencia", "date", true),
      field(
        "condiciones_comerciales",
        "Condiciones comerciales",
        "textarea",
        true,
      ),
      field("notas", "Notas", "textarea"),
      field("documento", "Documento Word / PDF (hasta 10 MB)", "file"),
    ];
  }
  if (form === "estadoCotizacion") {
    title = `Registrar envío / respuesta · Cotización v${cot.version}`;
    fields = [
      select(
        "estado",
        "Estado",
        opts(
          cot.estado === "BORRADOR" ? ["ENVIADA"] : ["ACEPTADA", "RECHAZADA"],
        ),
      ),
      field(
        "nota",
        "Evidencia / nota del envío o aceptación",
        "textarea",
        true,
      ),
      field("proximo_contacto", "Próximo contacto", "datetime-local"),
    ];
  }
  if (form === "confirmar") {
    title = `Confirmar compra: ${dinero(cot.total, cot.moneda)} · Cotización v${cot.version}`;
    fields = [
      field(
        "orden_cliente",
        "Orden de compra / referencia de aceptación",
        "text",
        true,
      ),
      field("fecha_compromiso", "Fecha compromiso", "date"),
      field("observaciones", "Observaciones", "textarea"),
    ];
  }
  if (form === "cancelarOrden") {
    title = `Cancelar orden #${ov.id} (queda excluida de métricas de compra)`;
    fields = [field("motivo", "Motivo de cancelación", "textarea", true)];
  }
  const guardar = (d: FormData) =>
    ejecutar(async () => {
      const b: any = Object.fromEntries(d.entries());
      if (!b.fecha_recoleccion_agendada && form === "seguimiento")
        delete b.fecha_recoleccion_agendada;
      if (form === "cuenta") {
        await pedir(`${base}/cuentas`, {
          ...b,
          persona_id: cuenta?.persona.id_Persona,
        });
        if (cuenta) await verCuenta(cuenta.persona.id_Persona);
      }
      if (form === "oportunidad") {
        const r = await pedir(`${base}/oportunidades`, b);
        await abrir(r.data.id);
      }
      if (form === "seguimiento" || form === "asociar")
        await pedir(
          `${base}/oportunidades/${detalle.id}/${form === "asociar" ? "muestras" : "seguimiento"}`,
          { ...b, version: detalle.version },
        );
      if (form === "cotizacion") {
        d.set("version", String(detalle.version));
        const r = await apiFetch(
          `${API_URL}${base}/oportunidades/${detalle.id}/cotizaciones`,
          { method: "POST", body: d },
        );
        const result = await r.json();
        if (!r.ok) throw new Error(result.message);
      }
      if (form === "estadoCotizacion")
        await pedir(
          `${base}/oportunidades/${detalle.id}/cotizaciones/${cot.id}/estado`,
          { ...b, version: detalle.version },
        );
      if (form === "confirmar")
        await pedir(`${base}/oportunidades/${detalle.id}/confirmar`, {
          ...b,
          version: detalle.version,
          cotizacion_id: cot.id,
        });
      if (form === "produccion" || form === "cancelarOrden")
        await pedir(
          `${base}/ordenes/${ov.id}/${form === "produccion" ? "produccion" : "cancelar"}`,
          b,
        );
      setForm("");
    });
  if (!user) return <p className="p-6">Verificando sesión…</p>;
  const abierta =
    detalle && !["GANADA", "PERDIDA", "CANCELADA"].includes(detalle.etapa);
  return (
    <main className={s.app}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>US Technologies · Gestión comercial</span>
          <h1>CRM de Ventas</h1>
          <p>Prospectos, análisis de ID y compras recurrentes.</p>
        </div>
        <div className={s.actions}>
          <span>{user.usuario}</span>
          <button onClick={() => void ejecutar(cargar)}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button
            onClick={async () => {
              await pedir("/api/auth/salir");
              localStorage.removeItem("sesion");
              router.push("/");
            }}
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>
      <nav className={s.actions}>
        {[
          ["cuentas", "Prospectos y clientes"],
          ["oportunidades", "Oportunidades"],
          ["ordenes", "Órdenes de venta"],
          ["muestras", "Muestras"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={vista === id ? s.primary : ""}
            onClick={() => {
              setVista(id);
              setDetalle(null);
              setForm("");
              setCuenta(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className={s.success}>
          {mensaje}
        </p>
      )}
      <section className={s.metrics}>
        {metricas &&
          [
            [
              "Conversión de prospectos",
              metricas.conversion_prospectos == null
                ? "—"
                : `${metricas.conversion_prospectos.toFixed(1)}%`,
              `${metricas.convertidos} de ${metricas.cohorte} en la cohorte`,
            ],
            [
              "Efectividad comercial",
              metricas.efectividad == null
                ? "—"
                : `${metricas.efectividad.toFixed(1)}%`,
              `${metricas.ganadas} ganadas / ${metricas.perdidas} perdidas`,
            ],
            [
              "Oportunidades abiertas",
              metricas.abiertas,
              `${metricas.canceladas} canceladas`,
            ],
            [
              "Clientes con recompra",
              metricas.clientes_recompra,
              `${metricas.ordenes_periodo} órdenes válidas en el periodo`,
            ],
            [
              "Duración comercial",
              metricas.duracion_comercial_dias == null
                ? "—"
                : `${metricas.duracion_comercial_dias.toFixed(1)} días`,
              "Promedio de oportunidades cerradas",
            ],
          ].map(([l, v, h]) => (
            <article key={String(l)}>
              <span>{l}</span>
              <strong>{v}</strong>
              <small>{h}</small>
            </article>
          ))}
      </section>
      <div className={s.filters}>
        <label>
          Buscar
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
            placeholder="Empresa, título o folio"
          />
        </label>
        <label>
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        {vista === "oportunidades" && (
          <label>
            Etapa
            <select
              value={etapa}
              onChange={(e) => {
                setEtapa(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todas</option>
              {etapas.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className={s.help}>
        Conversión por cohorte de alta. Efectividad por fecha de cierre.
        Recompra acumulada al corte. Los tiempos técnicos se consultan en ID.
      </p>
      {vista === "cuentas" && (
        <>
          <div className={s.actions}>
            <h2>Cartera comercial</h2>
            <button
              className={s.primary}
              onClick={() => {
                setCuenta(null);
                setForm("cuenta");
              }}
            >
              <Plus size={16} /> Registrar prospecto
            </button>
          </div>
          <div className={s.accountGrid}>
            {cuentas.map((c) => (
              <button
                className={s.accountCard}
                key={c.id_Persona}
                onClick={() =>
                  void ejecutar(
                    () => verCuenta(c.id_Persona),
                    "Cuenta consultada",
                  )
                }
              >
                <strong>{c.nombre}</strong>
                <span>
                  {c.crm_perfil_comercial?.estado_comercial ?? c.tipo_persona}
                </span>
                <small>
                  {c.crm_perfil_comercial?.nombre_contacto} ·{" "}
                  {c.crm_perfil_comercial?.correo}
                </small>
              </button>
            ))}
          </div>
          <p className={s.help}>
            Hasta 100 coincidencias; usa la búsqueda para localizar otra cuenta.
          </p>
        </>
      )}
      {cuenta && vista === "cuentas" && (
        <section className={s.panel}>
          <div className={s.actions}>
            <h2>{cuenta.persona.nombre}</h2>
            <button onClick={() => setForm("cuenta")}>Editar perfil</button>
            <button
              onClick={() => {
                setVista("oportunidades");
                setForm("oportunidad");
              }}
            >
              Nueva oportunidad
            </button>
          </div>
          <p>
            Última compra: {fecha(cuenta.recurrencia.ultima_compra)} · Órdenes
            válidas: {cuenta.recurrencia.ordenes} · Frecuencia observada:{" "}
            {nombre(cuenta.recurrencia.frecuencia_observada)}
          </p>
          <p>
            Intervalo medio:{" "}
            {cuenta.recurrencia.intervalo_dias?.toFixed(1) ?? "—"} días ·
            Próxima estimada:{" "}
            {fecha(cuenta.recurrencia.proxima_compra_estimada)} · Frecuencia
            acordada: {cuenta.recurrencia.frecuencia_esperada_dias ?? "—"} días
          </p>
          <h3>Oportunidades</h3>
          {cuenta.oportunidades.map((o: any) => (
            <button
              key={o.id}
              onClick={() => {
                setVista("oportunidades");
                void ejecutar(() => abrir(o.id));
              }}
            >
              #{o.id} {o.titulo} · {nombre(o.etapa)}
            </button>
          ))}
          <h3>Compras</h3>
          {cuenta.ordenes.map((v: any) => (
            <p key={v.id}>
              #{v.id} · {fecha(v.fecha_confirmacion)} ·{" "}
              {dinero(v.importe_total, v.moneda)} · {v.estado} · {v.tipo_compra}
            </p>
          ))}
        </section>
      )}
      {vista === "oportunidades" && (
        <>
          <div className={s.actions}>
            <h2>Oportunidades comerciales</h2>
            <button
              className={s.primary}
              onClick={() => {
                setDetalle(null);
                setForm("oportunidad");
              }}
            >
              <Plus size={16} /> Agendar recolección
            </button>
          </div>
          <div className={s.pipeline}>
            {etapas.map((e) => (
              <section key={e} className={s.pipelineColumn}>
                <h3>{nombre(e)}</h3>
                {lista
                  .filter((o) => o.etapa === e)
                  .map((o) => (
                    <button
                      className={s.opCard}
                      key={o.id}
                      onClick={() =>
                        void ejecutar(
                          () => abrir(o.id),
                          "Oportunidad consultada",
                        )
                      }
                    >
                      <small>
                        #{o.id} · {o.cliente.nombre}
                      </small>
                      <strong>{o.titulo}</strong>
                      <span>
                        {o.producto?.nombre_Producto ?? "Producto pendiente"}
                      </span>
                      <span>
                        {o._count.muestras} muestras ·{" "}
                        {nombre(o.estado_tecnico)}
                      </span>
                      <small>
                        Próximo contacto: {fecha(o.proximo_contacto)}
                      </small>
                    </button>
                  ))}
              </section>
            ))}
          </div>
          <div className={s.actions}>
            <button
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {pagina} · {total} oportunidades
            </span>
            <button
              disabled={pagina * 50 >= total}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
      {form === "oportunidad" && (
        <div className={s.actions}>
          <input
            placeholder="Buscar producto para la oportunidad"
            value={productoQ}
            onChange={(e) => setProductoQ(e.target.value)}
          />
          <button
            onClick={() =>
              void ejecutar(async () => {
                const r = await pedir(
                  `/api/investigacion/referencias?q=${encodeURIComponent(productoQ)}`,
                  undefined,
                  "GET",
                );
                setProductos(r.productos);
              }, "Productos consultados")
            }
          >
            Buscar producto
          </button>
        </div>
      )}
      {form === "produccion" && (
        <PlanProduccion
          venta={ov}
          onClose={() => setForm("")}
          onDone={() => {
            setForm("");
            void cargar();
          }}
        />
      )}
      {form && form !== "produccion" && (
        <Form
          key={`${form}-${cuenta?.persona.id_Persona ?? ""}-${cot?.id ?? ""}`}
          title={title}
          fields={fields}
          onSave={guardar}
          busy={busy}
          onClose={() => setForm("")}
        />
      )}
      {detalle && vista === "oportunidades" && (
        <section className={s.panel}>
          <div className={s.actions}>
            <h2>
              #{detalle.id} · {detalle.titulo}
            </h2>
            <button
              onClick={() => {
                setDetalle(null);
                setForm("");
              }}
            >
              Cerrar detalle
            </button>
          </div>
          <p>
            {detalle.cliente.nombre} · {nombre(detalle.etapa)} ·{" "}
            {nombre(detalle.estado_tecnico)}
          </p>
          <p>{detalle.necesidad}</p>
          <p>
            Apertura: {fecha(detalle.fecha_apertura)} · Recolección agendada:{" "}
            {fecha(detalle.fecha_recoleccion_agendada)} · Cierre:{" "}
            {fecha(detalle.fecha_cierre)}
          </p>
          <div className={s.actions}>
            {abierta && (
              <>
                <button
                  onClick={() => {
                    setRegistro(true);
                    setMuestra(undefined);
                    setForm("");
                  }}
                >
                  Registrar muestra recolectada
                </button>
                <button onClick={() => setForm("asociar")}>
                  Vincular muestra anterior
                </button>
                <button onClick={() => setForm("seguimiento")}>
                  Seguimiento / cierre
                </button>
                {detalle.estado_tecnico === "VIABLE" && (
                  <button onClick={() => setForm("cotizacion")}>
                    Nueva versión de cotización
                  </button>
                )}
              </>
            )}
          </div>
          <h3>Muestras y tiempos técnicos</h3>
          <div className={s.actions}>
            {detalle.muestras.map((m: any) => (
              <button
                key={m.id_Muestra}
                onClick={() => {
                  setMuestra(m.id_Muestra);
                  setRegistro(false);
                }}
              >
                Muestra #{m.id_Muestra} · {m.estado_Muestra}
              </button>
            ))}
          </div>
          {(registro || muestra) && (
            <MuestrasID
              key={registro ? `nuevo-${detalle.id}` : muestra}
              area="ventas"
              vista={registro ? "registro" : "detalle"}
              muestraId={muestra}
              oportunidad={{
                id: detalle.id,
                persona_id: detalle.persona_id,
                nombre: detalle.cliente.nombre,
              }}
              onRegistrada={(id) => {
                setRegistro(false);
                setMuestra(id);
                void ejecutar(async () => {
                  const r = await pedir(
                    `${base}/oportunidades/${detalle.id}`,
                    undefined,
                    "GET",
                  );
                  setDetalle(r.data);
                });
              }}
              onCerrar={() => {
                setRegistro(false);
                setMuestra(undefined);
              }}
            />
          )}
          <h3>Reportes de ID</h3>
          {detalle.reportes_id.map((r: any) => (
            <article key={r.id} className={s.historyItem}>
              <strong>
                v{r.version} · {r.resultado} · {r.estado}
              </strong>
              <p>{r.resumen}</p>
              <small>
                {r.publicado_por} · {fecha(r.publicado_en)}
              </small>
              {r.nombre_archivo && (
                <button
                  onClick={() =>
                    void ejecutar(
                      () => descargarCrm("reporte", r.id, r.nombre_archivo),
                      "Documento descargado",
                    )
                  }
                >
                  Descargar reporte
                </button>
              )}
            </article>
          ))}
          <h3>Cotizaciones y revisiones</h3>
          {detalle.cotizaciones.map((c: any) => (
            <article key={c.id} className={s.historyItem}>
              <strong>
                v{c.version} · {dinero(c.total, c.moneda)} · {c.estado}
              </strong>
              <p>
                {c.condiciones_comerciales} · Vigencia:{" "}
                {fecha(c.vigencia_hasta)}
              </p>
              <div className={s.actions}>
                {c.nombre_archivo && (
                  <button
                    onClick={() =>
                      void ejecutar(
                        () =>
                          descargarCrm("cotizacion", c.id, c.nombre_archivo),
                        "Documento descargado",
                      )
                    }
                  >
                    Documento
                  </button>
                )}
                {abierta && ["BORRADOR", "ENVIADA"].includes(c.estado) && (
                  <button
                    onClick={() => {
                      setCot(c);
                      setForm("estadoCotizacion");
                    }}
                  >
                    Registrar envío / respuesta
                  </button>
                )}
                {abierta && c.estado === "ACEPTADA" && !detalle.orden_venta && (
                  <button
                    className={s.primary}
                    onClick={() => {
                      setCot(c);
                      setForm("confirmar");
                    }}
                  >
                    Confirmar orden de venta
                  </button>
                )}
              </div>
            </article>
          ))}
          {detalle.orden_venta && (
            <p className={s.success}>
              Orden #{detalle.orden_venta.id} · {detalle.orden_venta.estado}
            </p>
          )}
          <h3>Historial comercial</h3>
          {detalle.historial.map((h: any) => (
            <article key={h.id} className={s.historyItem}>
              <strong>{nombre(h.accion)}</strong>
              <p>{h.nota}</p>
              <small>
                {h.realizado_por} · {fecha(h.realizado_en)} ·{" "}
                {nombre(h.etapa_anterior ?? "INICIO")} →{" "}
                {nombre(h.etapa_nueva ?? "")}
              </small>
            </article>
          ))}
        </section>
      )}
      {vista === "ordenes" && (
        <section className={s.panel}>
          <h2>Órdenes comerciales</h2>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  {[
                    "Orden",
                    "Cliente",
                    "Confirmación",
                    "Compra",
                    "Importe",
                    "Estado / producción",
                    "Acciones",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenes
                  .filter(
                    (o) =>
                      (!q ||
                        o.cliente.nombre
                          .toLowerCase()
                          .includes(q.toLowerCase())) &&
                      (!desde || o.fecha_confirmacion.slice(0, 10) >= desde) &&
                      (!hasta || o.fecha_confirmacion.slice(0, 10) <= hasta),
                  )
                  .map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.cliente.nombre}</td>
                      <td>{fecha(o.fecha_confirmacion)}</td>
                      <td>{o.tipo_compra}</td>
                      <td>{dinero(o.importe_total, o.moneda)}</td>
                      <td>
                        {o.estado}
                        {o.ordenes_produccion.map((p: any) => (
                          <p key={p.id_Orden_Produc}>
                            OP #{p.id_Orden_Produc} · {p.estado_Plan} ·{" "}
                            {p.cantidad_Planificada} {p.unidad}
                          </p>
                        ))}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setVista("oportunidades");
                            void ejecutar(() => abrir(o.oportunidad_id));
                          }}
                        >
                          Oportunidad
                        </button>
                        {o.estado !== "CANCELADA" && (
                          <>
                            {o.estado !== "CANCELADA" && (
                              <button
                                onClick={() => {
                                  setOv(o);
                                  setForm("produccion");
                                }}
                              >
                                Crear otra OP / reservar materiales
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setOv(o);
                                setForm("cancelarOrden");
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {vista === "muestras" && (
        <>
          <p className={s.help}>
            Registra muestras desde su oportunidad. Para muestras anteriores,
            abre una oportunidad de la misma cuenta y usa “Vincular muestra
            anterior”.
          </p>
          <MuestrasID area="ventas" />
        </>
      )}
    </main>
  );
}
