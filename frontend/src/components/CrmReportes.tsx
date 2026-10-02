"use client";
import { useEffect, useState } from "react";
import { API_URL, apiFetch, pedir } from "@/utils/api";
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
    [mensaje, setMensaje] = useState("");
  const cargar = async () => {
    const r = await pedir(
      `/api/ventas/crm/oportunidades/${oportunidadId}`,
      undefined,
      "GET",
    );
    setO(r.data);
  };
  useEffect(() => {
    void cargar().catch((e) => setError(e.message));
  }, [oportunidadId]);
  const ejecutar = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cargar();
      setMensaje("Reporte actualizado");
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
          <ul>
            {o.muestras.map((m: any) => (
              <li key={m.id_Muestra}>
                Muestra #{m.id_Muestra}: {m.estado_Muestra}
              </li>
            ))}
          </ul>
          {!["GANADA", "PERDIDA", "CANCELADA"].includes(o.etapa) && (
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
                !["GANADA", "PERDIDA", "CANCELADA"].includes(o.etapa) && (
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
