"use client";
import EspecificacionesMaterial from "@/components/EspecificacionesMaterial";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { pedir, sesionActual } from "@/utils/api";
import { useSocket } from "@/context/SocketContext";
import HistorialTiempos from "@/components/HistorialTiempos";
import PlanProduccion from "@/components/PlanProduccion";
import FloatingModal from "@/components/FloatingModal";
import { MessageCircle, X } from "lucide-react";
const estados = [
  "CARGANDO_TANQUE",
  "PROCESO",
  "EVAPORANDO",
  "EVAPORANDO_Y_DESMETALIZANDO",
  "DESMETALIZANDO",
  "POR_AJUSTAR",
  "AJUSTADO",
  "MUESTREO",
  "ESPERA_CALIDAD",
  "POR_DESCARGAR",
  "DESCARGANDO",
];
const input =
    "block w-full border border-slate-600 rounded-lg p-2 bg-slate-950 mt-1",
  boton =
    "rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-700 disabled:opacity-40";
const cantidad = (v: unknown) =>
  Number(v ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 4 });
const etiquetaCondicion: Record<string, string> = {
  SUCIO: "Grafito sucio / por regenerar",
  NUEVO: "Grafito nuevo",
  INTERMEDIO: "Producto intermedio",
  REGENERADO: "Grafito regenerado",
  TERMINADO: "Producto terminado",
  INSUMO: "Insumo",
  FUERA_DE_ESPECIFICACION: "F.E.",
  RESIDUO: "Residuo",
  SIN_CLASIFICAR: "Sin clasificación",
};
const ordenPrensas = [
  "Nuevo",
  "Forgemaster",
  "Fagor",
  "Polymaster",
  "Sin prensa registrada",
];
type FilaExistenciaResumen = {
  condicion?: string | null;
  fisico?: number | string | null;
  lote_inventario_id: number;
  envase_id?: number | null;
  contenedores_restantes?: Array<{
    codigo?: unknown;
    peso_kg?: unknown;
    saldo_kg?: unknown;
  }>;
  atributos?: { tipo_prensa?: unknown } | null;
  especificaciones?: {
    atributos?: { tipo_prensa?: unknown } | null;
    contenedores?: Array<{
      codigo?: unknown;
      tipo_prensa?: unknown;
      atributos?: { tipo_prensa?: unknown } | null;
    }>;
  } | null;
};
type OrdenVentaDisponible = {
  id: number;
  folio: string;
  persona_id: number;
  producto_id: number;
  cantidad: string | number;
  unidad: string;
  tipo_venta: string;
  cliente: { nombre: string };
  producto: { nombre_Producto: string };
};
function resumirContenedores(stock: FilaExistenciaResumen[]) {
  const grupos = new Map<
    string,
    {
      condicion: string;
      envases: Map<string, { prensa: string; kilos: number }>;
      kgFisicos: number;
      kilosSinEnvase: number;
    }
  >();
  for (const fila of stock) {
    const kilos = Number(fila.fisico ?? 0);
    if (!Number.isFinite(kilos) || kilos <= 0) continue;
    const condicion = String(fila.condicion ?? "SIN_CLASIFICAR");
    let grupo = grupos.get(condicion);
    if (!grupo) {
      grupo = { condicion, envases: new Map(), kgFisicos: 0, kilosSinEnvase: 0 };
      grupos.set(condicion, grupo);
    }
    grupo.kgFisicos += kilos;
    const atributos = fila.atributos ?? fila.especificaciones?.atributos;
    const prensaDeLote =
      condicion === "NUEVO"
        ? "Nuevo"
        : String(atributos?.tipo_prensa ?? "").trim();
    const normalizarPrensa = (valor: unknown) => {
      const texto = String(valor ?? "").trim();
      return (
        ordenPrensas.find((p) => p.toLowerCase() === texto.toLowerCase()) ??
        "Sin prensa registrada"
      );
    };
    if (fila.envase_id != null) {
      const llave = `${fila.lote_inventario_id}:id:${fila.envase_id}`;
      const prensa = normalizarPrensa(prensaDeLote);
      const envase = grupo.envases.get(llave) ?? { prensa, kilos: 0 };
      envase.kilos += kilos;
      grupo.envases.set(llave, envase);
      continue;
    }
    if (Array.isArray(fila.contenedores_restantes)) {
      for (const [indice, contenedor] of fila.contenedores_restantes.entries()) {
        const saldo = Number(contenedor.saldo_kg ?? 0);
        if (!Number.isFinite(saldo) || saldo <= 0) continue;
        const codigo = String(contenedor.codigo ?? "sin-codigo-" + (indice + 1));
        const llave = fila.lote_inventario_id + ":codigo:" + codigo;
        if (!grupo.envases.has(llave))
          grupo.envases.set(llave, {
            prensa: normalizarPrensa(prensaDeLote),
            kilos: saldo,
          });
      }
      continue;
    }
    const contenedores = fila.especificaciones?.contenedores ?? [];
    if (contenedores.length) {
      for (const [indice, contenedor] of contenedores.entries()) {
        const codigo = String(contenedor.codigo ?? `sin-codigo-${indice + 1}`);
        const llave = `${fila.lote_inventario_id}:codigo:${codigo}`;
        const prensaContenedor =
          contenedor.tipo_prensa ?? contenedor.atributos?.tipo_prensa ?? prensaDeLote;
        if (!grupo.envases.has(llave)) {
          grupo.envases.set(llave, {
            prensa: normalizarPrensa(prensaContenedor),
            kilos: 0,
          });
        }
      }
      continue;
    }
    grupo.kilosSinEnvase += kilos;
  }
  const ordenCondiciones = [
    "SUCIO",
    "REGENERADO",
    "NUEVO",
    "FUERA_DE_ESPECIFICACION",
    "TERMINADO",
    "INTERMEDIO",
    "INSUMO",
    "RESIDUO",
    "SIN_CLASIFICAR",
  ];
  return [...grupos.values()].sort((a, b) => {
    const ai = ordenCondiciones.indexOf(a.condicion);
    const bi = ordenCondiciones.indexOf(b.condicion);
    return (ai < 0 ? ordenCondiciones.length : ai) - (bi < 0 ? ordenCondiciones.length : bi);
  });
}
const compararFolio = (a: unknown, b: unknown) =>
  String(a ?? "").localeCompare(String(b ?? ""), "es-MX", {
    numeric: true,
    sensitivity: "base",
  });
const prioridadEstadoOP = (op: any) => {
  const estado = String(op?.estado_Plan ?? "").toUpperCase();
  if (estado === "CANCELADA") return 2;
  return ["FINALIZADA", "FINALIZADO"].includes(estado) ? 1 : 0;
};
const pendienteOVs = (op: any) =>
  (op?.ventas_compatibles ?? []).reduce(
    (total: number, venta: any) =>
      total + Number(venta.cantidad_pendiente ?? 0),
    0,
  );
export default function TanquesPage() {
  const socket = useSocket();
  const [productoEspec, setProductoEspec] = useState("");
  const [ordenes, setOrdenes] = useState<any[]>([]),
    [tanques, setTanques] = useState<any[]>([]),
    [muestras, setMuestras] = useState<any[]>([]),
    [bitacora, setBitacora] = useState<any[]>([]),
    [cat, setCat] = useState<any>({ ubicaciones: [] }),
    [stock, setStock] = useState<any[]>([]),
    [lotesPendientes, setLotesPendientes] = useState<any[]>([]);
  const [ordenesVenta, setOrdenesVenta] = useState<OrdenVentaDisponible[]>([]);
  const [asignacionesProductoOV, setAsignacionesProductoOV] = useState<any[]>([]);
  const [pedidosPreparacion, setPedidosPreparacion] = useState<any[]>([]);
  const [bandejaPedidosAbierta, setBandejaPedidosAbierta] = useState(false);
  const [avancePedido, setAvancePedido] = useState<any>(null);
  const [tab, setTab] = useState("tanques"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cargando, setCargando] = useState(true),
    [user, setUser] = useState<any>(null),
    [form, setForm] = useState<{ tipo: string; dato: any } | null>(null),
    [hist, setHist] = useState<{
      entidad: "MUESTRA" | "TANQUE";
      id: number;
    } | null>(null),
    [plan, setPlan] = useState(false);
  const cargar = useCallback(async () => {
    const usuarioActual = sesionActual();
    const [o, t, m, c, maybeLotes, maybeOrdenesVenta, maybeAsignaciones, maybePedidos] = await Promise.all([
      pedir("/api/produccion/test", undefined, "GET"),
      pedir("/api/produccion/tanques?tipo=GRAFITO", undefined, "GET"),
      pedir("/api/calidad/obtenerMuestras", undefined, "GET"),
      pedir("/api/produccion/catalogos", undefined, "GET"),
      pedir("/api/produccion/lotes-pendientes", undefined, "GET"),
      usuarioActual?.area === "produccion"
        ? pedir("/api/produccion/ordenes-venta-disponibles", undefined, "GET")
        : Promise.resolve({ data: [] }),
      usuarioActual?.area === "produccion"
        ? pedir("/api/produccion/asignaciones-producto-ov", undefined, "GET")
        : Promise.resolve({ data: [] }),
      usuarioActual?.area === "produccion"
        ? pedir("/api/ventas/crm/pedidos-preparacion/produccion", undefined, "GET")
        : Promise.resolve({ data: [] }),
    ]);
    setOrdenes(o.result);
    setBitacora(o.bitacora);
    setTanques(t.result);
    setCat(c);
    setLotesPendientes(maybeLotes.data ?? []);
    setOrdenesVenta(maybeOrdenesVenta.data ?? []);
    setAsignacionesProductoOV(maybeAsignaciones.data ?? []);
    setPedidosPreparacion(maybePedidos.data ?? []);
    const ids = new Set(
      o.result.flatMap((o: any) =>
        o.lotes_produccion.map((l: any) => l.id_Lote_Produccion),
      ),
    );
    if (m.data?.success === false) throw new Error(m.data.error);
    setMuestras((m.data?.result ?? []).filter((m: any) => ids.has(m.lote_id)));
    if (sesionActual()?.area === "produccion") {
      const s = await pedir("/api/produccion/existencias", undefined, "GET");
      setStock(s.data);
    }
  }, []);
  useEffect(() => {
    const u = sesionActual();
    setUser(u);
    if (!u) {
      window.location.assign("/");
      return;
    }
    const refresh = () => {
      void cargar()
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false));
    };
    refresh();
    const events = [
      "connect",
      "TANQUE_ACTUALIZADO",
      "ESTATUS_TANQUE_CAMBIADO",
      "MUESTRA_ACTUALIZADA",
      "MUESTRA_CREADA",
      "CRM_PEDIDO_PREPARACION_CREADO",
      "CRM_PEDIDO_PREPARACION_ACTUALIZADO",
    ];
    events.forEach((e) => socket?.on(e, refresh));
    return () => {
      events.forEach((e) => socket?.off(e, refresh));
    };
  }, [cargar, socket]);
  const ejecutar = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      setForm(null);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const lotes = ordenes.flatMap((o) =>
      o.lotes_produccion.map((l: any) => ({ ...l, orden: o })),
    ),
    produccion = user?.area === "produccion";
  const libres = tanques.filter(
    (t) =>
      t.status === "OPERATIVO" &&
      t.estatus_proceso === "VACIO" &&
      !lotes.some((l) => l.tanque_id === t.id_Equipos_Tanques),
  );
  const resumenContenedores = resumirContenedores(stock);
  const ordenesOrdenadas = [...ordenes].sort((a, b) => {
    const prioridad = prioridadEstadoOP(a) - prioridadEstadoOP(b);
    if (prioridad) return prioridad;
    const folio = compararFolio(a.no_Orden_Produc, b.no_Orden_Produc);
    if (folio) return folio;
    return (
      Number(!a.ventas_asignadas?.length) -
      Number(!b.ventas_asignadas?.length)
    );
  });
  const asignacionesOrdenadas = [...asignacionesProductoOV].sort((a, b) => {
    const folio = compararFolio(a.no_Orden_Produc, b.no_Orden_Produc);
    return folio || pendienteOVs(b) - pendienteOVs(a);
  });
  const totalContenedores = resumenContenedores.reduce(
    (total, grupo) => total + grupo.envases.size,
    0,
  );
  const ventasCompatibles =
    form?.tipo === "vincular"
      ? ordenesVenta.filter((ov) => {
          const op = form.dato;
          if (
            ov.producto_id !== op.producto_id ||
            ov.unidad !== op.unidad
          )
            return false;
          const propietario = Number(op.propietario_id ?? 0);
          return propietario > 0
            ? ov.tipo_venta === "SERVICIO_REGENERACION" &&
                ov.persona_id === propietario
            : ov.tipo_venta !== "SERVICIO_REGENERACION";
        })
      : [];
  const actualizarPedidoPreparacion = (pedidoId: number, data: any) =>
    ejecutar(() => pedir(`/api/ventas/crm/pedidos-preparacion/${pedidoId}/progreso`, data));
  const guardarAvancePedido = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!avancePedido) return;
    const datos = new FormData(event.currentTarget);
    const lineas = avancePedido.detalles.map((detalle: any) => ({
      id: detalle.id,
      cantidad_preparada: datos.get(`preparada_${detalle.id}`),
    }));
    void ejecutar(async () => {
      await pedir(`/api/ventas/crm/pedidos-preparacion/${avancePedido.id}/progreso`, {
        detalles: lineas,
        respuesta_produccion: datos.get("respuesta_produccion"),
      });
      setAvancePedido(null);
    });
  };
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-5 md:p-8">
      <header className="flex justify-between flex-wrap gap-3 mb-6">
        <div>
          <p className="text-cyan-400 text-sm">PRODUCCIÓN · GRAFITO</p>
          <h1 className="text-3xl font-bold">Tanques y lotes de producción</h1>
          <p className="text-slate-400 mt-2">
            Órdenes, materiales reservados, procesos y resultados de Calidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className={boton} href="/">
            Inicio
          </Link>
          {!produccion && (
            <Link className={boton} href="/calidad">
              Calidad
            </Link>
          )}
          <button
            className={boton}
            disabled={busy}
            onClick={() => void ejecutar(cargar)}
          >
            Actualizar
          </button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="p-4 border border-red-700 bg-red-950 rounded-xl mb-4"
        >
          {error}
        </p>
      )}
      <nav className="flex flex-wrap gap-2 mb-5">
        {[
          ["tanques", "Tanques"],
          ["ordenes", "Órdenes y lotes"],
          ["asignaciones", "Asignar producto a OV"],
          ["muestras", "Muestras de Calidad"],
          ["inventario", "Existencias"],
          ["bitacora", "Bitácora"],
        ]
          .filter(([key]) =>
            ["inventario", "asignaciones"].includes(String(key))
              ? produccion
              : true,
          )
          .map(([key, label]) => (
            <button
              key={key}
              className={`${boton} ${tab === key ? "bg-cyan-900 border-cyan-500" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
      </nav>
      {cargando ? (
        <p>Cargando datos…</p>
      ) : (
        <>
          {tab === "tanques" && (
            <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tanques.map((t) => {
                const l = lotes.find(
                  (l) => l.tanque_id === t.id_Equipos_Tanques,
                );
                return (
                  <article
                    key={t.id_Equipos_Tanques}
                    className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
                  >
                    <div className="flex justify-between">
                      <h2 className="text-xl font-bold">
                        {t.nombre_Equipo || t.codigo_Equipo}
                      </h2>
                      <span className="text-cyan-300">{t.status}</span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      Capacidad: {cantidad(t.capacidad)} {t.unidad_capacidad}
                    </p>
                    <p className="my-3 font-semibold">
                      {t.estatus_proceso.replaceAll("_", " ")}
                    </p>
                    {l ? (
                      <>
                        <p>
                          Lote <strong>{l.no_Lote}</strong> ·{" "}
                          {l.orden.no_Orden_Produc}
                        </p>
                        <p>{l.orden.productos_materiales.nombre_Producto}</p>
                        <p className="text-slate-400">
                          {l.orden.ventas_asignadas?.length
                            ? l.orden.ventas_asignadas
                                .map(
                                  (a: any) =>
                                    `OV ${a.orden_venta.folio} · ${a.orden_venta.cliente.nombre}`,
                                )
                                .join(" | ")
                            : l.orden.propietario?.nombre ??
                              "Producción propia"}
                        </p>
                        <p className="mt-2">
                          Carga: {cantidad(l.cantidad_cargada ?? l.cantidad_consumida)}{" "}
                          {t.unidad_capacidad}
                        </p>
                        <p>Calidad: {l.estado_Calida}</p>
                        {produccion && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            <button
                              className={boton}
                              disabled={busy}
                              onClick={() =>
                                setForm({ tipo: "estado", dato: t })
                              }
                            >
                              Cambiar proceso
                            </button>
                            <button
                              className={boton}
                              disabled={!libres.length || busy}
                              onClick={() =>
                                setForm({ tipo: "mover", dato: l })
                              }
                            >
                              Trasladar lote
                            </button>
                            <button
                              className={boton}
                              disabled={busy}
                              onClick={() =>
                                setForm({ tipo: "descargar", dato: l })
                              }
                            >
                              Registrar descarga
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400 my-4">
                        Sin lote asignado. Inicia un lote desde su orden de
                        producción.
                      </p>
                    )}
                    <button
                      className={`${boton} mt-3`}
                      onClick={() =>
                        setHist({ entidad: "TANQUE", id: t.id_Equipos_Tanques })
                      }
                    >
                      Tiempos e historial
                    </button>
                  </article>
                );
              })}
              {!tanques.length && <p>No hay tanques GRAFITO configurados.</p>}
            </section>
          )}
          {tab === "ordenes" && (
            <section className="space-y-4">
              {produccion && (
                <div className="flex flex-wrap gap-2">
                  <button className={boton} onClick={() => setPlan(true)}>
                    Crear OP independiente
                  </button>
                  <button className={boton} onClick={() => setForm({ tipo: "lote-pendiente", dato: null })}>
                    Registrar LP antes de asignar OP
                  </button>
                </div>
              )}
              {produccion && lotesPendientes.length > 0 && (
                <section className="space-y-2 rounded-xl border border-amber-700 bg-amber-950/30 p-4">
                  <h2 className="font-bold">Lotes pendientes de asignación o arranque</h2>
                  <p className="text-sm text-slate-300">Estos borradores no reservan ni descuentan inventario. Vincula una OP y el consumo ocurrirá hasta iniciar el lote en un tanque.</p>
                  {lotesPendientes.map((l: any) => (
                    <article key={l.id_Lote_Produccion} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-800 pt-2">
                      <div><strong>{l.no_Lote}</strong> · {l.ordenes_produccion?.no_Orden_Produc ?? "Sin OP"}{l.observaciones && <p>{l.observaciones}</p>}</div>
                      {!l.orden_Produccion_id && <button className={boton} onClick={() => setForm({ tipo: "vincular-lote", dato: l })}>Asignar OP</button>}
                    </article>
                  ))}
                </section>
              )}
              {plan && (
                <PlanProduccion
                  onClose={() => setPlan(false)}
                  onDone={() => {
                    setPlan(false);
                    void cargar();
                  }}
                />
              )}
              {ordenesOrdenadas.map((o) => (
                <article
                  key={o.id_Orden_Produc}
                  className="p-5 border border-slate-700 bg-slate-900 rounded-xl"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        {o.no_Orden_Produc} ·{" "}
                        {o.productos_materiales.nombre_Producto}
                      </h2>
                      <p>
                        {o.tipo_Operacion} · {o.estado_Plan}
                      </p>
                      <p className="text-slate-400">
                        Plan: {cantidad(o.cantidad_Planificada)} {o.unidad} ·
                        Responsable: {o.responsable.nombre}
                      </p>
                      {o.ventas_asignadas?.length ? (
                        <ul className="mt-2 space-y-1 text-slate-300">
                          {o.ventas_asignadas.map((a: any) => (
                            <li key={a.orden_venta_id}>
                              OV {a.orden_venta.folio} ·{" "}
                              {a.orden_venta.cliente.nombre} · Aporta {cantidad(a.cantidad_producto_terminado)} {o.unidad} de producto terminado
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          Sin OV asignada ·{" "}
                          {o.propietario?.nombre ?? "Producción propia"}
                        </p>
                      )}
                    </div>
                    {produccion &&
                      o.estado_Plan !== "CANCELADA" && (
                        <button
                          className={boton}
                          onClick={() => setForm({ tipo: "vincular", dato: o })}
                        >
                          Vincular OV (trazabilidad)
                        </button>
                      )}
                    {produccion &&
                      ["PLANIFICADA", "EN_PROCESO", "PAUSADA"].includes(
                        o.estado_Plan,
                      ) && (
                        <button
                          className={boton}
                          onClick={() => setForm({ tipo: "cerrar", dato: o })}
                        >
                          Cerrar OP
                        </button>
                      )}
                    {produccion &&
                      ["PLANIFICADA", "EN_PROCESO"].includes(o.estado_Plan) && (
                        <button
                          className={boton}
                          disabled={
                            busy ||
                            !libres.length ||
                            !o.reservas_material.some(
                              (r: any) =>
                                r.estado === "ACTIVA" &&
                                Number(r.pendiente) > 0,
                            )
                          }
                          onClick={() => setForm({ tipo: "iniciar", dato: o })}
                        >
                          Iniciar lote en tanque
                        </button>
                      )}
                  </div>
                  <details className="mt-3">
                    <summary>Materiales reservados</summary>
                    {o.reservas_material.map((r: any) => (
                      <p key={r.id}>
                        {r.lote.folio} · {r.lote.producto.nombre_Producto} ·{" "}
                        {r.ubicacion.nombre} · pendiente {cantidad(r.pendiente)}{" "}
                        {r.lote.unidad} · {r.estado}
                      </p>
                    ))}
                  </details>
                  <div className="overflow-auto mt-4">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr>
                          {[
                            "Lote",
                            "Proceso",
                            "Calidad",
                            "Producido",
                            "Acciones",
                          ].map((h) => (
                            <th className="p-2" key={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {o.lotes_produccion.map((l: any) => (
                          <tr
                            className="border-t border-slate-700"
                            key={l.id_Lote_Produccion}
                          >
                            <td className="p-2">{l.no_Lote}</td>
                            <td>{l.estado}</td>
                            <td>{l.estado_Calida}</td>
                            <td>
                              {cantidad(l.cantidad_producida)} {o.unidad}
                              <p className="text-slate-400">
                                Carga: {cantidad(l.cantidad_cargada ?? l.cantidad_consumida)}{" "}
                                {o.unidad}
                              </p>
                              {l.inventario_obtenido?.length ? (
                                <>
                                  <p className="text-slate-400">
                                    Variación neta: {cantidad(l.diferencia_neta)}{" "}
                                    {o.unidad}
                                    {l.rendimiento_porcentaje != null
                                      ? " · Rendimiento: " +
                                        cantidad(l.rendimiento_porcentaje) +
                                        "%"
                                      : ""}
                                  </p>
                                  <p className="text-slate-400">
                                    Contenedores descargados:{" "}
                                    {cantidad(l.contenedores_producidos)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-slate-400">
                                  Pendiente de descarga
                                </p>
                              )}
                            </td>
                            <td>
                              <button
                                className={boton}
                                onClick={() =>
                                  setForm({ tipo: "nota", dato: l })
                                }
                              >
                                Añadir nota
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
              {!ordenes.length && <p>No hay órdenes de la línea GRAFITO.</p>}
            </section>
          )}
          {tab === "asignaciones" && produccion && (
            <section className="space-y-4">
              <div className="rounded-xl border border-cyan-800 bg-cyan-950/30 p-4">
                <h2 className="font-bold text-cyan-100">Producto terminado disponible para pedidos</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Esta bandeja muestra OP finalizadas y producto descargado con liberación de Calidad. La carga de entrada de la OP no cuenta como cumplimiento; registra cuánto producto terminado real aporta a cada OV. El mismo kg no puede asignarse a dos ventas. Solo aparecen OV previamente vinculadas desde “Órdenes y lotes”.
                </p>
              </div>
              {asignacionesOrdenadas.map((op: any) => (
                <article key={op.id_Orden_Produc} className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">OP {op.no_Orden_Produc} · {op.producto}</h3>
                      <p className="text-slate-400">{op.linea_Produccion ?? "Sin línea"} · {op.propietario ?? "Producción propia"} · Cerrada {op.fecha_Termino_Real ? new Date(op.fecha_Termino_Real).toLocaleDateString("es-MX") : ""}</p>
                    </div>
                    <div className="text-sm">
                      <p>Producto liberado: <strong>{cantidad(op.cantidad_producida_liberada)} {op.unidad}</strong></p>
                      <p>Ya asignado: {cantidad(op.cantidad_producto_terminado_asignada)} {op.unidad}</p>
                      <p className={op.sobreasignada ? "text-red-300" : "text-emerald-300"}>
                        Disponible: {cantidad(op.cantidad_producto_terminado_disponible)} {op.unidad}
                        {op.sobreasignada ? " · revisar sobreasignación" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm text-left">
                      <thead><tr className="text-slate-400"><th className="p-2">Lote de producción</th><th>Inventario terminado</th><th>Condición</th><th>Cantidad liberada</th></tr></thead>
                      <tbody>
                        {op.lotes.map((l: any) => (
                          <tr className="border-t border-slate-700" key={l.id_inventario}>
                            <td className="p-2">{l.no_Lote ?? `LP #${l.id_Lote_Produccion}`}</td>
                            <td>{l.folio_inventario}</td>
                            <td>{etiquetaCondicion[l.condicion] ?? l.condicion}</td>
                            <td>{cantidad(l.cantidad)} {op.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">OV vinculadas a esta OP</h4>
                    {[...op.ventas_compatibles]
                      .sort(
                        (a: any, b: any) =>
                          Number(b.cantidad_pendiente ?? 0) -
                            Number(a.cantidad_pendiente ?? 0) ||
                          compararFolio(a.folio, b.folio),
                      )
                      .map((ov: any) => {
                      const actual = Number(ov.cantidad_asignada_desde_esta_op ?? 0);
                      const maximo = Math.min(
                        Number(op.cantidad_producto_terminado_disponible ?? 0) + actual,
                        Number(ov.cantidad_pendiente ?? 0) + actual,
                      );
                      const puedeAumentar = maximo > actual;
                      return (
                        <div key={ov.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 p-3">
                          <div>
                            <strong>OV {ov.folio} · {ov.cliente}</strong>
                            <p className="text-sm text-slate-400">Pedido {cantidad(ov.cantidad)} {ov.unidad} · Aporte de esta OP: {cantidad(actual)} {ov.unidad} · Pendiente global de la OV: {cantidad(ov.cantidad_pendiente)} {ov.unidad}</p>
                            {!puedeAumentar && actual === 0 && (
                              <p className="text-sm text-amber-300">
                                Relación visible; no hay producto disponible para asignar desde esta OP.
                              </p>
                            )}
                          </div>
                          <button disabled={!puedeAumentar && actual === 0} title={!puedeAumentar && actual === 0 ? "No hay producto terminado disponible para asignar" : undefined} className={boton} onClick={() => setForm({ tipo: "asignar-producto", dato: { op, venta: ov } })}>
                            {actual > 0 ? "Ajustar aporte" : "Asignar producto"}
                          </button>
                        </div>
                      );
                    })}
                    {!op.ventas_compatibles.length && (
                      <p className="text-sm text-slate-400">No hay OV confirmadas vinculadas y compatibles con esta OP. Primero relaciónala desde “Órdenes y lotes” con “Vincular OV”.</p>
                    )}
                  </div>
                </article>
              ))}
              {!asignacionesProductoOV.length && (
                <p className="rounded-xl border border-slate-700 p-5 text-slate-300">Todavía no hay OP cerradas con producto terminado liberado para asignar.</p>
              )}
            </section>
          )}
          {tab === "muestras" && (
            <section className="space-y-3">
              <p>
                {produccion
                  ? "Seguimiento de las muestras asociadas a los lotes de Grafito. El análisis y el dictamen los realiza Calidad."
                  : <>La recepción, los análisis y el dictamen se registran en{" "}
                    <Link href="/calidad" className="underline text-cyan-300">Calidad</Link>.</>}
              </p>
              {muestras.map((m) => (
                <article
                  key={m.id_Muestra}
                  className="border border-slate-700 rounded-xl p-4 bg-slate-900"
                >
                  <h2 className="font-bold">
                    {m.no_Muestra} · {m.productos_materiales?.nombre_Producto}
                  </h2>
                  {m.categoria_Muestra === "MUESTRA_AJUSTADO" && (
                    <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${m.certificado_calidad ? "border-emerald-700 bg-emerald-950/50 text-emerald-300" : "border-amber-700 bg-amber-950/40 text-amber-200"}`}>
                      {m.certificado_calidad ? "Certificado cargado" : "Sin certificado"}
                    </span>
                  )}
                  <p>
                    Lote {m.lotes_produccion?.no_Lote} · {m.estado_Muestra} ·{" "}
                    {m.categoria_Muestra}
                  </p>
                  <p>{m.observaciones}</p>
                  <button
                    className={`${boton} mt-2`}
                    onClick={() =>
                      setHist({ entidad: "MUESTRA", id: m.id_Muestra })
                    }
                  >
                    Tiempos y análisis
                  </button>
                  {m.estado_Muestra === "RECHAZADO" &&
                    m.categoria_Muestra === "MUESTRA_AJUSTADO" &&
                    user?.area === "produccion" &&
                    Number(m.tiempoActual?.ciclo ?? 1) === 1 && (
                      <button
                        className={boton}
                        disabled={busy}
                        onClick={() =>
                          void ejecutar(() =>
                            pedir(
                              `/api/calidad/${m.id_Muestra}/segundo-ciclo`,
                              {},
                            ),
                          )
                        }
                      >
                        Solicitar segundo ciclo de análisis
                      </button>
                    )}
                  {m.estado_Muestra === "RECHAZADO" &&
                    user?.area === "calidad" &&
                    m.categoria_Muestra !== "MUESTRA_AJUSTADO" && (
                      <>
                        <button
                          className={boton}
                          disabled={busy}
                          onClick={() =>
                            void ejecutar(() =>
                              pedir(`/api/calidad/${m.id_Muestra}/reabrir`, {}),
                            )
                          }
                        >
                          Reabrir análisis / segundo ajuste
                        </button>
                      </>
                    )}
                </article>
              ))}
              {!muestras.length && (
                <p>Sin muestras asociadas a lotes de Grafito.</p>
              )}
            </section>
          )}
          {tab === "inventario" && (
            <section>
              <div className="flex gap-2 mb-4">
                <button
                  className={boton}
                  onClick={() => setForm({ tipo: "apertura", dato: null })}
                >
                  Registrar inventario inicial
                </button>
                <button
                  className={boton}
                  onClick={() => setForm({ tipo: "recepcion", dato: null })}
                >
                  Recibir material
                </button>
                <button
                  className={boton}
                  onClick={() => setForm({ tipo: "ubicacion", dato: null })}
                >
                  Nueva ubicación
                </button>
              </div>
              <p className="mb-3">
                Saldos por lote y ubicación. F.E. solo puede reservarse para
                reproceso; nunca para entrega.
              </p>
                            <div className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Contenedores en existencia</h2>
                    <p className="text-sm text-slate-400">
                      Cuenta los contenedores que todavía tienen producto. El
                      saldo se distribuye FIFO según los kg registrados y
                      consumidos por lote.
                    </p>
                  </div>
                  <p className="text-lg font-bold text-cyan-300">
                    Total: {cantidad(totalContenedores)} contenedores
                  </p>
                </div>
                {resumenContenedores.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {resumenContenedores.map((grupo) => {
                      const porPrensa = new Map<string, { contenedores: number; kilos: number }>();
                      for (const envase of grupo.envases.values()) {
                        const actual = porPrensa.get(envase.prensa) ?? { contenedores: 0, kilos: 0 };
                        actual.contenedores += 1;
                        actual.kilos += envase.kilos;
                        porPrensa.set(envase.prensa, actual);
                      }
                      const prensas = [...porPrensa.entries()].sort(
                        ([a], [b]) => ordenPrensas.indexOf(a) - ordenPrensas.indexOf(b),
                      );
                      return (
                        <article
                          key={grupo.condicion}
                          className="rounded-lg border border-slate-700 bg-slate-950 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="font-semibold">
                              {etiquetaCondicion[grupo.condicion] ?? grupo.condicion}
                            </h3>
                            <span className="font-bold text-cyan-300">
                              {cantidad(grupo.envases.size)} contenedores · {cantidad(grupo.kgFisicos)} kg
                            </span>
                          </div>
                          {prensas.length ? (
                            <ul className="space-y-1 text-sm">
                              {prensas.map(([prensa, detalle]) => (
                                <li key={prensa} className="flex justify-between gap-3">
                                  <span>{prensa}</span>
                                  <span>
                                    {cantidad(detalle.contenedores)} contenedores
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-400">Sin envases identificados.</p>
                          )}
                          {grupo.kilosSinEnvase > 0 && (
                            <p className="mt-2 border-t border-slate-800 pt-2 text-sm text-amber-300">
                              Sin desglose por contenedor: {cantidad(grupo.kilosSinEnvase)} kg
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No hay existencias físicas registradas.</p>
                )}
              </div>
<div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {[
                        "Lote / producto",
                        "Ubicación",
                        "Propiedad",
                        "Físico",
                        "Reservado",
                        "Disponible",
                      ].map((h) => (
                        <th className="p-3" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((s) => (
                      <tr
                        key={`${s.lote_inventario_id}:${s.ubicacion_id}`}
                        className="border-t border-slate-700"
                      >
                        <td className="p-3">
                          {s.folio}
                          <p>
                            {s.producto} · {s.condicion}
                          </p>
                          <p>
                            {Object.entries(s.especificaciones?.atributos ?? {})
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                          <details>
                            <summary>
                              Contenedores con saldo:{" "}
                              {Array.isArray(s.contenedores_restantes)
                                ? s.contenedores_restantes.length
                                : s.especificaciones?.contenedores?.length ??
                                  "Sin detalle"}
                            </summary>
                            {Array.isArray(s.contenedores_restantes)
                              ? s.contenedores_restantes.map((c: any) => (
                                  <p key={c.codigo}>
                                    {c.codigo}: {cantidad(c.saldo_kg)} kg de{" "}
                                    {cantidad(c.peso_kg)} kg
                                  </p>
                                ))
                              : s.especificaciones?.contenedores?.map(
                                  (c: any) => (
                                    <p key={c.codigo}>
                                      {c.codigo}: {c.peso_kg} kg
                                    </p>
                                  ),
                                )}
                          </details>
                          <p>
                            Disponible reproceso:{" "}
                            {cantidad(s.disponible_reproceso)} {s.unidad}
                          </p>
                          {![
                            "FUERA_DE_ESPECIFICACION",
                            "RESIDUO",
                            "REZAGADO",
                          ].includes(s.condicion) && (
                            <button
                              className={boton}
                              onClick={() =>
                                setForm({ tipo: "rezagado", dato: s })
                              }
                            >
                              Marcar rezagado
                            </button>
                          )}
                        </td>
                        <td>{s.ubicacion}</td>
                        <td>{s.propiedad}</td>
                        <td>
                          {cantidad(s.fisico)} {s.unidad}
                        </td>
                        <td>
                          {cantidad(s.reservado)} {s.unidad}
                          {Number(s.reservado_producto_venta ?? 0) > 0 && (
                            <p className="text-xs text-amber-300">
                              {cantidad(s.reservado_producto_venta)} {s.unidad} comprometidos a OV
                            </p>
                          )}
                        </td>
                        <td>
                          {cantidad(s.disponible)} {s.unidad}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === "bitacora" && (
            <section className="space-y-3">
              <p>Últimos 500 eventos de los lotes de Grafito.</p>
              {bitacora.map((e) => (
                <article
                  className="p-3 border border-slate-700 rounded"
                  key={e.id}
                >
                  <strong>{e.accion}</strong> · Lote #{e.lote_id} ·{" "}
                  {new Date(e.fecha).toLocaleString("es-MX")}
                  <p className="text-sm text-slate-400 break-words">
                    {e.detalle}
                  </p>
                </article>
              ))}
            </section>
          )}
        </>
      )}
      {form && (
        <div className="fixed inset-0 bg-black/70 z-40 p-4 flex items-center justify-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={form.tipo}
            className="max-w-xl w-full max-h-[90vh] overflow-auto p-6 rounded-xl bg-slate-900 border border-slate-600"
          >
            <h2 className="text-xl font-bold mb-4">
              {
                (
                  {
                    apertura: "Registrar inventario existente",
                    recepcion: "Recibir material en inventario",
                    ubicacion: "Nueva ubicación de almacén",
                    cerrar: "Cerrar orden de producción",
                    iniciar: "Iniciar lote de producción",
                    mover: "Trasladar lote completo",
                    descargar: "Registrar producto obtenido",
                    vincular: "Relacionar OP con orden de venta",
                    "asignar-producto": "Asignar producto terminado a OV",
                    rezagado: "Marcar material rezagado",
                    estado: "Cambiar proceso del tanque",
                    nota: "Añadir nota a la bitácora",
                    "lote-pendiente": "Registrar lote de producción pendiente",
                    "vincular-lote": "Asignar lote pendiente a una OP",
                  } as Record<string, string>
                )[form.tipo]
              }
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const b: Record<string, any> = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                if (b.especificaciones)
                  b.especificaciones = JSON.parse(b.especificaciones);
                if (
                  form.tipo === "descargar" &&
                  form.dato.orden.linea_Produccion?.toUpperCase() === "GRAFITO" &&
                  form.dato.orden.unidad === "Kilogramos"
                ) {
                  const contenedores = b.especificaciones?.contenedores;
                  if (!Array.isArray(contenedores) || contenedores.length === 0) {
                    setError("Registra cada contenedor y su peso real para descargar el producto obtenido.");
                    return;
                  }
                  const totalContenedores = contenedores.reduce(
                    (total: number, contenedor: any) =>
                      total + Number(contenedor.peso_kg),
                    0,
                  );
                  if (
                    !Number.isFinite(totalContenedores) ||
                    Math.abs(totalContenedores - Number(b.cantidad)) > 0.00005
                  ) {
                    setError("La suma de los pesos de los contenedores debe coincidir con la cantidad realmente obtenida.");
                    return;
                  }
                }
                void ejecutar(async () => {
                  const d = form.dato;
                  if (form.tipo === "lote-pendiente")
                    await pedir("/api/produccion/lotes/pendiente", b);
                  if (form.tipo === "vincular-lote")
                    await pedir(`/api/produccion/lotes/${d.id_Lote_Produccion}/vincular-orden`, b);
                  if (form.tipo === "apertura")
                    await pedir("/api/produccion/inventario/apertura", b);
                  if (form.tipo === "recepcion")
                    await pedir("/api/produccion/recepciones", b);
                  if (form.tipo === "ubicacion")
                    await pedir("/api/produccion/ubicaciones", b);
                  if (form.tipo === "cerrar")
                    await pedir(
                      `/api/produccion/ordenes/${d.id_Orden_Produc}/cerrar`,
                      b,
                    );
                  if (form.tipo === "estado")
                    await pedir(
                      "/api/produccion/actualizarEstatusTanque",
                      {
                        tanqueId: d.id_Equipos_Tanques,
                        estatus_proceso: b.estado,
                      },
                      "PUT",
                    );
                  if (form.tipo === "mover")
                    await pedir(
                      "/api/produccion/actualizar",
                      {
                        idLoteProduccion: d.id_Lote_Produccion,
                        tanqueId: Number(b.tanque_id),
                      },
                      "PUT",
                    );
                  if (form.tipo === "vincular")
                    await pedir(
                      `/api/produccion/ordenes/${d.id_Orden_Produc}/vincular-venta`,
                      b,
                    );
                  if (form.tipo === "asignar-producto")
                    await pedir(
                      `/api/produccion/ordenes/${d.op.id_Orden_Produc}/asignar-producto-ov`,
                      {
                        orden_venta_id: d.venta.id,
                        cantidad_producto_terminado:
                          b.cantidad_producto_terminado,
                      },
                    );
                  if (form.tipo === "rezagado")
                    await pedir(
                      `/api/produccion/inventario/${d.lote_inventario_id}/rezagado`,
                      b,
                    );
                  if (form.tipo === "descargar")
                    await pedir(
                      `/api/produccion/lotes/${d.id_Lote_Produccion}/descargar`,
                      b,
                    );
                  if (form.tipo === "nota")
                    await pedir("/api/produccion/guardarBitacora", {
                      idLoteProduccion: d.id_Lote_Produccion,
                      registro: { observaciones: b.nota },
                    });
                  if (form.tipo === "iniciar")
                    await pedir("/api/produccion/lotes", {
                      ...b,
                      orden_produccion_id: d.id_Orden_Produc,
                      consumos: d.reservas_material
                        .map((r: any) => ({
                          reserva_id: r.id,
                          cantidad: b[`reserva-${r.id}`],
                        }))
                        .filter((r: any) => Number(r.cantidad) > 0),
                    });
                });
              }}
            >
              <fieldset disabled={busy} className="grid gap-4">
                {form.tipo === "lote-pendiente" && (
                  <>
                    <p>Registra el folio del lote antes de definir su OP. Este paso no consume inventario ni ocupa un tanque.</p>
                    <label>Folio del lote<input required name="no_Lote" maxLength={50} className={input} /></label>
                    <label>Observaciones<textarea name="observaciones" maxLength={4000} className={input} /></label>
                  </>
                )}
                {form.tipo === "vincular-lote" && (
                  <>
                    <p>Solo se muestran OP de Grafito planificadas o en proceso. El inventario se reservará/consumirá al iniciar el lote en tanque.</p>
                    <label>Orden de producción
                      <select required name="orden_produccion_id" className={input}>
                        <option value="">Selecciona</option>
                        {ordenes.filter((o: any) => o.linea_Produccion?.toUpperCase() === "GRAFITO" && ["PLANIFICADA", "EN_PROCESO"].includes(o.estado_Plan)).map((o: any) => (
                          <option key={o.id_Orden_Produc} value={o.id_Orden_Produc}>{o.no_Orden_Produc} · {o.productos_materiales.nombre_Producto}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {form.tipo === "ubicacion" && (
                  <>
                    <label>
                      Código
                      <input required name="codigo" className={input} />
                    </label>
                    <label>
                      Nombre
                      <input required name="nombre" className={input} />
                    </label>
                  </>
                )}
                {form.tipo === "cerrar" && (
                  <>
                    <p>
                      Se liberarán las reservas no consumidas. Los consumos y
                      productos ya obtenidos permanecen en el historial.
                    </p>
                    <label>
                      Estado
                      <select name="estado" className={input}>
                        <option>FINALIZADA</option>
                        <option>CANCELADA</option>
                      </select>
                    </label>
                    <label>
                      Motivo
                      <textarea required name="motivo" className={input} />
                    </label>
                  </>
                )}
                {form.tipo === "apertura" && (
                  <>
                    <p>
                      Captura existencias físicas anteriores al sistema. Esto crea
                      un lote y un movimiento de apertura; no inventa recepción ni
                      muestra. Registra el estado real de Calidad.
                    </p>
                    <label>
                      Folio del lote de apertura
                      <input required name="folio" maxLength={100} className={input} />
                    </label>
                    <label>
                      Producto
                      <select required name="producto_id" className={input}
                        value={productoEspec} onChange={(e) => setProductoEspec(e.target.value)}>
                        <option value="">Selecciona</option>
                        {cat.productos?.map((p: any) => (
                          <option key={p.id_Produc_Mater} value={p.id_Produc_Mater}>
                            {p.nombre_Producto} · {p.UM}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cantidad en la unidad del producto
                      <input required name="cantidad" type="number" min="0.0001" step="0.0001" className={input} />
                    </label>
                    <label>
                      Propiedad
                      <select required name="propiedad" className={input}>
                        <option value="PROPIO">Propio</option>
                        <option value="DE_CLIENTE">Propiedad de un cliente</option>
                      </select>
                    </label>
                    <label>
                      Cliente propietario (solo si es material de cliente)
                      <select name="propietario_id" className={input} defaultValue="">
                        <option value="">Sin propietario / propio</option>
                        {cat.personas?.map((p: any) => (
                          <option key={p.id_Persona} value={p.id_Persona}>{p.nombre}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Condición física
                      <select required name="condicion" className={input} defaultValue="SUCIO">
                        <option value="NUEVO">Nuevo</option>
                        <option value="SUCIO">Sucio para regenerar</option>
                        <option value="REZAGADO">Rezagado: producto que quedó</option>
                        <option value="FUERA_DE_ESPECIFICACION">F.E.: rechazado por Calidad</option>
                        <option value="INTERMEDIO">Intermedio</option>
                        <option value="REGENERADO">Regenerado</option>
                        <option value="TERMINADO">Terminado</option>
                        <option value="INSUMO">Insumo</option>
                      </select>
                    </label>
                    <label>
                      Estado actual de Calidad
                      <select required name="estado_calidad_recepcion" className={input} defaultValue="CUARENTENA">
                        <option value="CUARENTENA">Cuarentena</option>
                        <option value="LIBERADO">Liberado</option>
                        <option value="BLOQUEADO">Bloqueado</option>
                        <option value="RECHAZADO">Rechazado (solo F.E.)</option>
                      </select>
                    </label>
                    <label>
                      Ubicación inicial
                      <select required name="ubicacion_id" className={input}>
                        <option value="">Selecciona</option>
                        {cat.ubicaciones.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.nombre}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Observaciones y referencia del inventario físico
                      <textarea required name="observaciones" maxLength={4000} className={input} />
                    </label>
                    <EspecificacionesMaterial
                      key={productoEspec}
                      config={cat.productos.find((p: any) => String(p.id_Produc_Mater) === productoEspec)?.configuracion_operativa}
                      unidad={cat.productos.find((p: any) => String(p.id_Produc_Mater) === productoEspec)?.UM}
                    />
                  </>
                )}
                {form.tipo === "recepcion" && (
                  <>
                    <p>
                      La recepción crea una muestra para Calidad. El material
                      queda en cuarentena hasta su dictamen.
                    </p>
                    <label>
                      Folio de recepción
                      <input
                        required
                        name="folio"
                        maxLength={80}
                        className={input}
                      />
                    </label>
                    <label>
                      Remitente / cliente propietario
                      <select required name="remitente_id" className={input}>
                        <option value="">Selecciona</option>
                        {cat.personas?.map((p: any) => (
                          <option key={p.id_Persona} value={p.id_Persona}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Producto
                      <select
                        required
                        name="producto_id"
                        className={input}
                        value={productoEspec}
                        onChange={(e) => setProductoEspec(e.target.value)}
                      >
                        <option value="">Selecciona</option>
                        {cat.productos?.map((p: any) => (
                          <option
                            key={p.id_Produc_Mater}
                            value={p.id_Produc_Mater}
                          >
                            {p.nombre_Producto} · {p.UM}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cantidad (en la unidad del producto)
                      <input
                        required
                        name="cantidad"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        className={input}
                      />
                    </label>
                    <label>
                      Propiedad
                      <select name="propiedad" className={input}>
                        <option value="DE_CLIENTE">
                          Del cliente: material para regenerar
                        </option>
                        <option value="PROPIO">Propio: insumo</option>
                      </select>
                    </label>
                    <label>
                      ID de orden de venta (opcional)
                      <input
                        name="orden_venta_id"
                        type="number"
                        min="1"
                        className={input}
                      />
                    </label>
                    <label>
                      Ubicación
                      <select required name="ubicacion_id" className={input}>
                        <option value="">Selecciona</option>
                        {cat.ubicaciones.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {form.tipo === "recepcion" && (
                  <>
                    <label>
                      Condición
                      <select name="condicion" className={input}>
                        <option value="SUCIO">Sucio para regenerar</option>
                        <option value="INSUMO">Insumo</option>
                        <option value="REZAGADO">
                          Rezagado: material que quedó
                        </option>
                      </select>
                    </label>
                    <EspecificacionesMaterial
                      key={productoEspec}
                      config={
                        cat.productos.find(
                          (p: any) =>
                            String(p.id_Produc_Mater) === productoEspec,
                        )?.configuracion_operativa
                      }
                      unidad={
                        cat.productos.find(
                          (p: any) =>
                            String(p.id_Produc_Mater) === productoEspec,
                        )?.UM
                      }
                    />
                  </>
                )}
                {form.tipo === "vincular" && (
                  <label>
                    Orden de venta activa
                    <select required name="orden_venta_id" className={input}>
                      <option value="">Selecciona una OV</option>
                      {ventasCompatibles.map((ov) => (
                        <option key={ov.id} value={ov.id}>
                          {ov.folio} · {ov.cliente.nombre} ·{" "}
                          {ov.producto.nombre_Producto} · {cantidad(ov.cantidad)}{" "}
                          {ov.unidad}
                        </option>
                      ))}
                    </select>
                    {!ventasCompatibles.length && (
                      <p className="mt-2 text-sm text-amber-300">
                        No hay órdenes confirmadas compatibles con el producto,
                        la unidad y el propietario de esta OP.
                      </p>
                    )}
                    <p className="mt-2 text-sm text-slate-400">
                      Esto solo enlaza la trazabilidad OV↔OP para planear el
                      trabajo y registrar propiedad. No cuenta kg de
                      cumplimiento; el aporte se captura cuando la OP está
                      finalizada y su producto terminado fue liberado.
                    </p>
                  </label>
                )}
                {form.tipo === "asignar-producto" && (() => {
                  const { op, venta } = form.dato;
                  const actual = Number(
                    venta.cantidad_asignada_desde_esta_op ?? 0,
                  );
                  const maximo = Math.min(
                    Number(op.cantidad_producto_terminado_disponible ?? 0) + actual,
                    Number(venta.cantidad_pendiente ?? 0) + actual,
                  );
                  return (
                    <>
                      <input type="hidden" name="orden_venta_id" value={venta.id} />
                      <p>OP <strong>{op.no_Orden_Produc}</strong> → OV <strong>{venta.folio}</strong> · {venta.cliente}</p>
                      <p className="text-sm text-slate-300">La cantidad es producto terminado real de esta OP. Disponible en la OP para esta actualización: hasta {cantidad(maximo)} {op.unidad}. Captura 0 para retirar el aporte existente.</p>
                      <label>
                        Producto terminado aportado a esta OV ({op.unidad})
                        <input
                          required
                          name="cantidad_producto_terminado"
                          type="number"
                          min="0"
                          max={maximo}
                          step="0.0001"
                          defaultValue={actual || ""}
                          className={input}
                        />
                      </label>
                    </>
                  );
                })()}
                {form.tipo === "rezagado" && (
                  <label>
                    Motivo
                    <textarea required name="motivo" className={input} />
                    <p>Conserva su dictamen de Calidad.</p>
                  </label>
                )}
                {form.tipo === "estado" && (
                  <label>
                    Etapa
                    <select
                      required
                      name="estado"
                      className={input}
                      defaultValue={form.dato.estatus_proceso}
                    >
                      {estados.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                )}
                {["iniciar", "mover"].includes(form.tipo) && (
                  <label>
                    Tanque destino
                    <select required name="tanque_id" className={input}>
                      <option value="">Selecciona</option>
                      {libres.map((t) => (
                        <option
                          value={t.id_Equipos_Tanques}
                          key={t.id_Equipos_Tanques}
                        >
                          {t.nombre_Equipo || t.codigo_Equipo} · {t.capacidad}{" "}
                          {t.unidad_capacidad}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {form.tipo === "iniciar" && (
                  <>
                    <label>
                      Folio del lote
                      <input
                        className={input}
                        required
                        name="no_Lote"
                        maxLength={50}
                        list={`lotes-pendientes-${form.dato.id_Orden_Produc}`}
                      />
                      <datalist id={`lotes-pendientes-${form.dato.id_Orden_Produc}`}>
                        {lotesPendientes
                          .filter((l: any) => l.orden_Produccion_id === form.dato.id_Orden_Produc)
                          .map((l: any) => <option key={l.id_Lote_Produccion} value={l.no_Lote} />)}
                      </datalist>
                    </label>
                    <p>
                      Puedes elegir un LP pendiente de esta OP o capturar un folio nuevo. Indica la cantidad de cada material que cargarás. El resto
                      sigue reservado para los siguientes lotes.
                    </p>
                    {form.dato.reservas_material
                      .filter(
                        (r: any) =>
                          r.estado === "ACTIVA" && Number(r.pendiente) > 0,
                      )
                      .map((r: any) => (
                        <label key={r.id}>
                          {r.lote.folio} · {r.lote.producto.nombre_Producto} ·
                          disponible {r.pendiente} {r.lote.unidad}
                          <input
                            className={input}
                            name={`reserva-${r.id}`}
                            type="number"
                            min="0"
                            max={r.pendiente}
                            step="0.0001"
                            defaultValue="0"
                          />
                        </label>
                      ))}
                  </>
                )}
                {form.tipo === "descargar" && (
                  <>
                    <p>
                      La descarga registra existencia física y deja el tanque
                      vacío. El producto conserva su dictamen de Calidad.
                    </p>
                    <label>
                      Cantidad realmente obtenida ({form.dato.orden.unidad})
                      <input
                        required
                        className={input}
                        name="cantidad"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                      />
                    </label>
                    <label>
                      Ubicación de destino
                      <select required className={input} name="ubicacion_id">
                        <option value="">Selecciona</option>
                        {cat.ubicaciones.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {form.tipo === "descargar" && (
                  <>
                    <label>
                      Destino del material
                      <select required name="destino_calidad" className={input}>
                        <option value="CONSERVAR">
                          Conservar dictamen actual (sin liberar)
                        </option>
                        <option value="FE">
                          F.E.: última muestra ajustada rechazada
                        </option>
                      </select>
                    </label>
                    <EspecificacionesMaterial
                      key={"descarga-" + form.dato.id_Lote_Produccion}
                      config={
                        form.dato.orden.productos_materiales
                          ?.configuracion_operativa
                      }
                      unidad={form.dato.orden.unidad}
                      contenedoresObligatorios={
                        form.dato.orden.linea_Produccion?.toUpperCase() ===
                          "GRAFITO" &&
                        form.dato.orden.unidad === "Kilogramos"
                      }
                      productoTerminado
                    />
                  </>
                )}
                {form.tipo === "nota" && (
                  <label>
                    Observación
                    <textarea
                      required
                      className={input}
                      name="nota"
                      maxLength={4000}
                    />
                  </label>
                )}
                {error && (
                  <p role="alert" className="text-red-300">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button className={boton}>
                    {busy ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    className={boton}
                    type="button"
                    onClick={() => setForm(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
      {produccion && !cargando && (
        <>
          {bandejaPedidosAbierta && (
            <section
              role="dialog"
              aria-label="Avisos de preparación de Ventas"
              className="fixed bottom-24 right-4 z-[80] flex max-h-[70vh] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl border border-cyan-800 bg-slate-900 shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-slate-700 p-4">
                <div>
                  <h2 className="font-semibold">Pedidos de preparación</h2>
                  <p className="text-xs text-slate-400">Avisos de los vendedores · no reservan inventario</p>
                </div>
                <button type="button" aria-label="Cerrar avisos" className={boton} onClick={() => setBandejaPedidosAbierta(false)}><X size={16} /></button>
              </header>
              <div className="space-y-3 overflow-y-auto p-3">
                {!pedidosPreparacion.length && <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No hay avisos pendientes.</p>}
                {pedidosPreparacion.map((pedido: any) => (
                  <article key={pedido.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] text-cyan-300">{pedido.folio} · {String(pedido.estado).replaceAll("_", " ")}</p>
                        <h3 className="mt-1 font-semibold">{pedido.cliente.nombre}</h3>
                        <p className="text-xs text-slate-400">Vendedor: {pedido.vendedor.nombre} · {new Date(pedido.creado_en).toLocaleString("es-MX")}</p>
                      </div>
                    </div>
                    {pedido.fecha_requerida && <p className="mt-2 text-xs text-amber-200">Requerido: {new Date(pedido.fecha_requerida).toLocaleDateString("es-MX")}</p>}
                    {pedido.observaciones && <p className="mt-2 rounded-lg bg-slate-900 p-2 text-xs text-slate-300">{pedido.observaciones}</p>}
                    <div className="mt-3 space-y-2">
                      {pedido.detalles.map((linea: any) => (
                        <div key={linea.id} className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs">
                          <strong>{linea.producto.nombre_Producto}</strong>{linea.tipo_prensa ? ` · ${linea.tipo_prensa}` : ""}
                          <p>Solicitado {cantidad(linea.cantidad_solicitada)} kg · Preparado {cantidad(linea.cantidad_preparada)} kg</p>
                          {linea.contenedores_solicitados && <p>{linea.contenedores_solicitados} contenedores{linea.peso_estimado_contenedor ? ` · ${cantidad(linea.peso_estimado_contenedor)} kg estimados c/u` : ""}</p>}
                          {linea.ordenes_venta?.length > 0 && <p className="text-cyan-200">OV confirmadas: {linea.ordenes_venta.filter((ov: any) => ov.estado === "CONFIRMADA").map((ov: any) => `${ov.folio} (${cantidad(ov.cantidad)} ${ov.unidad})`).join(" · ")}</p>}
                        </div>
                      ))}
                    </div>
                    {pedido.respuesta_produccion && <p className="mt-2 text-xs text-emerald-200">Respuesta: {pedido.respuesta_produccion}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pedido.estado === "ENVIADO" && <button disabled={busy} className="rounded-lg bg-cyan-800 px-3 py-2 text-xs hover:bg-cyan-700 disabled:opacity-50" onClick={() => void actualizarPedidoPreparacion(pedido.id, { estado: "RECIBIDO" })}>Marcar recibido</button>}
                      {["ENVIADO", "RECIBIDO"].includes(pedido.estado) && <button disabled={busy} className="rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-50" onClick={() => void actualizarPedidoPreparacion(pedido.id, { estado: "EN_PREPARACION" })}>Iniciar preparación</button>}
                      {pedido.estado !== "PREPARADO" && <button disabled={busy} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-950 disabled:opacity-50" onClick={() => setAvancePedido(pedido)}>Registrar avance</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <button
            type="button"
            aria-label="Abrir pedidos de preparación"
            onClick={() => setBandejaPedidosAbierta((abierta) => !abierta)}
            className="fixed bottom-5 right-5 z-[80] flex h-14 items-center gap-2 rounded-full bg-cyan-700 px-5 text-white shadow-xl transition hover:bg-cyan-600"
          >
            <MessageCircle size={20} />
            <span className="font-semibold">Pedidos</span>
            {pedidosPreparacion.filter((pedido: any) => pedido.estado === "ENVIADO").length > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold">{pedidosPreparacion.filter((pedido: any) => pedido.estado === "ENVIADO").length}</span>}
          </button>
          {avancePedido && (
            <FloatingModal
              title={`Registrar avance · ${avancePedido.folio}`}
              description="Ingresa el producto que Producción alcanzó a preparar. Este reporte no crea ni descuenta inventario."
              onClose={() => setAvancePedido(null)}
              closeDisabled={busy}
              theme="dark"
            >
              <form onSubmit={guardarAvancePedido} className="space-y-4">
                {avancePedido.detalles.map((linea: any) => (
                  <label key={linea.id} className="block text-sm">
                    {linea.producto.nombre_Producto}{linea.tipo_prensa ? ` · ${linea.tipo_prensa}` : ""} · solicitado {cantidad(linea.cantidad_solicitada)} kg
                    <input required type="number" min="0" step="0.0001" name={`preparada_${linea.id}`} defaultValue={linea.cantidad_preparada ?? 0} className={input} />
                  </label>
                ))}
                <label className="block text-sm">Nota para Ventas<textarea name="respuesta_produccion" maxLength={4000} defaultValue={avancePedido.respuesta_produccion ?? ""} className={`${input} min-h-24`} /></label>
                <button disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold disabled:opacity-50">{busy ? "Guardando…" : "Guardar avance"}</button>
              </form>
            </FloatingModal>
          )}
        </>
      )}
      {hist && <HistorialTiempos {...hist} onClose={() => setHist(null)} />}
    </main>
  );
}
