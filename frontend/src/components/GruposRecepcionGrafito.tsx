"use client";

import { useMemo, useState } from "react";

type Contenedor = { codigo: string; peso_kg: string };
type Grupo = { tipo_prensa: string; numero_vuelta: string; contenedores: Contenedor[] };
const PRENSAS = ["Fagor", "Forgemaster", "Polymaster"] as const;
const nuevoContenedor = (): Contenedor => ({ codigo: "", peso_kg: "" });
const nuevoGrupo = (): Grupo => ({
  tipo_prensa: "", numero_vuelta: "", contenedores: [nuevoContenedor()],
});

export default function GruposRecepcionGrafito({
  pesoMin = 850, pesoMax = 1000,
}: { pesoMin?: number; pesoMax?: number }) {
  const [grupos, setGrupos] = useState<Grupo[]>([nuevoGrupo()]);
  const actualizar = (indice: number, cambio: Partial<Grupo>) =>
    setGrupos(actuales => actuales.map((grupo, i) => i === indice ? { ...grupo, ...cambio } : grupo));
  const actualizarContenedor = (indice: number, pos: number, cambio: Partial<Contenedor>) =>
    setGrupos(actuales => actuales.map((grupo, i) =>
      i !== indice ? grupo : {
        ...grupo, contenedores: grupo.contenedores.map((c, j) => j === pos ? { ...c, ...cambio } : c),
      }));
  const total = useMemo(() => grupos.reduce((s, g) =>
    s + g.contenedores.reduce((a, c) => a + (Number(c.peso_kg) || 0), 0), 0), [grupos]);
  const numeroContenedores = grupos.reduce((n, g) => n + g.contenedores.length, 0);
  const combinaciones = grupos.map(g => g.tipo_prensa && g.numero_vuelta ? `${g.tipo_prensa}:${g.numero_vuelta}` : "");
  const repetidas = combinaciones.some((c, i) => c && combinaciones.indexOf(c) !== i);
  const nombres = grupos.flatMap(g => g.contenedores.map(c => c.codigo.trim().toUpperCase()).filter(Boolean));
  const codigosRepetidos = new Set(nombres).size !== nombres.length;
  const completos = grupos.every(g =>
    g.tipo_prensa && /^[1-9]\d{0,1}$/.test(g.numero_vuelta) &&
    g.contenedores.length > 0 &&
    g.contenedores.every(c => c.codigo.trim() && Number(c.peso_kg) >= pesoMin && Number(c.peso_kg) <= pesoMax));
  const invalido = repetidas || codigosRepetidos || !completos || total <= 0;
  return <section className="space-y-4 rounded-xl border border-emerald-700/60 bg-emerald-950/20 p-4">
    <div>
      <h3 className="font-semibold text-emerald-100">Grupos de grafito por prensa y vuelta</h3>
      <p className="mt-1 text-xs text-slate-300">
        Cada grupo genera un lote de inventario diferente bajo la misma recepción. Registra el peso real
        de cada contenedor; el total se calcula automáticamente.
      </p>
    </div>
    {grupos.map((grupo, i) => <div key={i} className="space-y-3 rounded-lg border border-slate-600 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <strong>Grupo {i + 1}</strong>
        {grupos.length > 1 && <button className="text-xs text-red-300 underline"
          type="button" onClick={() => setGrupos(actuales => actuales.filter((_, j) => j !== i))}>
          Quitar grupo
        </button>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">Tipo de prensa
          <select className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2" value={grupo.tipo_prensa}
            required onChange={e => actualizar(i, { tipo_prensa: e.target.value })}>
            <option value="">Selecciona la prensa</option>
            {PRENSAS.map(p => <option value={p} key={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm">Número de vuelta (reprocesos acumulados)
          <input type="number" required min={1} max={99} step={1} placeholder="Ej. 8"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2"
            value={grupo.numero_vuelta} onChange={e => actualizar(i, { numero_vuelta: e.target.value })}/>
        </label>
      </div>
      <div className="space-y-2">
        {grupo.contenedores.map((c, j) => <div key={j} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[125px] flex-1 text-xs">Contenedor {j + 1}
            <input required maxLength={100} value={c.codigo} placeholder="Número / código"
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2"
              onChange={e => actualizarContenedor(i, j, { codigo: e.target.value })}/>
          </label>
          <label className="min-w-[110px] flex-1 text-xs">Peso real (kg)
            <input type="number" required step="0.0001" min={pesoMin} max={pesoMax}
              value={c.peso_kg} placeholder={String(pesoMin)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2"
              onChange={e => actualizarContenedor(i, j, { peso_kg: e.target.value })}/>
          </label>
          {grupo.contenedores.length > 1 && <button type="button" className="rounded border border-slate-600 px-2 py-2 text-xs"
            onClick={() => actualizar(i, { contenedores: grupo.contenedores.filter((_, k) => k !== j) })}>
            Quitar
          </button>}
        </div>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-300">
        <button type="button" className="rounded border border-slate-600 px-3 py-2"
          disabled={numeroContenedores >= 500}
          onClick={() => actualizar(i, { contenedores: [...grupo.contenedores, nuevoContenedor()] })}>
          Añadir contenedor
        </button>
        <span>{grupo.contenedores.length} contenedores · {grupo.contenedores.reduce((s, c) => s + (Number(c.peso_kg) || 0), 0).toLocaleString("es-MX")} kg</span>
      </div>
    </div>)}
    <button type="button" className="rounded-lg border border-emerald-600 px-3 py-2 text-sm text-emerald-100"
      disabled={grupos.length >= 50 || numeroContenedores >= 500}
      onClick={() => setGrupos(actuales => [...actuales, nuevoGrupo()])}>
      + Añadir otra prensa / vuelta
    </button>
    {(repetidas || codigosRepetidos) && <p role="alert" className="text-sm text-amber-200">
      {repetidas ? "Agrupa en una misma sección los contenedores de igual prensa y vuelta. " : ""}
      {codigosRepetidos ? "Los códigos de contenedor no pueden repetirse en la recepción." : ""}
    </p>}
    <div className="rounded-lg border border-slate-600 p-3">
      <p className="font-semibold">{grupos.length} grupo(s) · {numeroContenedores} contenedor(es)</p>
      <p className="text-lg font-bold">{total.toLocaleString("es-MX", { maximumFractionDigits: 4 })} kg totales</p>
    </div>
    <input type="hidden" name="cantidad" value={Number(total.toFixed(4))}/>
    <input type="hidden" name="grupos_grafito" value={JSON.stringify(grupos)}/>
    {invalido && <p className="text-xs text-slate-400">Completa los grupos, pesos y vueltas antes de guardar la recepción.</p>}
  </section>;
}
