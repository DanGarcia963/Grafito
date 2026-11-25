"use client";
import { useEffect, useRef, useState } from "react";
import { api, post } from "./kpis.api";
import type { Cell, Detail, Indicator } from "./kpis.types";

type Config = {
  id_Configuracion: number;
  indicador_id: number;
  version: number;
  tipo_dato: "NUMERICO" | "BOOLEANO" | "OPCION";
  unidad: string;
  decimales: number;
  metodo_calculo: string;
  formula_descriptiva: string | null;
  parametros_calculo: string | null;
  opciones_permitidas: string | null;
  requiere_evidencia: boolean;
  fuente_datos: string | null;
};
type Draft = {
  valor: string;
  fuente: string;
  fecha_documento: string;
  datos_base: string;
  observaciones: string;
  analisis: string;
  acciones_propuestas: string;
  justificacion_no_aplica: string;
  motivo: string;
};
const empty: Draft = {
  valor: "", fuente: "", fecha_documento: "", datos_base: "",
  observaciones: "", analisis: "", acciones_propuestas: "", justificacion_no_aplica: "",
  motivo: "Registro histórico desde el calendario mensual.",
};
const period = (c:Cell) =>
  new Date(c.start+"T12:00:00Z").toLocaleDateString("es-MX",{month:"long",year:"numeric",timeZone:"UTC"})+
  (c.start.slice(0,7)===c.end.slice(0,7)?"":" al "+
    new Date(c.end+"T12:00:00Z").toLocaleDateString("es-MX",{month:"long",year:"numeric",timeZone:"UTC"}));

function allowed(raw: string | null): string[] {
  if(!raw) return [] as string[];
  try{
    const j=JSON.parse(raw);
    if(Array.isArray(j))return j.map(String);
    if(j&&Array.isArray(j.opciones))return j.opciones.map(String);
  } catch { /* Formato de lista separada por comas. */ }
  return raw.split(/[\n,;]/).map(x=>x.trim()).filter(Boolean);
}

export default function KpiCapturaHistorica({
  indicador, celda, onCancel, onSaved,
}:{
  indicador:Indicator;
  celda:Cell;
  onCancel:()=>void;
  onSaved:(message:string)=>void;
}) {
  const formRef=useRef<HTMLFormElement>(null);
  const [config,setConfig]=useState<Config|null>(null);
  const [form,setForm]=useState<Draft>(empty);
  const [revision,setRevision]=useState(0);
  const [noAplica,setNoAplica]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [evidencia,setEvidencia]=useState<File|null>(null);

  useEffect(()=>{
    const ac=new AbortController();
    setLoading(true);setError("");setConfig(null);
    const queries:Promise<any>[]=[
      api<Config>("configuraciones/"+celda.configId+"/captura",ac.signal),
    ];
    if(celda.resultId)queries.push(api<Detail>("resultados/"+celda.resultId,ac.signal));
    Promise.all(queries).then(([conf,detalle])=>{
      if(ac.signal.aborted)return;
      setConfig(conf);
      if(detalle){
        const origen=detalle.referencia_origen &&
          typeof detalle.referencia_origen==="object"
          ? detalle.referencia_origen as Record<string,unknown> : {};
        setRevision(detalle.revision_actual);
        setNoAplica(!!detalle.justificacion_no_aplica);
        setForm({
          valor: conf.tipo_dato==="NUMERICO"
            ? String(detalle.valor_numerico??"")
            : conf.tipo_dato==="BOOLEANO"
              ? String(detalle.valor_booleano??"") : String(detalle.valor_opcion??""),
          fuente:String(origen.fuente??""),
          fecha_documento:String(origen.fecha_documento??""),
          datos_base:detalle.datos_base==null?"":JSON.stringify(detalle.datos_base,null,2),
          observaciones:detalle.observaciones??"",
          analisis:detalle.analisis??"",
          acciones_propuestas:detalle.acciones_propuestas??"",
          justificacion_no_aplica:detalle.justificacion_no_aplica??"",
          motivo:"",
        });
      } else {setRevision(0);setForm({...empty});setNoAplica(false);}
    }).catch((err)=>{
      if(!ac.signal.aborted)setError(err instanceof Error?err.message:"No se pudo abrir la configuración.");
    }).finally(()=>{if(!ac.signal.aborted)setLoading(false);});
    return ()=>ac.abort();
  },[celda.configId,celda.resultId]);

  const set=(campo:keyof Draft,valor:string)=>setForm(old=>({...old,[campo]:valor}));
  async function guardar(estado:"BORRADOR"|"EN_REVISION"){
    if(saving||!config||!formRef.current?.reportValidity())return;
    if(config.tipo_dato==="OPCION"&&allowed(config.opciones_permitidas).length===0){
      setError("El indicador no tiene opciones configuradas. Corrige su configuración antes de registrar resultados.");
      return;
    }
    if(estado==="EN_REVISION"&&config.requiere_evidencia&&!evidencia){
      setError("Para enviar a revisión debes adjuntar evidencia del periodo.");
      return;
    }
    if(estado==="EN_REVISION"&&!noAplica&&form.valor.trim()===""){
      setError("Captura el valor antes de enviarlo a revisión.");
      return;
    }
    if(estado==="EN_REVISION"&&form.datos_base.trim()){
      try{
        const val=JSON.parse(form.datos_base);
        if(!val||typeof val!=="object"||Array.isArray(val))throw new Error();
      }catch {setError("Los datos base deben ser un objeto JSON válido.");return;}
    }
    setSaving(true);setError("");
    try {
      const payload=new FormData();
      payload.set("indicador_id",String(indicador.id));
      payload.set("configuracion_id",String(config.id_Configuracion));
      payload.set("periodo_inicio",celda.start);
      payload.set("periodo_fin",celda.end);
      payload.set("revision_esperada",String(revision));
      payload.set("estado",estado);
      payload.set("no_aplica",String(noAplica));
      for(const [key,value] of Object.entries(form))payload.set(key,value);
      if(evidencia)payload.set("evidencia",evidencia,evidencia.name);
      const resultado=await post<{success:boolean;id:number;revision:number;estado:string}>(
        "capturas-historicas",payload,
      );
      onSaved("Resultado histórico "+(estado==="BORRADOR"?"guardado como borrador":"enviado a revisión")+
        " · revisión "+resultado.revision+". La vista oficial solo incluye registros aprobados.");
    } catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el resultado.");}
    finally{setSaving(false);}
  }

  return <div className="kpi-dialog-body kpi-captura">
    {loading?<p role="status">Consultando configuración y resultado anterior…</p>:!config?
      <p role="alert" className="kpi-alert bad">{error||"Configuración no disponible."}</p>:
    <>
      <div className="kpi-capture-summary">
        <strong>{indicador.name}</strong>
        <p>{indicador.area} · {period(celda)} · {celda.start} al {celda.end}</p>
        <p>Meta: <strong>{celda.target}</strong> · v{config.version} · {config.metodo_calculo}
          {config.unidad?" · "+config.unidad:""}</p>
        <p>Fecha límite original de captura: {celda.due}. El sistema conserva la fecha real de registro y la etiqueta de captura histórica.</p>
        {!!config.formula_descriptiva&&<p>Fórmula: {config.formula_descriptiva}</p>}
        {!!config.fuente_datos&&<p>Fuente configurada: {config.fuente_datos}</p>}
      </div>
      {error&&<p role="alert" className="kpi-alert bad">{error}</p>}
      <form ref={formRef} onSubmit={e=>e.preventDefault()} className="kpi-capture-form">
        <label className="kpi-capture-na">
          <input type="checkbox" checked={noAplica} onChange={e=>setNoAplica(e.target.checked)}/>
          Este indicador no aplicó durante el periodo
        </label>
        {noAplica&&<label>
          Justificación de no aplicabilidad *
          <textarea required minLength={15} maxLength={3000} rows={3}
            value={form.justificacion_no_aplica} onChange={e=>set("justificacion_no_aplica",e.target.value)}
            placeholder="Explica por qué no corresponde medir este indicador en el periodo histórico."/>
          <small>Necesita revisión independiente; no se contabiliza como medición cumplida.</small>
        </label>}
        <div className="kpi-capture-fields">
          {!noAplica&&<label>
            Resultado del periodo *
            {config.tipo_dato==="NUMERICO"?
              <input type="number" step="any" required value={form.valor}
                onChange={e=>set("valor",e.target.value)}
                placeholder={"Valor en "+(config.unidad||"unidad del indicador")}/>:
              config.tipo_dato==="BOOLEANO"?
                <select required value={form.valor} onChange={e=>set("valor",e.target.value)}>
                  <option value="">Seleccionar</option>
                  <option value="true">Sí</option><option value="false">No</option>
                </select>:
                <select required value={form.valor} onChange={e=>set("valor",e.target.value)}>
                  <option value="">Seleccionar opción</option>
                  {allowed(config.opciones_permitidas).map(x=><option key={x} value={x}>{x}</option>)}
                </select>}
            <small>Se utiliza el tipo y la precisión aprobados para este periodo.</small>
          </label>}
          <label>
            Fuente del dato histórico *
            <input required minLength={5} maxLength={2000} value={form.fuente}
              onChange={e=>set("fuente",e.target.value)}
              placeholder="Bitácora, reporte, control de producción, folio, etc."/>
          </label>
          <label>
            Fecha del documento de origen
            <input type="date" value={form.fecha_documento} onChange={e=>set("fecha_documento",e.target.value)}/>
          </label>
          <label>
            Evidencia documental {config.requiere_evidencia?"(obligatoria al enviar a revisión)":""}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx"
              onChange={e=>setEvidencia(e.target.files?.[0]??null)}/>
            <small>PDF, PNG, JPG o Excel XLSX · máximo 8 MB. Cada corrección tiene su propia evidencia.</small>
          </label>
        </div>
        <label>
          Datos base del cálculo (JSON)
          <textarea rows={3} value={form.datos_base} onChange={e=>set("datos_base",e.target.value)}
            placeholder='{"numerador": 12, "denominador": 20, "fuente": "registro de mediciones"}'/>
          <small>
            {noAplica?"No corresponde al periodo no aplicable.":config.metodo_calculo==="DIRECTO"
              ?"Opcional si el valor se obtiene directamente de la fuente."
              :"Obligatorio porque la configuración usa un cálculo; registra las variables usadas y su procedencia."}
          </small>
        </label>
        <label>
          Observaciones y contexto histórico
          <textarea rows={2} maxLength={5000} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)}
            placeholder="Situación de la operación, desviaciones, consideraciones del periodo…"/>
        </label>
        <div className="kpi-capture-fields">
          <label>
            Análisis de resultados
            <textarea rows={3} maxLength={5000} value={form.analisis} onChange={e=>set("analisis",e.target.value)}
              placeholder="Análisis de desempeño respecto de la meta"/>
          </label>
          <label>
            Acciones propuestas y seguimiento
            <textarea rows={3} maxLength={5000} value={form.acciones_propuestas}
              onChange={e=>set("acciones_propuestas",e.target.value)}
              placeholder="Acciones correctivas, responsables, compromisos…"/>
          </label>
        </div>
        <label>
          Motivo de {revision>0?"corrección":"registro histórico"}
          <textarea rows={2} required maxLength={2000} minLength={revision>0?10:1}
            value={form.motivo} onChange={e=>set("motivo",e.target.value)}
            placeholder="Por qué se registra o corrige este periodo"/>
        </label>
        <p className="kpi-alert amber">
          Los valores guardados desde el calendario no se aprueban automáticamente. Los borradores y las mediciones
          pendientes de revisión pueden consultarse en la vista preliminar. La aprobación requiere otra cuenta SHyMA.
        </p>
        <div className="kpi-capture-actions">
          <button type="button" className="kpi-button" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="button" className="kpi-button" onClick={()=>void guardar("BORRADOR")} disabled={saving}>Guardar borrador</button>
          <button type="button" className="kpi-button primary" onClick={()=>void guardar("EN_REVISION")} disabled={saving}>
            {saving?"Guardando…":"Guardar y enviar a revisión"}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
