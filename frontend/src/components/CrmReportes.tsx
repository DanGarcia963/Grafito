"use client";
import { useEffect, useState } from "react";
import { API_URL, apiFetch, pedir, sesionActual } from "@/utils/api";
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
    [formula, setFormula] = useState("");
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
              </li>
            ))}
          </ul>
          {o.etapa !== "GANADA" && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                data.set("version", String(o.version));
                void ejecutar(async () => {
                  const r = await apiFetch(
                    `${API_URL}/api/ventas/crm/oportunidades/${oportunidadId}/reportes`,
                    { method: "POST", body: data },
                  );
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.message);
                });
              }}
            >
              <label>
                Resultado
                <select name="resultado" className="border p-2 block">
                  <option value="VIABLE">Viable</option>
                  <option value="NO_VIABLE">No viable</option>
                  <option value="REQUIERE_NUEVA_MUESTRA">
                    Requiere nueva muestra
                  </option>
                </select>
              </label>
              <label>
                Resumen del reporte
                <textarea
                  name="resumen"
                  required
                  maxLength={8000}
                  className="border p-2 block w-full"
                />
              </label>
              <label>
                Observaciones
                <textarea
                  name="observaciones"
                  maxLength={4000}
                  className="border p-2 block w-full"
                />
              </label>
              <label>
                Documento Word o PDF (opcional, hasta 10 MB)
                <input
                  name="documento"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="block"
                />
              </label>
              <button
                disabled={busy}
                className="bg-blue-700 text-white p-2 rounded"
              >
                Publicar reporte y actualizar CRM
              </button>
            </form>
          )}
          {area === "id" && (() => {
            const vigente = o.reportes_id.find((r: any) => r.estado === "PUBLICADO" && r.resultado === "VIABLE");
            const enviada = vigente && o.costos_oportunidad?.find((x: any) => x.reporte?.version === vigente.version);
            return vigente && !enviada ? (
              <form className="grid gap-3 border rounded-lg p-3 bg-white" onSubmit={(e) => {
                e.preventDefault();
                void ejecutar(async () => {
                  await pedir(`/api/ventas/crm/oportunidades/${oportunidadId}/formulas-costos`, {
                    version: o.version,
                    formula,
                  });
                  setFormula("");
                });
              }}>
                <h4 className="font-semibold">Enviar fórmula a Costos · Reporte v{vigente.version}</h4>
                <p className="text-sm">La fórmula quedará asociada a este reporte viable. Costos registrará el precio objetivo por litro en una versión auditable.</p>
                <label>Fórmula / proceso propuesto
                  <textarea required maxLength={12000} value={formula} onChange={(e) => setFormula(e.target.value)} className="border p-2 block w-full min-h-28" />
                </label>
                <button disabled={busy} className="bg-indigo-700 text-white p-2 rounded">Enviar fórmula a Costos</button>
              </form>
            ) : null;
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
              {r.estado === "PUBLICADO" &&
                o.etapa !== "GANADA" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      void ejecutar(() =>
                        pedir(
                          `/api/ventas/crm/oportunidades/${oportunidadId}/reportes/${r.id}/anular`,
                          { version: o.version, motivo: data.get("motivo") },
                        ),
                      );
                    }}
                  >
                    <input
                      required
                      name="motivo"
                      placeholder="Motivo de anulación"
                      className="border p-2"
                    />
                    <button disabled={busy}>Anular reporte</button>
                  </form>
                )}
              {r.motivo_anulacion && <p>{r.motivo_anulacion}</p>}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
