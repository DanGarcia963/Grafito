"use client";
import { useEffect, useState } from "react";
import { API_URL, apiFetch, pedir, sesionActual } from "@/utils/api";
import FloatingModal from "./FloatingModal";
export async function descargarCrm(tipo: string, id: number, nombre: string) {
  const r = await apiFetch(
    `${API_URL}/api/ventas/crm/documentos/${tipo}/${id}`,
  );
  if (!r.ok) throw new Error("No se pudo descargar el documento");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function CrmReportes({
  oportunidadId,
}: {
  oportunidadId: number;
}) {
  const [o, setO] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mensaje, setMensaje] = useState(""),
    [area, setArea] = useState(""),
    [formula, setFormula] = useState(""),
    [modal, setModal] = useState<"reporte" | "formula" | "anular" | "">(""),
    [reporteAnular, setReporteAnular] = useState<number | null>(null);
  const cargar = async () => {
    const r = await pedir(
      `/api/ventas/crm/oportunidades/${oportunidadId}`,
      undefined,
      "GET",
    );
    setO(r.data);
  };
  useEffect(() => {
    setArea(sesionActual()?.area ?? "");
    void cargar().catch((e) => setError(e.message));
  }, [oportunidadId]);
  const ejecutar = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cargar();
      setMensaje("Información actualizada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="border rounded-xl bg-slate-50 p-4 space-y-3">
      <h3 className="font-bold">
        Reporte comercial de ID · Oportunidad #{oportunidadId}
      </h3>
      <button
        type="button"
        onClick={() => void ejecutar(cargar)}
        disabled={busy}
      >
        Actualizar
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      {o && (
        <>
          <p>
            {o.titulo} · {o.cliente.nombre} · {o.estado_tecnico}
          </p>
          <p className="text-sm">
            Finaliza los análisis de todas las muestras para publicar. Un
            reporte viable habilita la cotización. Publicar una nueva versión
            invalida las cotizaciones anteriores.
          </p>
          {["PERDIDA", "CANCELADA"].includes(o.etapa) && <p className="text-sm">
            La oportunidad está cerrada comercialmente. Puedes terminar el análisis y publicar
            su reporte; esto conserva el cierre y no habilita una cotización.
          </p>}
          <ul>
            {o.muestras.map((m: any) => (
              <li key={m.id_Muestra}>
                Muestra #{m.id_Muestra}: {m.estado_Muestra}
                {m.id_flujo_estructurado && <span className="ml-2 text-xs text-slate-600">· Preliminar {m.id_analisis_preliminar ? "✓" : "pendiente"} · Procesamiento {m.id_procesamiento ? "✓" : "pendiente"} · Final {m.id_analisis_final ? "✓" : "pendiente"}</span>}
              </li>
            ))}
          </ul>
          {o.muestras.some((m: any) => m.id_flujo_estructurado && (!m.id_analisis_preliminar || !m.id_procesamiento || !m.id_analisis_final)) && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">Completa las tres etapas estructuradas de I+D antes de publicar este reporte.</p>}
          {o.etapa !== "GANADA" && <button type="button" disabled={busy} onClick={() => setModal("reporte")} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Publicar reporte de I+D</button>}
          {area === "id" && (() => {
            const vigente = o.reportes_id.find((r: any) => r.estado === "PUBLICADO" && r.resultado === "VIABLE");
            const enviada = vigente && o.costos_oportunidad?.find((x: any) => x.reporte?.version === vigente.version);
            return vigente && !enviada ? <button type="button" disabled={busy} onClick={() => setModal("formula")} className="rounded bg-indigo-700 px-3 py-2 text-white disabled:opacity-50">Enviar fórmula a Costos · Reporte v{vigente.version}</button> : null;
          })()}
          {area === "id" && o.costos_oportunidad?.map((c: any) => (
            <p key={c.id} className="text-sm">Fórmula v{c.version} · Reporte v{c.reporte?.version} · {c.precio_emitido_en ? `Precio objetivo recibido: ${c.precio_objetivo_litro} ${c.moneda}/L` : "Pendiente de precio de Costos"}</p>
          ))}
          {area === "ventas" && o.costos_oportunidad?.find((c: any) => c.precio_objetivo_litro != null) && (() => {
            const c = o.costos_oportunidad.find((x: any) => x.precio_objetivo_litro != null);
            return <p className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-emerald-900">Precio objetivo de Costos: <strong>{c.precio_objetivo_litro} {c.moneda}/L</strong> · Reporte v{c.reporte?.version}</p>;
          })()}
          {o.reportes_id.map((r: any) => (
            <article key={r.id} className="border rounded p-3 space-y-2">
              <strong>
                Versión {r.version} · {r.resultado} · {r.estado}
              </strong>
              <p>{r.resumen}</p>
              {r.nombre_archivo && (
                <button
                  onClick={() =>
                    void ejecutar(() =>
                      descargarCrm("reporte", r.id, r.nombre_archivo),
                    )
                  }
                >
                  Descargar documento
                </button>
              )}
              {area === "id" && r.estado === "PUBLICADO" && (
                <div className="space-y-1">
                  {r.enviado_ventas_en && <p className="text-xs text-emerald-800">Enviado a Ventas: {r.enviado_ventas_correo} · {new Date(r.enviado_ventas_en).toLocaleString("es-MX")}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border px-3 py-2"
                    onClick={() => void ejecutar(() => pedir(`/api/ventas/crm/oportunidades/${oportunidadId}/reportes/${r.id}/enviar-ventas`, {}))}
                  >
                    {r.enviado_ventas_en ? "Reenviar reporte a Ventas" : "Enviar reporte al vendedor"}
                  </button>
                </div>
              )}
              {r.estado === "PUBLICADO" && o.etapa !== "GANADA" && <button type="button" disabled={busy} onClick={() => { setReporteAnular(r.id); setModal("anular"); }} className="rounded border px-3 py-2 text-sm">Anular reporte</button>}
              {r.motivo_anulacion && <p>{r.motivo_anulacion}</p>}
            </article>
          ))}
        </>
      )}
      {o && modal === "reporte" && <FloatingModal title="Publicar reporte de I+D" description={`${o.titulo} · Versión ${o.version}`} onClose={() => setModal("")} closeDisabled={busy}>
        <form className="grid gap-3" onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          data.set("version", String(o.version));
          void ejecutar(async () => {
            const r = await apiFetch(`${API_URL}/api/ventas/crm/oportunidades/${oportunidadId}/reportes`, { method: "POST", body: data });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message);
            setModal("");
          });
        }}>
          <label>Resultado<select name="resultado" className="block border p-2"><option value="VIABLE">Viable</option><option value="NO_VIABLE">No viable</option><option value="REQUIERE_NUEVA_MUESTRA">Requiere nueva muestra</option></select></label>
          <label>Resumen del reporte<textarea name="resumen" required maxLength={8000} className="block w-full border p-2" /></label>
          <label>Observaciones<textarea name="observaciones" maxLength={4000} className="block w-full border p-2" /></label>
          <label>Documento Word o PDF (opcional, hasta 10 MB)<input name="documento" type="file" accept=".pdf,.doc,.docx" className="block" /></label>
          <button disabled={busy} className="rounded bg-blue-700 p-2 text-white">Publicar reporte y actualizar CRM</button>
        </form>
      </FloatingModal>}
      {o && modal === "formula" && <FloatingModal title="Enviar fórmula a Costos" description={`${o.titulo} · Oportunidad #${oportunidadId}`} onClose={() => setModal("")} closeDisabled={busy}>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void ejecutar(async () => { await pedir(`/api/ventas/crm/oportunidades/${oportunidadId}/formulas-costos`, { version: o.version, formula }); setFormula(""); setModal(""); }); }}>
          <p className="text-sm">La fórmula quedará asociada al reporte viable y Costos registrará el precio objetivo por litro.</p>
          <label>Fórmula / proceso propuesto<textarea required maxLength={12000} value={formula} onChange={(e) => setFormula(e.target.value)} className="block min-h-40 w-full border p-2" /></label>
          <button disabled={busy} className="rounded bg-indigo-700 p-2 text-white">Enviar fórmula a Costos</button>
        </form>
      </FloatingModal>}
      {o && modal === "anular" && reporteAnular != null && <FloatingModal title="Anular reporte publicado" description="Escribe el motivo para conservar la trazabilidad del cambio." onClose={() => { setModal(""); setReporteAnular(null); }} closeDisabled={busy}>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void ejecutar(async () => { await pedir(`/api/ventas/crm/oportunidades/${oportunidadId}/reportes/${reporteAnular}/anular`, { version: o.version, motivo: data.get("motivo") }); setModal(""); setReporteAnular(null); }); }}>
          <label>Motivo de anulación<input required name="motivo" maxLength={1000} className="block w-full border p-2" /></label>
          <button disabled={busy} className="rounded bg-rose-700 p-2 text-white">Anular reporte</button>
        </form>
      </FloatingModal>}
    </section>
  );
}
