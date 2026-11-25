'use client';
import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileCheck2, Truck } from 'lucide-react';
import { API_URL, apiFetch, pedir, sesionActual } from '@/utils/api';

type Entrega = {
  id_Entrega:number; folio:string; estado_entrega:string; destino:string;
  fecha_Salida_Transporte:string|null; fecha_Entrega_Cliente:string|null;
  comprobante_nombre:string|null; orden_venta: { folio:string; persona_id:number };
  detalles:Array<{id:number;cantidad:string;cantidad_recibida:string|null;lote:{folio:string}}>;
  vehiculo:{placa:string;tipo:string}|null;
};
const f=(x:unknown)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(Number(x)||0);
export default function PortalEntregasReales({clienteId}:{clienteId:number}){
  const [data,setData]=useState<Entrega[]>([]);
  const [error,setError]=useState('');
  const [activo,setActivo]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);
  const [cargando,setCargando]=useState(true);
  const [area,setArea]=useState('');
  const cargar=async()=>{
    setCargando(true);
    try {
      const x=await pedir('/api/logistica/entregas',undefined,'GET');
      setData((x.data||[]).filter((e:Entrega)=>e.orden_venta.persona_id===clienteId));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'No fue posible consultar las entregas.');}
    finally {setCargando(false);}
  };
  useEffect(()=>{setArea(sesionActual()?.area||'');void cargar();},[clienteId]);
  const enTransito=data.filter(x=>x.estado_entrega==='DESPACHADA');
  const entregados=data.filter(x=>x.estado_entrega==='ENTREGADA');
  const cantidad=entregados.flatMap(x=>x.detalles).reduce((s,x)=>s+Number(x.cantidad_recibida||0),0);
  const actual=enTransito.find(x=>x.id_Entrega===activo);
  const confirmar=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!actual||busy)return;
    const b=new FormData(e.currentTarget);
    b.set('detalles',JSON.stringify(actual.detalles.map(d=>({
      id:d.id,cantidad_recibida:b.get('kg_'+d.id),
    }))));
    setBusy(true);setError('');
    try {
      const res=await apiFetch(API_URL+'/api/logistica/entregas/'+actual.id_Entrega+'/confirmar',{
        method:'POST',body:b,
      });
      const x=await res.json().catch(()=>null);
      if(!res.ok||!x?.success)throw new Error(x?.message||'No se pudo confirmar recepción.');
      setActivo(null);await cargar();
    }catch(err){setError(err instanceof Error?err.message:'No se pudo guardar la entrega.');}
    finally{setBusy(false);}
  };
  return <section className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-[#173e35]">
          <Truck size={21} className="text-[#13735c]"/> Entregas reales y comprobantes
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Viajes registrados desde Logística. Estos movimientos no deben confundirse con la simulación visual de transportes.
        </p>
      </div>
      <button type="button" onClick={()=>void cargar()}
        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#176f5b]">
        Actualizar
      </button>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-[#f3f8f5] p-3"><p className="text-[11px] text-slate-500">En tránsito</p>
        <p className="mt-1 text-xl font-bold text-[#173e35]">{enTransito.length}</p></div>
      <div className="rounded-xl bg-[#f3f8f5] p-3"><p className="text-[11px] text-slate-500">Entregas confirmadas</p>
        <p className="mt-1 text-xl font-bold text-[#173e35]">{entregados.length}</p></div>
      <div className="rounded-xl bg-[#f3f8f5] p-3"><p className="text-[11px] text-slate-500">Recibidos confirmados</p>
        <p className="mt-1 text-xl font-bold text-[#173e35]">{f(cantidad)} <span className="text-xs">kg</span></p></div>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {cargando?<p className="mt-4 text-xs text-slate-500">Consultando despachos...</p>:<div className="mt-4 space-y-3">
      {data.filter(e=>e.estado_entrega!=='CANCELADA').slice(0,20).map(e=><article key={e.id_Entrega}
        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div>
          <p className="text-sm font-bold text-[#173e35]">{e.folio} · {e.orden_venta.folio}</p>
          <p className="mt-1 text-xs text-slate-500">{e.vehiculo?.placa||'Viaje pendiente'} · {e.destino}</p>
          <p className="mt-1 text-xs text-slate-500">
            {f(e.detalles.reduce((s,d)=>s+Number(d.cantidad),0))} kg despachados
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#edf5ef] px-2.5 py-1 text-xs font-semibold text-[#176f5b]">{e.estado_entrega}</span>
          {e.comprobante_nombre&&<button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
            onClick={async()=>{
              try{
                const res=await apiFetch(API_URL+'/api/logistica/entregas/'+e.id_Entrega+'/comprobante');
                if(!res.ok)throw new Error('Documento no disponible.');
                const url=URL.createObjectURL(await res.blob());
                const a=document.createElement('a');a.href=url;a.download=e.comprobante_nombre||'acuse.pdf';a.click();
                setTimeout(()=>URL.revokeObjectURL(url),1500);
              }catch(err){setError(err instanceof Error?err.message:'Error al descargar.');}
            }}>
            <FileCheck2 size={14}/> Acuse
          </button>}
          {area==='cliente'&&e.estado_entrega==='DESPACHADA'&&<button type="button"
            onClick={()=>setActivo(e.id_Entrega)} className="rounded-lg bg-[#176f5b] px-3 py-1.5 text-xs font-semibold text-white">
            Confirmar recepción
          </button>}
        </div>
      </article>)}
      {!data.length&&<p className="text-xs text-slate-500">Todavía no existen entregas físicas registradas para este cliente.</p>}
    </div>}
    {area==='cliente'&&actual&&<form onSubmit={e=>void confirmar(e)} className="mt-4 space-y-3 rounded-xl border border-[#cfe2d4] bg-[#f9fcfa] p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-[#173e35]"><ClipboardCheck size={17}/> Confirmar entrega {actual.folio}</h4>
      <label className="block text-xs font-semibold">Nombre de quien recibe
        <input name="recibido_por" required maxLength={150} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"/>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {actual.detalles.map(d=><label key={d.id} className="block rounded-lg border border-slate-200 bg-white p-2 text-xs">
          {d.lote.folio} · {f(d.cantidad)} kg enviados
          <input name={'kg_'+d.id} type="number" min="0" max={d.cantidad} step="0.0001"
            defaultValue={d.cantidad} required className="mt-1 w-full rounded-lg border border-slate-200 p-2"/>
        </label>)}
      </div>
      <label className="block text-xs font-semibold">Acuse de recepción firmado (PDF)
        <input name="comprobante" type="file" accept="application/pdf,.pdf" required className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"/>
      </label>
      <label className="block text-xs font-semibold">Observaciones
        <textarea name="observaciones" rows={2} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/>
      </label>
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#176f5b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
        <CheckCircle2 size={16}/> Guardar comprobante
      </button>
    </form>}
  </section>;
}
