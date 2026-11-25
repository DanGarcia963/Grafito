'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { API_URL, apiFetch, pedir, sesionActual } from '@/utils/api';

type Registro = {
  lote_id:number;folio:string;fecha:string|null;op:string|null;
  estado_expediente:string;documento:string|null;observaciones:string|null;
  revisado_por:string|null;revisado_en:string|null;
};
export default function ConciliacionCalidadPage(){
  const [registros,setRegistros]=useState<Registro[]>([]);
  const [seleccion,setSeleccion]=useState<number|null>(null);
  const [error,setError]=useState('');const [exito,setExito]=useState('');
  const [busy,setBusy]=useState(false);const [cargando,setCargando]=useState(true);
  const cargar=async()=>{
    setCargando(true);
    try{
      if(sesionActual()?.area!=='calidad')throw new Error('Acceso exclusivo para Control de Calidad.');
      const r=await pedir('/api/calidad/conciliacion-legacy',undefined,'GET');
      setRegistros(r.data||[]);setError('');
    }catch(e){setError(e instanceof Error?e.message:'Error al consultar Calidad.');}
    finally{setCargando(false);}
  };
  useEffect(()=>{void cargar();},[]);
  const pendientes=registros.filter(r=>r.estado_expediente!=='CERTIFICADO');
  const activo=pendientes.find(r=>r.lote_id===seleccion);
  const enviar=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!activo||busy)return;
    const f=new FormData(e.currentTarget);
    setBusy(true);setError('');setExito('');
    try{
      const r=await apiFetch(API_URL+'/api/calidad/conciliacion-legacy/'+activo.lote_id,{
        method:'POST',body:f,
      });
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data?.success)throw new Error(data?.message||'No se pudo resolver el expediente.');
      setExito('Revisión documentada. La decisión permanece en el historial del lote.');
      setSeleccion(null);await cargar();
    }catch(err){setError(err instanceof Error?err.message:'No se pudo resolver.');}
    finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-[#f3f7f4] p-4 text-slate-800 md:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">GRAFITO · CONTROL DE CALIDAD</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#173e35]">Conciliación de liberaciones históricas</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Los lotes previamente liberados sin certificado digital requieren una decisión documentada.
            La validación no crea un certificado nuevo, no altera pesos ni omite las restricciones para lotes actuales.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/calidad" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Volver a Calidad</Link>
          <button type="button" onClick={()=>void cargar()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
            <RefreshCw size={15} className={cargando?'inline animate-spin':'inline'}/> Actualizar
          </button>
        </div>
      </header>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {exito&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{exito}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Lotes liberados revisados</p>
          <p className="mt-2 text-2xl font-bold text-[#173e35]">{registros.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">Sin certificado regular</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{pendientes.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-800">Con certificado regular</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{registros.length-pendientes.length}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><FileCheck size={18}/> Expedientes de lote</h2>
          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
            {registros.map(r=><div key={r.lote_id}><button type="button"
              onClick={()=>setSeleccion(r.estado_expediente==='CERTIFICADO'?null:r.lote_id)}
              className={'flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left '+
                (seleccion===r.lote_id?'border-emerald-500 bg-emerald-50':'border-slate-200')}>
              <div><p className="text-sm font-semibold">{r.folio}</p>
                <p className="text-xs text-slate-500">{r.op||'Sin OP'} · {r.documento||'Sin evidencia digital'}</p></div>
              <span className={'rounded-lg px-2.5 py-1 text-[11px] font-semibold '+
                (r.estado_expediente==='CERTIFICADO'||r.estado_expediente==='VALIDADA'
                  ?'bg-emerald-100 text-emerald-800':
                  r.estado_expediente==='BLOQUEADA'?'bg-red-100 text-red-800':
                  'bg-amber-100 text-amber-800')}>
                {r.estado_expediente}
              </span>
            </button>
            {r.documento && r.estado_expediente!=='CERTIFICADO' && <button type="button"
              onClick={async()=>{
                try{
                  const res=await apiFetch(API_URL+'/api/calidad/conciliacion-legacy/'+r.lote_id+'/documento');
                  if(!res.ok)throw new Error('No se pudo obtener la evidencia.');
                  const url=URL.createObjectURL(await res.blob());
                  const a=document.createElement('a');a.href=url;a.download=r.documento||'conciliacion.pdf';a.click();
                  setTimeout(()=>URL.revokeObjectURL(url),1500);
                }catch(err){setError(err instanceof Error?err.message:'Error al descargar documento.');}
              }}
              className="mt-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              Descargar evidencia PDF
            </button>}
            </div>)}
            {!registros.length&&<p className="text-sm text-slate-500">No hay lotes liberados en los registros.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><ShieldCheck size={18}/> Resolver expediente</h2>
          {!activo?<p className="mt-3 text-sm text-slate-500">Selecciona a la izquierda un lote sin certificado regular para revisar su evidencia.</p>:
            <form key={activo.lote_id} onSubmit={e=>void enviar(e)} className="mt-4 space-y-3">
              <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold">Lote {activo.folio} · {activo.op||'Sin OP'}</p>
              <label className="block text-xs font-semibold">Decisión de Calidad
                <select name="estado" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" required>
                  <option value="BLOQUEADA">Bloqueada · no permitir entrega</option>
                  <option value="VALIDADA">Validada · evidencia histórica aceptada</option>
                </select>
              </label>
              <label className="block text-xs font-semibold">Justificación técnica (mínimo 12 caracteres)
                <textarea name="motivo" required minLength={12} maxLength={4000} rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"/>
              </label>
              <label className="block text-xs font-semibold">Evidencia histórica PDF (obligatoria si validas)
                <input name="documento" type="file" accept=".pdf,application/pdf"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"/>
              </label>
              <button disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                <CheckCircle2 size={16}/> Guardar decisión
              </button>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <AlertTriangle size={16} className="shrink-0"/>
                Solo se aceptan conciliaciones para los LP históricos identificados durante la migración.
                Se registra el usuario y la decisión; sin PDF aprobado, el lote no se habilita para despacho.
              </p>
            </form>}
        </section>
      </div>
    </div>
  </main>;
}
