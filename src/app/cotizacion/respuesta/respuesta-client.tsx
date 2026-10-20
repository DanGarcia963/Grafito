"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { API_URL, apiFetch } from "@/utils/api";

export default function RespuestaCotizacionClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const accion = (searchParams.get("accion") ?? "").toUpperCase();
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<"confirmar" | "completado" | "error">("confirmar");
  const [mensaje, setMensaje] = useState("");

  const aceptar = accion === "ACEPTAR";
  const valido = token.length >= 40 && ["ACEPTAR", "RECHAZAR"].includes(accion);

  const confirmar = async () => {
    if (!valido || cargando) return;
    setCargando(true);
    setMensaje("");
    try {
      const response = await apiFetch(`${API_URL}/api/public/crm/cotizaciones/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accion }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "No se pudo registrar la respuesta.");
      setEstado("completado");
      setMensaje(aceptar
        ? "Tu aceptación quedó registrada. El vendedor dará seguimiento para formalizar la orden de venta."
        : "Tu rechazo quedó registrado. El vendedor podrá dar seguimiento a la oportunidad.");
    } catch (error) {
      setEstado("error");
      setMensaje(error instanceof Error ? error.message : "No se pudo registrar la respuesta.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <header className="bg-sky-950 px-7 py-6 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">US Technologies · Ventas</p>
          <h1 className="mt-2 text-2xl font-bold">Respuesta a cotización</h1>
        </header>
        <div className="space-y-5 p-7">
          {estado === "completado" ? (
            <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900">{mensaje}</p>
          ) : !valido ? (
            <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">El enlace está incompleto o no es válido. Contacta a tu vendedor para recibir una nueva cotización.</p>
          ) : estado === "error" ? (
            <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{mensaje}</p>
          ) : (
            <>
              <p>Confirma que deseas <strong>{aceptar ? "aceptar" : "rechazar"}</strong> la cotización recibida por correo.</p>
              <p className="text-sm text-slate-600">La página solo registra tu respuesta después de presionar el botón. Si aceptas, el vendedor completará contigo los datos de la orden de venta.</p>
              <button onClick={() => void confirmar()} disabled={cargando} className={`rounded-lg px-5 py-3 font-semibold text-white disabled:opacity-50 ${aceptar ? "bg-emerald-700" : "bg-slate-700"}`}>
                {cargando ? "Registrando…" : `Confirmar ${aceptar ? "aceptación" : "rechazo"}`}
              </button>
            </>
          )}
          {estado === "error" && valido && <button onClick={() => { setEstado("confirmar"); setMensaje(""); }} className="rounded-lg border px-4 py-2">Volver a intentar</button>}
        </div>
      </section>
    </main>
  );
}
