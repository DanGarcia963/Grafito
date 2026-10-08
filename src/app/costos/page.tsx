"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { pedir, sesionActual } from "@/utils/api";
import { useSocket } from "@/context/SocketContext";

export default function CostosPage() {
  const socket = useSocket();
  const [formulas, setFormulas] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    const r = await pedir("/api/costos/formulas", undefined, "GET");
    setFormulas(r.data ?? []);
  }, []);

  useEffect(() => {
    const sesion = sesionActual();
    if (!sesion) {
      window.location.assign("/");
      return;
    }
    if (sesion.area !== "costos") {
      window.location.assign("/");
      return;
    }
    void cargar().catch((e) => setError(e.message));
  }, [cargar]);

  useEffect(() => {
    const actualizar = () => { void cargar().catch((e) => setError(e.message)); };
    socket?.on("COSTOS_FORMULA_RECIBIDA", actualizar);
    socket?.on("COSTOS_PRECIO_EMITIDO", actualizar);
    return () => {
      socket?.off("COSTOS_FORMULA_RECIBIDA", actualizar);
      socket?.off("COSTOS_PRECIO_EMITIDO", actualizar);
    };
  }, [socket, cargar]);

  const emitir = async (e: FormEvent<HTMLFormElement>, f: any) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMensaje("");
    try {
      await pedir(`/api/costos/formulas/${f.id}/precio`, {
        precio_objetivo_litro: data.get("precio_objetivo_litro"),
        moneda: data.get("moneda"),
      });
      setMensaje(`Precio objetivo emitido para ${f.oportunidad.folio}; ya está disponible para Ventas.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo emitir el precio");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-5 md:p-8">
      <header className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <p className="text-cyan-400 text-sm">COSTOS · OPORTUNIDADES DE VENTA</p>
          <h1 className="text-3xl font-bold">Fórmulas y precios objetivo</h1>
          <p className="text-slate-400 mt-2">Revisa la fórmula enviada por I+D y registra el precio objetivo por litro para que Ventas prepare su cotización.</p>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-700" href="/">Inicio</Link>
          <button disabled={busy} onClick={() => void cargar().catch((e) => setError(e.message))} className="rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-700">Actualizar</button>
        </div>
      </header>

      {error && <p role="alert" className="p-3 rounded border border-red-700 bg-red-950 mb-4">{error}</p>}
      {mensaje && <p role="status" className="p-3 rounded border border-emerald-700 bg-emerald-950 mb-4">{mensaje}</p>}
      {!formulas.length && <p className="rounded-xl border border-slate-700 bg-slate-900 p-5">No hay fórmulas asociadas a reportes viables publicados.</p>}

      <section className="grid gap-4">
        {formulas.map((f) => (
          <article key={f.id} className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">{f.oportunidad.folio} · {f.oportunidad.titulo}</h2>
                <p className="text-slate-300">{f.oportunidad.cliente.nombre} · {f.oportunidad.producto?.nombre_Producto ?? "Producto por definir"}</p>
                <p className="text-sm text-slate-400">Vendedor: {f.oportunidad.vendedor.nombre} · Reporte ID v{f.reporte.version} · Fórmula v{f.version} · Enviada por {f.formula_enviada_por} el {new Date(f.formula_enviada_en).toLocaleString("es-MX")}</p>
              </div>
              <span className={f.precio_emitido_en ? "h-fit rounded-full bg-emerald-900 px-3 py-1 text-emerald-200" : "h-fit rounded-full bg-amber-900 px-3 py-1 text-amber-200"}>
                {f.precio_emitido_en ? "Precio emitido" : "Pendiente de precio"}
              </span>
            </div>
            <div className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-950 p-4">{f.formula}</div>
            {f.precio_emitido_en ? (
              <p className="text-lg">Precio objetivo: <strong>{f.precio_objetivo_litro} {f.moneda}/L</strong> · Emitido por {f.precio_emitido_por} el {new Date(f.precio_emitido_en).toLocaleString("es-MX")}</p>
            ) : (
              <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => void emitir(e, f)}>
                <label>Precio objetivo por litro
                  <input required name="precio_objetivo_litro" type="number" min="0.000001" step="0.000001" className="mt-1 block rounded border border-slate-600 bg-slate-950 p-2" />
                </label>
                <label>Moneda
                  <select name="moneda" defaultValue="MXN" className="mt-1 block rounded border border-slate-600 bg-slate-950 p-2">
                    <option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option>
                  </select>
                </label>
                <button disabled={busy} className="rounded bg-cyan-700 px-4 py-2 font-medium hover:bg-cyan-600 disabled:opacity-50">Emitir precio a Ventas</button>
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
