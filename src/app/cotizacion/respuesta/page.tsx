import { Suspense } from "react";
import RespuestaCotizacionClient from "./respuesta-client";

export default function RespuestaCotizacionPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100 p-8">Cargando respuesta…</main>}>
      <RespuestaCotizacionClient />
    </Suspense>
  );
}
