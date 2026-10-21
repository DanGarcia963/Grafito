"use client";

import { useState } from "react";
import { pedir } from "@/utils/api";
import FloatingModal from "./FloatingModal";

type Analisis = {
  metricas?: { clave: string; nombre: string; valor: string; unidad: string | null }[];
  observaciones?: string | null;
  registrado_por?: string;
  registrado_en?: string;
};
type MuestraAnalisis = {
  id_Muestra: number;
  fecha_ingreso_laboratorio: string | null;
  caracterizacion: "FILTRACION" | "REGENERACION";
  id_analisis_preliminar: Analisis | null;
  id_analisis_final: Analisis | null;
  id_procesamiento: {
    tipo: "FILTRACION" | "REGENERACION";
    filtracion?: string | null;
    regeneracion?: string | null;
    observaciones?: string | null;
    registrado_por?: string;
    registrado_en?: string;
  } | null;
};
type CaracterizacionInput = {
  metricas: { clave: string; nombre: string; valor: string; unidad: string | null }[];
  observaciones: string;
};
type ProcesamientoInput =
  | { tipo: "FILTRACION"; filtracion: string; regeneracion: null; observaciones: string }
  | { tipo: "REGENERACION"; filtracion: null; regeneracion: string; observaciones: string };
type EntradaEstructurada = CaracterizacionInput | ProcesamientoInput;

const parametrosBase = [
  { clave: "viscosidad_40", nombre: "Viscosidad a 40°", unidad: "cSt" },
  { clave: "viscosidad_100", nombre: "Viscosidad a 100°", unidad: "cSt" },
  { clave: "flashpoint", nombre: "Flashpoint", unidad: "°C" },
  { clave: "copper", nombre: "Copper", unidad: "" },
  { clave: "humedad", nombre: "% humedad", unidad: "%" },
  { clave: "sedimentos", nombre: "% sedimentos", unidad: "%" },
];

function filasIniciales(analisis?: Analisis | null) {
  const existentes = analisis?.metricas ?? [];
  const values = new Map(existentes.map((m) => [m.clave, m]));
  return [
    ...parametrosBase.map((p) => ({
      ...p,
      valor: values.get(p.clave)?.valor ?? "",
      unidad: values.get(p.clave)?.unidad ?? p.unidad,
    })),
    ...existentes
      .filter((m) => !parametrosBase.some((p) => p.clave === m.clave))
      .map((m) => ({ ...m, valor: m.valor ?? "", unidad: m.unidad ?? "" })),
  ];
}

function textoEtapa(stage: string) {
  return stage === "PRELIMINAR"
    ? "Caracterización preliminar"
    : stage === "FINAL"
      ? "Caracterización final"
      : "Procesamiento de la muestra";
}

export default function AnalisisIDComercial({
  muestra,
  onActualizado,
}: {
  muestra: MuestraAnalisis;
  onActualizado: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [modalEtapa, setModalEtapa] = useState<"PRELIMINAR" | "PROCESAMIENTO" | "FINAL" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preliminar, setPreliminar] = useState(() => filasIniciales(muestra.id_analisis_preliminar));
  const [preliminarObs, setPreliminarObs] = useState(muestra.id_analisis_preliminar?.observaciones ?? "");
  const [final, setFinal] = useState(() => filasIniciales(muestra.id_analisis_final));
  const [finalObs, setFinalObs] = useState(muestra.id_analisis_final?.observaciones ?? "");
  const [tipoProceso, setTipoProceso] = useState<"FILTRACION" | "REGENERACION">(muestra.caracterizacion ?? "FILTRACION");
  const [opcionProceso, setOpcionProceso] = useState(
    muestra.id_procesamiento?.filtracion ?? muestra.id_procesamiento?.regeneracion ?? "",
  );
  const [procesoObs, setProcesoObs] = useState(muestra.id_procesamiento?.observaciones ?? "");

  const guardar = async (etapa: "PRELIMINAR" | "PROCESAMIENTO" | "FINAL", datos: EntradaEstructurada) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await pedir(`/api/investigacion/muestras/${muestra.id_Muestra}/analisis-estructurado`, { etapa, datos }, "PUT");
      await onActualizado();
      setModalEtapa(null);
      setNotice(`${textoEtapa(etapa)} guardada.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el análisis.");
    } finally {
      setBusy(false);
    }
  };

  const formularioAnalisis = (
    etapa: "PRELIMINAR" | "FINAL",
    values: typeof preliminar,
    setValues: typeof setPreliminar,
    observaciones: string,
    setObservaciones: (value: string) => void,
    disabled: boolean,
  ) => (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const metricas = values
          .filter((m) => String(m.valor).trim())
          .map(({ clave, nombre, valor, unidad }) => ({ clave, nombre, valor, unidad }));
        void guardar(etapa, { metricas, observaciones });
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {values.map((m, index) => {
          const personalizado = !parametrosBase.some((parametro) => parametro.clave === m.clave);
          return <label key={m.clave} className="grid gap-1 text-sm">
            {personalizado ? <span className="grid grid-cols-2 gap-2"><input aria-label="Nombre del parámetro" value={m.nombre} onChange={(event) => setValues((current) => current.map((x, i) => i === index ? { ...x, nombre: event.target.value } : x))} className="rounded border p-2" maxLength={100} required={!!m.valor.trim()} disabled={disabled || busy} /><input aria-label="Unidad del parámetro" value={m.unidad ?? ""} onChange={(event) => setValues((current) => current.map((x, i) => i === index ? { ...x, unidad: event.target.value } : x))} className="rounded border p-2" maxLength={40} placeholder="Unidad" disabled={disabled || busy} /></span> : <span>{m.nombre}{m.unidad ? ` (${m.unidad})` : ""}</span>}
            <input
              value={m.valor}
              onChange={(event) => setValues((current) => current.map((x, i) => i === index ? { ...x, valor: event.target.value } : x))}
              className="block w-full rounded border p-2"
              maxLength={120}
              placeholder="Sin dato: deja vacío"
              disabled={disabled || busy}
            />
          </label>;
        })}
      </div>
      <button type="button" onClick={() => setValues((current) => { let n = 1; while (current.some((m) => m.clave === `otro_${n}`)) n++; return [...current, { clave: `otro_${n}`, nombre: "Nuevo parámetro", valor: "", unidad: "" }]; })} disabled={disabled || busy || values.length >= 40} className="justify-self-start rounded border px-3 py-2 disabled:opacity-50">Agregar parámetro</button>
      <label className="text-sm">Observaciones<textarea value={observaciones} onChange={(event) => setObservaciones(event.target.value)} maxLength={4000} className="block w-full rounded border p-2" disabled={disabled || busy} /></label>
      <button type="submit" disabled={disabled || busy || !values.some((m) => String(m.valor).trim())} className="justify-self-start rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">
        {busy ? "Guardando…" : `Guardar ${textoEtapa(etapa).toLowerCase()}`}
      </button>
    </form>
  );

  const abrirEtapa = (etapa: "PRELIMINAR" | "PROCESAMIENTO" | "FINAL", disabled: boolean) => (
    <button type="button" onClick={() => setModalEtapa(etapa)} disabled={disabled || busy} className="rounded border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-900 disabled:opacity-50">
      {etapa === "PRELIMINAR" && muestra.id_analisis_preliminar ? "Ver / editar caracterización preliminar" :
        etapa === "FINAL" && muestra.id_analisis_final ? "Ver / editar caracterización final" :
          etapa === "PROCESAMIENTO" && muestra.id_procesamiento ? "Ver / editar procesamiento" :
            `Capturar ${textoEtapa(etapa).toLowerCase()}`}
    </button>
  );

  const resumen = (value?: Analisis | null) => value ? (
    <div className="space-y-1">
      <dl className="grid sm:grid-cols-2 gap-2 text-sm">
        {(value.metricas ?? []).map((m) => <div key={m.clave} className="rounded bg-white p-2"><dt className="text-slate-500">{m.nombre}</dt><dd className="font-semibold">{m.valor}{m.unidad ? ` ${m.unidad}` : ""}</dd></div>)}
      </dl>
      {value.observaciones && <p className="text-sm">{value.observaciones}</p>}
      <small className="text-slate-500">Registró {value.registrado_por} · {value.registrado_en ? new Date(value.registrado_en).toLocaleString("es-MX") : ""}</small>
    </div>
  ) : <p className="text-sm text-amber-800">Pendiente</p>;

  const preliminarBloqueado = !muestra.fecha_ingreso_laboratorio || !!muestra.id_procesamiento || !!muestra.id_analisis_final;
  const procesoBloqueado = !muestra.id_analisis_preliminar || !!muestra.id_analisis_final;
  const finalBloqueado = !muestra.id_procesamiento;
  const procesoOpciones = tipoProceso === "FILTRACION"
    ? [["ESTANDAR", "Estándar"], ["CODIGO_LIMPIEZA", "Código de limpieza"], ["FILTRACION_CV", "Filtración CV"]]
    : [["AJUSTE_ACIDO_BASICO", "Ajuste ácido/básico"], ["ADITIVACION", "Aditivación"], ["AMBOS", "Ambos procesos"], ["EXCESO_CONTAMINACION", "Exceso de contaminación"]];

  return (
    <section className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div><h3 className="font-bold text-indigo-950">Análisis estructurado de I+D</h3><p className="text-sm text-slate-700">Guarda resultados preliminares, proceso aplicado y caracterización final antes del dictamen. Puedes dejar parámetros no aplicables vacíos y añadir sus valores en observaciones.</p></div>
      {error && <p role="alert" className="rounded bg-red-100 p-2 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded bg-emerald-100 p-2 text-emerald-800">{notice}</p>}
      <article className="space-y-3 rounded-lg border bg-white p-3">
        <h4 className="font-semibold">1. Caracterización preliminar</h4>
        {resumen(muestra.id_analisis_preliminar)}
        {!muestra.id_analisis_preliminar && !muestra.fecha_ingreso_laboratorio && <p className="text-sm text-amber-800">Registra el ingreso de la muestra para habilitar esta etapa.</p>}
        {abrirEtapa("PRELIMINAR", preliminarBloqueado)}
      </article>
      <article className="space-y-3 rounded-lg border bg-white p-3">
        <h4 className="font-semibold">2. Procesamiento</h4>
        {muestra.id_procesamiento ? resumen({ metricas: [{ clave: "proceso", nombre: "Proceso", valor: String(muestra.id_procesamiento.filtracion ?? muestra.id_procesamiento.regeneracion ?? "Registrado"), unidad: muestra.id_procesamiento.tipo }], observaciones: muestra.id_procesamiento.observaciones, registrado_por: muestra.id_procesamiento.registrado_por, registrado_en: muestra.id_procesamiento.registrado_en }) : <p className="text-sm text-amber-800">Pendiente</p>}
        {!muestra.id_procesamiento && <p className="text-sm text-amber-800">Pendiente de capturar</p>}
        {abrirEtapa("PROCESAMIENTO", procesoBloqueado)}
        {procesoBloqueado && !muestra.id_procesamiento && <p className="text-sm text-amber-800">Guarda primero la caracterización preliminar.</p>}
      </article>
      <article className="space-y-3 rounded-lg border bg-white p-3">
        <h4 className="font-semibold">3. Caracterización final</h4>
        {resumen(muestra.id_analisis_final)}
        {abrirEtapa("FINAL", finalBloqueado)}
        {finalBloqueado && <p className="text-sm text-amber-800">Guarda primero el procesamiento de la muestra.</p>}
      </article>
      {modalEtapa && <FloatingModal
        title={textoEtapa(modalEtapa)}
        description={`Muestra ${muestra.id_Muestra} · ${muestra.fecha_ingreso_laboratorio ? new Date(muestra.fecha_ingreso_laboratorio).toLocaleString("es-MX") : "pendiente de ingreso"}`}
        onClose={() => setModalEtapa(null)}
        closeDisabled={busy}
        size="xl"
      >
        {error && <p role="alert" className="mb-3 rounded bg-red-100 p-2 text-red-800">{error}</p>}
        {modalEtapa === "PRELIMINAR" && formularioAnalisis("PRELIMINAR", preliminar, setPreliminar, preliminarObs, setPreliminarObs, preliminarBloqueado)}
        {modalEtapa === "FINAL" && formularioAnalisis("FINAL", final, setFinal, finalObs, setFinalObs, finalBloqueado)}
        {modalEtapa === "PROCESAMIENTO" && <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (tipoProceso === "FILTRACION") void guardar("PROCESAMIENTO", { tipo: "FILTRACION", filtracion: opcionProceso, regeneracion: null, observaciones: procesoObs }); else void guardar("PROCESAMIENTO", { tipo: "REGENERACION", filtracion: null, regeneracion: opcionProceso, observaciones: procesoObs }); }}>
          <label className="text-sm">Tipo<select value={tipoProceso} onChange={(event) => { setTipoProceso(event.target.value as "FILTRACION" | "REGENERACION"); setOpcionProceso(""); }} disabled={procesoBloqueado || busy} className="block w-full rounded border p-2"><option value="FILTRACION">Filtración</option><option value="REGENERACION">Regeneración</option></select></label>
          <label className="text-sm">Método<select required value={opcionProceso} onChange={(event) => setOpcionProceso(event.target.value)} disabled={procesoBloqueado || busy} className="block w-full rounded border p-2"><option value="">Seleccionar</option>{procesoOpciones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Observaciones<textarea value={procesoObs} onChange={(event) => setProcesoObs(event.target.value)} maxLength={4000} disabled={procesoBloqueado || busy} className="block w-full rounded border p-2" /></label>
          <button type="submit" disabled={procesoBloqueado || busy || !opcionProceso} className="justify-self-start rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar procesamiento"}</button>
        </form>}
      </FloatingModal>}
    </section>
  );
}
