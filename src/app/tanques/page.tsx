"use client";
import EspecificacionesMaterial from "@/components/EspecificacionesMaterial";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { pedir, sesionActual } from "@/utils/api";
import { useSocket } from "@/context/SocketContext";
import HistorialTiempos from "@/components/HistorialTiempos";
import PlanProduccion from "@/components/PlanProduccion";
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
    const [o, t, m, c, maybeLotes] = await Promise.all([
      pedir("/api/produccion/test", undefined, "GET"),
      pedir("/api/produccion/tanques?tipo=GRAFITO", undefined, "GET"),
      pedir("/api/calidad/obtenerMuestras", undefined, "GET"),
      pedir("/api/produccion/catalogos", undefined, "GET"),
      pedir("/api/produccion/lotes-pendientes", undefined, "GET"),
    ]);
    setOrdenes(o.result);
    setBitacora(o.bitacora);
    setTanques(t.result);
    setCat(c);
    setLotesPendientes(maybeLotes.data ?? []);
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
          <Link className={boton} href="/calidad">
            Calidad
          </Link>
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
          ["muestras", "Muestras de Calidad"],
          ["inventario", "Existencias"],
          ["bitacora", "Bitácora"],
        ]
          .filter(([key]) => key !== "inventario" || produccion)
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
                          {l.orden.crm_ordenes_venta?.cliente.nombre ??
                            l.orden.propietario?.nombre ??
                            "Producción propia"}{" "}
                          ·{" "}
                          {l.orden.crm_ordenes_venta?.folio ??
                            "Sin orden de venta"}
                        </p>
                        <p className="mt-2">
                          Carga: {cantidad(l.cantidad_consumida)}{" "}
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
              {ordenes.map((o) => (
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
                      <p>
                        {o.crm_ordenes_venta?.folio ?? "Sin OV"} ·{" "}
                        {o.crm_ordenes_venta?.cliente.nombre ??
                          o.propietario?.nombre ??
                          "Producción propia"}
                      </p>
                    </div>
                    {produccion &&
                      !o.orden_venta_id &&
                      o.estado_Plan !== "CANCELADA" && (
                        <button
                          className={boton}
                          onClick={() => setForm({ tipo: "vincular", dato: o })}
                        >
                          Vincular con venta
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
                              {user?.area === "calidad" &&
                                l.estado_Calida === "APROBADO" && (
                                  <button
                                    className={boton}
                                    disabled={busy}
                                    onClick={() =>
                                      void ejecutar(() =>
                                        pedir(
                                          "/api/produccion/actualizarEstatusCalidad",
                                          {
                                            idLoteProduccion:
                                              l.id_Lote_Produccion,
                                            estadoCalidad: "LIBERADO",
                                          },
                                          "PUT",
                                        ),
                                      )
                                    }
                                  >
                                    Liberar lote
                                  </button>
                                )}
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
          {tab === "muestras" && (
            <section className="space-y-3">
              <p>
                La recepción, los análisis y el dictamen se registran en{" "}
                <Link href="/calidad" className="underline text-cyan-300">
                  Calidad
                </Link>
                .
              </p>
              {muestras.map((m) => (
                <article
                  key={m.id_Muestra}
                  className="border border-slate-700 rounded-xl p-4 bg-slate-900"
                >
                  <h2 className="font-bold">
                    {m.no_Muestra} · {m.productos_materiales?.nombre_Producto}
                  </h2>
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
                    user?.area === "calidad" && (
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
                        <button
                          className={boton}
                          disabled={busy}
                          onClick={() =>
                            void ejecutar(() =>
                              pedir(
                                "/api/calidad/actualizarEstatusMuestra",
                                {
                                  id_Muestra: m.id_Muestra,
                                  estatus_Muestra: "APROBADO",
                                },
                                "PUT",
                              ),
                            )
                          }
                        >
                          Liberación manual de muestra
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
                              Contenedores al ingreso:{" "}
                              {s.especificaciones?.contenedores?.length ??
                                "Sin detalle"}
                            </summary>
                            {s.especificaciones?.contenedores?.map((c: any) => (
                              <p key={c.codigo}>
                                {c.codigo}: {c.peso_kg} kg
                              </p>
                            ))}
                            <p>
                              El detalle original no representa los contenedores
                              restantes tras consumos parciales.
                            </p>
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
                    vincular: "Vincular OP con orden de venta",
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
                    ID de la orden de venta
                    <input
                      required
                      type="number"
                      min="1"
                      name="orden_venta_id"
                      className={input}
                    />
                  </label>
                )}
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
                      config={
                        form.dato.orden.productos_materiales
                          ?.configuracion_operativa
                      }
                      unidad={form.dato.orden.unidad}
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
      {hist && <HistorialTiempos {...hist} onClose={() => setHist(null)} />}
    </main>
  );
}
