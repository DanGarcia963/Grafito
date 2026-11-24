'use client';

import { Droplets, FlaskConical, Info } from 'lucide-react';

// Escenario FIJO de planeación, no resultado de laboratorio.
// El 45% es masa teórica remanente al retirar solo el agua.
export const HUMEDAD_SUPUESTA_GRAFITO = 0.55;
const PRENSAS = ['Fagor', 'Forgemaster', 'Polymaster'] as const;
type Prensa = (typeof PRENSAS)[number];
type CantidadesSucias = Record<Prensa, number> & {
  total: number;
  sinIdentificar: number;
};

const COLORES: Record<Prensa, string> = {
  Fagor: '#2563eb',
  Forgemaster: '#16a34a',
  Polymaster: '#eab308',
};

const fmt = (valor: number) => new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 2,
}).format(valor);

export function estimarMasaSinAgua(kgSucios: number, fraccionAgua = HUMEDAD_SUPUESTA_GRAFITO) {
  if (!Number.isFinite(kgSucios) || kgSucios < 0 ||
      !Number.isFinite(fraccionAgua) || fraccionAgua < 0 || fraccionAgua > 1) {
    return { aguaKg: 0, equivalenteSinAguaKg: 0 };
  }
  return {
    aguaKg: kgSucios * fraccionAgua,
    equivalenteSinAguaKg: kgSucios * (1 - fraccionAgua),
  };
}

export default function PortalProyeccionHumedad({ sucio }: { sucio: CantidadesSucias }) {
  const conPrensa = PRENSAS.reduce((sum, prensa) => sum + (sucio[prensa] || 0), 0);
  // Se consideran por separado los kilos sin prensa para no perder masa del total.
  const masaSinPrensa = Math.max(0, sucio.sinIdentificar || 0);
  const totalSucio = conPrensa + masaSinPrensa;
  const total = estimarMasaSinAgua(totalSucio);

  return <section className="mt-5 rounded-xl border border-[#dfeae3] bg-[#f8fbf9] p-4"
    aria-label="Proyección teórica del material sucio con 55 por ciento de agua">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-[#173e35]">
          <Droplets size={17} className="text-[#3176bb]"/>
          Equivalente estimado del material sucio
        </h4>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Supuesto uniforme por prensa: <strong>55 % de agua</strong> y <strong>45 % de materia restante</strong>.
        </p>
      </div>
      <span className="rounded-full border border-[#c9dfd2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#176f5b]">
        Escenario aproximado
      </span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {PRENSAS.map(prensa => {
        const bruto = Math.max(0, sucio[prensa] || 0);
        const estimado = estimarMasaSinAgua(bruto);
        return <div key={prensa} className="min-w-0 rounded-xl border border-[#e1e9e2] bg-white px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORES[prensa] }}/>
            {prensa}
          </div>
          <p className="mt-2 text-xs text-slate-500">{fmt(bruto)} kg sucios</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#173e35]">
            ≈ {fmt(estimado.equivalenteSinAguaKg)} <span className="text-xs">kg</span>
          </p>
          <p className="text-[11px] leading-4 text-slate-500">equivalente teórico sin agua</p>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#dce7ed]" role="img"
            aria-label={'45 por ciento de materia restante y 55 por ciento de agua en ' + prensa}>
            <div className="h-full" style={{ width: '45%', backgroundColor: COLORES[prensa] }}/>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Agua estimada: <strong className="tabular-nums text-slate-700">{fmt(estimado.aguaKg)} kg</strong>
          </p>
        </div>;
      })}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7e8de] bg-white px-3 py-3">
      <div className="text-xs text-slate-600">
        <strong className="text-[#173e35]">{fmt(totalSucio)} kg</strong> de material sucio
        <span className="mx-1.5 text-slate-300">·</span>
        Agua teórica: <strong>{fmt(total.aguaKg)} kg</strong>
      </div>
      <div className="flex items-center gap-2">
        <FlaskConical size={17} className="text-[#176f5b]"/>
        <div className="text-right">
          <p className="text-[11px] text-slate-500">Total teórico sin agua</p>
          <p className="text-lg font-bold tabular-nums text-[#176f5b]">≈ {fmt(total.equivalenteSinAguaKg)} kg</p>
        </div>
      </div>
    </div>
    {masaSinPrensa > 0 && <p className="mt-2 text-xs text-amber-800">
      {fmt(masaSinPrensa)} kg sin prensa identificada se incluyen únicamente en el total.
    </p>}
    <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
      <Info size={15} className="mt-0.5 shrink-0"/>
      El 55 % es una hipótesis de planeación, no una medición de Calidad.
      El equivalente sin agua no es producto terminado garantizado: pueden existir
      pérdidas adicionales por sedimentos, filtración y otros procesos. No se suma al material liberado.
    </p>
  </section>;
}
