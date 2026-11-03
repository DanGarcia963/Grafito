"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCw, Users, BriefcaseBusiness, ShoppingCart } from "lucide-react";
import { API_URL, apiFetch, pedir } from "@/utils/api";
import { useRouter } from "next/navigation";
import s from "./VentasCRMAdmin.module.css";

const base = "/api/ventas/crm";
const nombresEtapa: Record<string, string> = {
  REGISTRADA: "Registrada",
  CONTACTADO: "Contactado",
  CITA: "Cita",
};
const nombresEstado: Record<string, string> = {
  CLIENTE: "Cliente",
  PROSPECTO: "Prospecto",
};
const fecha = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("es-MX") : "—";
const moneda = (value?: string | number | null, currency = "MXN") =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Number(value));

type Props = { user: { usuario: string } };

export default function VentasCRMAdmin({ user }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "prospeccion">("general");
  const [subVista, setSubVista] = useState<"cuentas" | "oportunidades" | "ordenes">("cuentas");
  const [dashboard, setDashboard] = useState<any>(null);
  const [metricas, setMetricas] = useState<any>(null);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [totalOportunidades, setTotalOportunidades] = useState(0);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [detalle, setDetalle] = useState<{ tipo: "cuenta" | "oportunidad"; data: any } | null>(null);
  const [opPagina, setOpPagina] = useState(1);
  const [etapa, setEtapa] = useState("");
  const [origen, setOrigen] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [prospeccion, kpis, ops, ovs] = await Promise.all([
        pedir(`${base}/admin/prospeccion`, undefined, "GET"),
        pedir(`${base}/metricas`, undefined, "GET"),
        pedir(`${base}/oportunidades?pagina=${opPagina}`, undefined, "GET"),
        pedir(`${base}/ordenes`, undefined, "GET"),
      ]);
      setDashboard(prospeccion.data);
      setMetricas(kpis.data);
      setOportunidades(ops.data ?? []);
      setTotalOportunidades(ops.total ?? 0);
      setOrdenes(ovs.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos del CRM.");
    } finally {
      setCargando(false);
    }
  }, [opPagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const registros = dashboard?.registros ?? [];
  const vendedores = dashboard?.por_vendedor ?? [];
  const origenes = dashboard?.por_origen ?? [];
  const opcionesOrigen = useMemo(
    () => [...new Set(registros.map((r: any) => r.origen))].sort((a: any, b: any) => a.localeCompare(b, "es")),
    [registros],
  );
  const opcionesVendedor = useMemo(
    () => [...new Set(registros.map((r: any) => r.vendedor))].sort((a: any, b: any) => a.localeCompare(b, "es")),
    [registros],
  );
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es-MX");
    return registros.filter((r: any) =>
      (!etapa || r.etapa === etapa) &&
      (!origen || r.origen === origen) &&
      (!vendedor || r.vendedor === vendedor) &&
      (!q || `${r.nombre} ${r.origen} ${r.vendedor}`.toLocaleLowerCase("es-MX").includes(q)),
    );
  }, [registros, etapa, origen, vendedor, busqueda]);

  const salir = async () => {
    try {
      await pedir("/api/auth/salir");
    } finally {
      localStorage.removeItem("sesion");
      window.dispatchEvent(new Event("sesion-cambiada"));
      router.push("/");
    }
  };

  const abrirCuenta = async (id: number) => {
    try {
      const r = await pedir(`${base}/cuentas/${id}`, undefined, "GET");
      setDetalle({ tipo: "cuenta", data: r.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la cuenta.");
    }
  };
  const abrirOportunidad = async (id: number) => {
    try {
      const r = await pedir(`${base}/oportunidades/${id}`, undefined, "GET");
      setDetalle({ tipo: "oportunidad", data: r.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la oportunidad.");
    }
  };
  const descargar = async (tipo: "cotizacion" | "reporte" | "cuenta", id: number, nombre: string) => {
    try {
      const path = tipo === "cuenta"
        ? `${base}/documentos-cuenta/${id}`
        : `${base}/documentos/${tipo}/${id}`;
      const response = await apiFetch(`${API_URL}${path}`);
      if (!response.ok) throw new Error("No se pudo descargar el documento.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = nombre;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el documento.");
    }
  };

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>US Technologies · Vista administrativa</span>
          <h1>CRM de Ventas</h1>
          <p>Consulta global de prospectos, clientes, oportunidades y órdenes de venta.</p>
        </div>
        <div className={s.headerActions}>
          <span>{user.usuario}</span>
          <button onClick={() => void cargar()} disabled={cargando}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button onClick={() => void salir()}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <nav className={s.tabs} aria-label="Dashboards del CRM">
        <button className={tab === "general" ? s.active : ""} onClick={() => setTab("general")}>
          Dashboard CRM
        </button>
        <button className={tab === "prospeccion" ? s.active : ""} onClick={() => setTab("prospeccion")}>
          Origen y primeras etapas
        </button>
      </nav>

      {error && <p className={s.error} role="alert">{error}</p>}
      {cargando && !dashboard ? <p className={s.loading}>Cargando información comercial…</p> : null}

      {tab === "general" && (
        <>
          <section className={s.metrics}>
            <article><Users /><span>Prospectos en cohorte</span><strong>{metricas?.cohorte ?? 0}</strong><small>{metricas?.convertidos ?? 0} convertidos a cliente</small></article>
            <article><BriefcaseBusiness /><span>Oportunidades abiertas</span><strong>{metricas?.abiertas ?? 0}</strong><small>{metricas?.ganadas ?? 0} ganadas · {metricas?.perdidas ?? 0} perdidas</small></article>
            <article><ShoppingCart /><span>Órdenes confirmadas</span><strong>{metricas?.ordenes_periodo ?? 0}</strong><small>{metricas?.clientes_recompra ?? 0} clientes con recompra</small></article>
            <article><Users /><span>Conversión</span><strong>{metricas?.conversion_prospectos == null ? "—" : `${metricas.conversion_prospectos.toFixed(1)}%`}</strong><small>Sobre los perfiles de la cohorte</small></article>
          </section>
          <nav className={s.subtabs} aria-label="Información CRM">
            <button className={subVista === "cuentas" ? s.selected : ""} onClick={() => setSubVista("cuentas")}>Prospectos y clientes ({registros.length})</button>
            <button className={subVista === "oportunidades" ? s.selected : ""} onClick={() => setSubVista("oportunidades")}>Oportunidades ({totalOportunidades})</button>
            <button className={subVista === "ordenes" ? s.selected : ""} onClick={() => setSubVista("ordenes")}>Órdenes de venta ({ordenes.length})</button>
          </nav>

          {subVista === "cuentas" && (
            <section className={s.panel}>
              <h2>Cartera comercial global</h2>
              <Table headers={["Prospecto / cliente", "Tipo", "Vendedor", "Origen", "Etapa inicial", "Alta"]}>
                {registros.map((r: any) => <tr key={r.persona_id}>
                  <td><button className={s.detailLink} onClick={() => void abrirCuenta(r.persona_id)}>{r.nombre}</button>{!r.activo && <small className={s.muted}> · Inactivo</small>}</td>
                  <td>{nombresEstado[r.estado_comercial] ?? r.estado_comercial}</td>
                  <td>{r.vendedor}</td><td>{r.origen}</td>
                  <td><span className={s.stage}>{nombresEtapa[r.etapa]}</span></td><td>{fecha(r.fecha_alta)}</td>
                </tr>)}
              </Table>
            </section>
          )}
          {subVista === "oportunidades" && (
            <section className={s.panel}>
              <h2>Oportunidades recientes</h2>
              <p className={s.help}>Mostrando hasta 50 registros por página. Esta vista es de solo lectura.</p>
              <Table headers={["Folio", "Prospecto / cliente", "Vendedor", "Origen", "Oportunidad", "Etapa", "Prioridad"]}>
                {oportunidades.map((o: any) => <tr key={o.id}>
                  <td><button className={s.detailLink} onClick={() => void abrirOportunidad(o.id)}>{o.folio}</button></td><td>{o.cliente?.nombre ?? "—"}</td>
                  <td>{o.vendedor?.nombre ?? o.cliente?.crm_perfil_comercial?.vendedor_responsable?.nombre ?? "—"}</td>
                  <td>{o.cliente?.crm_perfil_comercial?.origen_prospecto_tipo === "MARKETING_DIGITAL" ? "Marketing Digital" : o.cliente?.crm_perfil_comercial?.origen_prospecto_tipo === "EXPOSICION" ? `Exposición · ${o.cliente?.crm_perfil_comercial?.origen_prospecto_detalle ?? ""}` : o.cliente?.crm_perfil_comercial?.origen_prospecto_tipo === "REFERENCIA" ? `Referencia · ${o.cliente?.crm_perfil_comercial?.origen_prospecto_detalle ?? ""}` : o.cliente?.crm_perfil_comercial?.origen_prospecto || "Sin clasificar"}</td>
                  <td>{o.titulo}</td><td>{o.etapa?.replaceAll("_", " ")}</td><td>{o.prioridad}</td>
                </tr>)}
              </Table>
              <div className={s.pager}>
                <button disabled={opPagina <= 1} onClick={() => setOpPagina((p) => p - 1)}>Anterior</button>
                <span>Página {opPagina} · {totalOportunidades} oportunidades</span>
                <button disabled={opPagina * 50 >= totalOportunidades} onClick={() => setOpPagina((p) => p + 1)}>Siguiente</button>
              </div>
            </section>
          )}
          {subVista === "ordenes" && (
            <section className={s.panel}>
              <h2>Órdenes de venta de todos los vendedores</h2>
              <Table headers={["Folio", "Cliente", "Vendedor", "Producto", "Importe", "Estado", "Confirmación"]}>
                {ordenes.map((o: any) => <tr key={o.id}>
                  <td>{o.folio}</td><td>{o.cliente?.nombre ?? "—"}</td><td>{o.vendedor?.nombre ?? "—"}</td>
                  <td>{o.producto?.nombre_Producto ?? "—"}</td><td>{moneda(o.importe_total, o.moneda)}</td>
                  <td>{o.estado}</td><td>{fecha(o.fecha_confirmacion)}</td>
                </tr>)}
              </Table>
            </section>
          )}
        </>
      )}

      {tab === "prospeccion" && (
        <>
          <section className={s.stageCards}>
            {(["REGISTRADA", "CONTACTADO", "CITA"] as const).map((key) => (
              <button key={key} className={etapa === key ? s.stageCardSelected : s.stageCard} onClick={() => setEtapa(etapa === key ? "" : key)}>
                <span>{nombresEtapa[key]}</span><strong>{dashboard?.etapas?.[key] ?? 0}</strong>
                <small>{etapa === key ? "Quitar filtro" : "Cuentas"}</small>
              </button>
            ))}
            <article className={s.totalCard}><span>Total de cuentas</span><strong>{dashboard?.total ?? 0}</strong><small>Prospectos y clientes únicos</small></article>
          </section>
          <section className={s.panel}>
            <h2>Resultados por origen y vendedor</h2>
            <p className={s.help}>Cada cuenta se cuenta una sola vez en la etapa más avanzada que alcanzó: una cita prevalece sobre contacto y contacto sobre registro.</p>
            <div className={s.groupTables}>
              <div><h3>Por origen</h3><Table compact headers={["Origen", "Registrada", "Contactado", "Cita", "Total"]}>{origenes.map((g: any) => <tr key={g.origen}><td>{g.origen}</td><td>{g.REGISTRADA}</td><td>{g.CONTACTADO}</td><td>{g.CITA}</td><td><strong>{g.total}</strong></td></tr>)}</Table></div>
              <div><h3>Por vendedor</h3><Table compact headers={["Vendedor", "Registrada", "Contactado", "Cita", "Total"]}>{vendedores.map((g: any) => <tr key={g.vendedor_id ?? "sin-vendedor"}><td>{g.vendedor}</td><td>{g.REGISTRADA}</td><td>{g.CONTACTADO}</td><td>{g.CITA}</td><td><strong>{g.total}</strong></td></tr>)}</Table></div>
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.listHeading}><h2>Prospectos y clientes</h2><span>{filtrados.length} resultados</span></div>
            <div className={s.filters}>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar nombre, origen o vendedor" aria-label="Buscar prospecto" />
              <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} aria-label="Filtrar por vendedor"><option value="">Todos los vendedores</option>{opcionesVendedor.map((x: any) => <option key={x}>{x}</option>)}</select>
              <select value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Filtrar por origen"><option value="">Todos los orígenes</option>{opcionesOrigen.map((x: any) => <option key={x}>{x}</option>)}</select>
              <select value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Filtrar por etapa"><option value="">Todas las etapas</option>{Object.entries(nombresEtapa).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
            </div>
            <Table headers={["Prospecto / cliente", "Tipo", "Vendedor responsable", "Origen", "Etapa", "Oportunidades", "Registro"]}>
              {filtrados.map((r: any) => <tr key={r.persona_id}>
                <td><button className={s.detailLink} onClick={() => void abrirCuenta(r.persona_id)}>{r.nombre}</button>{!r.activo && <small className={s.muted}> · Inactivo</small>}</td>
                <td>{nombresEstado[r.estado_comercial] ?? r.estado_comercial}</td><td>{r.vendedor}</td><td>{r.origen}</td>
                <td><span className={s.stage}>{nombresEtapa[r.etapa]}</span></td><td>{r.oportunidades}</td><td>{fecha(r.fecha_alta)}</td>
              </tr>)}
            </Table>
          </section>
        </>
      )}
      {detalle && (
        <div className={s.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetalle(null); }}>
          <section className={s.dialog} role="dialog" aria-modal="true" aria-label={detalle.tipo === "cuenta" ? "Detalle de cuenta" : "Detalle de oportunidad"}>
            <header className={s.dialogHeader}>
              <div><span className={s.eyebrow}>Consulta global · Solo lectura</span><h2>{detalle.tipo === "cuenta" ? detalle.data.persona.nombre : `${detalle.data.folio} · ${detalle.data.cliente.nombre}`}</h2></div>
              <button onClick={() => setDetalle(null)}>Cerrar</button>
            </header>
            {detalle.tipo === "cuenta"
              ? <DetalleCuenta data={detalle.data} onDescargar={(id, nombre) => void descargar("cuenta", id, nombre)} />
              : <DetalleOportunidad data={detalle.data} onDescargar={(tipo, id, nombre) => void descargar(tipo, id, nombre)} />}
          </section>
        </div>
      )}
    </main>
  );
}

function Table({
  headers,
  children,
  compact = false,
}: {
  headers: string[];
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`${s.tableWrap} ${compact ? s.compact : ""}`}>
      <table><thead><tr>{headers.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table>
      {!children && <p className={s.empty}>No hay registros para mostrar.</p>}
    </div>
  );
}

function DetalleCuenta({ data, onDescargar }: { data: any; onDescargar: (id: number, nombre: string) => void }) {
  const { persona, documentos = [], ordenes = [], oportunidades = [], pedidos_preparacion = [], recurrencia } = data;
  const perfil = persona.crm_perfil_comercial;
  return <div className={s.detailBody}>
    <div className={s.detailGrid}>
      <article><span>Estado comercial</span><strong>{nombresEstado[perfil?.estado_comercial] ?? perfil?.estado_comercial ?? persona.tipo_persona}</strong></article>
      <article><span>Vendedor responsable</span><strong>{perfil?.vendedor_responsable?.nombre ?? "Sin asignar"}</strong></article>
      <article><span>Origen</span><strong>{perfil?.origen_prospecto_tipo === "MARKETING_DIGITAL" ? "Marketing Digital" : perfil?.origen_prospecto_tipo === "EXPOSICION" ? `Exposición · ${perfil.origen_prospecto_detalle ?? ""}` : perfil?.origen_prospecto_tipo === "REFERENCIA" ? `Referencia · ${perfil.origen_prospecto_detalle ?? ""}` : perfil?.origen_prospecto ?? "Sin clasificar"}</strong></article>
      <article><span>Contacto</span><strong>{perfil?.nombre_contacto ?? "—"} · {perfil?.correo ?? "—"} · {perfil?.telefono ?? "—"}</strong></article>
      <article><span>Recompra</span><strong>{recurrencia?.ordenes ?? 0} órdenes · intervalo {recurrencia?.intervalo_dias?.toFixed?.(1) ?? "—"} días</strong></article>
    </div>
    <div className={s.detailSection}><h3>Documentación de la cuenta</h3>{documentos.length ? documentos.map((doc: any) => <p key={doc.id}>{doc.nombre_archivo} · {doc.tipo_documento} · v{doc.version} · {doc.vigente ? "Vigente" : "Anterior"} · {doc.subido_por} <button onClick={() => onDescargar(doc.id, doc.nombre_archivo)}>Descargar</button></p>) : <p>Sin documentos registrados.</p>}</div>
    <div className={s.detailSection}><h3>Oportunidades ({oportunidades.length})</h3>{oportunidades.length ? oportunidades.map((op: any) => <p key={op.id}>{op.folio} · {op.titulo} · {op.etapa.replaceAll("_", " ")} · {op.prioridad}</p>) : <p>Sin oportunidades registradas.</p>}</div>
    <div className={s.detailSection}><h3>Órdenes de venta ({ordenes.length})</h3>{ordenes.length ? ordenes.map((ov: any) => <p key={ov.id}>{ov.folio} · {ov.estado} · {ov.producto?.nombre_Producto ?? "Producto"} · {moneda(ov.importe_total, ov.moneda)} · {ov.ordenes_produccion?.length ?? 0} OP relacionadas</p>) : <p>Sin órdenes de venta.</p>}</div>
    <div className={s.detailSection}><h3>Avisos a Producción ({pedidos_preparacion.length})</h3>{pedidos_preparacion.length ? pedidos_preparacion.map((pedido: any) => <p key={pedido.id}>{pedido.folio} · {pedido.estado} · {fecha(pedido.creado_en)}</p>) : <p>Sin avisos registrados.</p>}</div>
  </div>;
}

function DetalleOportunidad({ data, onDescargar }: { data: any; onDescargar: (tipo: "cotizacion" | "reporte", id: number, nombre: string) => void }) {
  return <div className={s.detailBody}>
    <div className={s.detailGrid}>
      <article><span>Vendedor</span><strong>{data.vendedor?.nombre ?? data.cliente?.crm_perfil_comercial?.vendedor_responsable?.nombre ?? "—"}</strong></article>
      <article><span>Origen</span><strong>{data.cliente?.crm_perfil_comercial?.origen_prospecto_tipo === "MARKETING_DIGITAL" ? "Marketing Digital" : data.cliente?.crm_perfil_comercial?.origen_prospecto_tipo === "EXPOSICION" ? `Exposición · ${data.cliente.crm_perfil_comercial.origen_prospecto_detalle ?? ""}` : data.cliente?.crm_perfil_comercial?.origen_prospecto_tipo === "REFERENCIA" ? `Referencia · ${data.cliente.crm_perfil_comercial.origen_prospecto_detalle ?? ""}` : data.cliente?.crm_perfil_comercial?.origen_prospecto ?? "Sin clasificar"}</strong></article>
      <article><span>Etapa / prioridad</span><strong>{data.etapa.replaceAll("_", " ")} · {data.prioridad}</strong></article>
      <article><span>Producto</span><strong>{data.producto?.nombre_Producto ?? "Pendiente"}</strong></article>
      <article><span>Cantidad estimada</span><strong>{data.cantidad_estimada ?? "—"} {data.unidad ?? ""}</strong></article>
    </div>
    <div className={s.detailSection}><h3>Reportes de I+D</h3>{data.reportes_id?.length ? data.reportes_id.map((r: any) => <p key={r.id}>v{r.version} · {r.resultado} · {r.resumen ?? ""} · {r.estado} {r.nombre_archivo && <button onClick={() => onDescargar("reporte", r.id, r.nombre_archivo)}>Descargar {r.nombre_archivo}</button>}</p>) : <p>Sin reportes.</p>}</div>
    <div className={s.detailSection}><h3>Cotizaciones</h3>{data.cotizaciones?.length ? data.cotizaciones.map((c: any) => <p key={c.id}>{c.folio} · v{c.version} · {c.estado} · {moneda(c.total, c.moneda)} {c.nombre_archivo && <button onClick={() => onDescargar("cotizacion", c.id, c.nombre_archivo)}>Descargar {c.nombre_archivo}</button>}</p>) : <p>Sin cotizaciones.</p>}</div>
    <div className={s.detailSection}><h3>Muestras ({data.muestras?.length ?? 0})</h3>{data.muestras?.length ? data.muestras.map((m: any) => <p key={m.id_Muestra}>{m.no_Muestra ?? `Muestra ${m.id_Muestra}`} · {m.estado_Muestra} · recolección {fecha(m.fecha_recoleccion)} · laboratorio {fecha(m.fecha_ingreso_laboratorio)}</p>) : <p>Sin muestras.</p>}</div>
    <div className={s.detailSection}><h3>Historial</h3>{data.historial?.length ? data.historial.map((h: any) => <p key={h.id}>{fecha(h.realizado_en)} · {h.realizado_por} · {h.accion.replaceAll("_", " ")} · {h.nota ?? ""}</p>) : <p>Sin historial.</p>}</div>
  </div>;
}
