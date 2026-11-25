'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, FileCheck2, Package,
  PackageCheck, Plus, RefreshCw, ShieldCheck, Truck, Warehouse,
} from 'lucide-react';
import { apiFetch, API_URL, pedir, sesionActual } from '@/utils/api';

type Vehiculo = {
  id: number; tipo: 'TORTON' | 'TRAILER'; placa: string;
  capacidad_kg: string; capacidad_contenedores: number; activo: boolean;
};
type Viaje = {
  id: number; folio: string; estado: string; operador: string;
  vehiculo_id: number; fecha_programada: string | null;
};
type Orden = { id:number; folio:string; cantidad:string; unidad:string;
  cliente:{nombre:string}; producto:{nombre_Producto:string} };
type Detalle = {
  id:number; cantidad:string; cantidad_recibida:string|null;
  lote:{folio:string}; contenedores:Array<{contenedor_id:number;cantidad_kg:string}>;
};
type Entrega = {
  id_Entrega:number; folio:string; orden_venta_id:number; viaje_id:number|null;
  destino:string; estado_entrega:string; recibido_por:string|null;
  comprobante_nombre:string|null; observaciones:string|null;
  detalles:Detalle[]; orden_venta:{folio:string;cliente:{nombre:string}};
};
type Contenedor = { id:number; codigo:string; lote_inventario_id:number;
  ubicacion_id:number; saldo_kg:string; estado:string };
type Candidato = { id:number; codigo:string;kg:string; lote:string; prensa:string;
  vuelta:string|null; ubicacion_id:number; lote_inventario_id:number };
type Conciliacion = { ov_id:number; folio:string;cliente:string; unidad:string;
  cantidad_solicitada:string;cantidad_asignada:string;cantidad_despachada:string;
  cantidad_recibida:string;pendiente_entrega:string;discrepancia_kg:string;
  facturas_registradas:number;pagos_confirmados:number;cerrada_fisicamente:boolean };
const formato = (n: unknown) => new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(Number(n)||0);
const box = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-40';

function etiqueta(estado:string) {
  return estado==='ENTREGADA'||estado==='ENTREGADO'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : estado==='CANCELADO'||estado==='CANCELADA'
    ? 'bg-red-50 text-red-800 border-red-200'
    : estado==='DESPACHADA'||estado==='DESPACHADO'
    ? 'bg-blue-50 text-blue-800 border-blue-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';
}

export default function LogisticaEntregas() {
  const [area,setArea]=useState('');
  const [tab,setTab]=useState<'operacion'|'vehiculos'|'inventario'|'conciliacion'>('operacion');
  const [catalogos,setCatalogos]=useState<{vehiculos:Vehiculo[];viajes:Viaje[];ordenes:Orden[];
    ubicaciones:Array<{id:number;nombre:string}>}>({vehiculos:[],viajes:[],ordenes:[],ubicaciones:[]});
  const [entregas,setEntregas]=useState<Entrega[]>([]);
  const [contenedores,setContenedores]=useState<Contenedor[]>([]);
  const [conciliaciones,setConciliaciones]=useState<Conciliacion[]>([]);
  const [cargando,setCargando]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [entregaSeleccionada,setEntregaSeleccionada]=useState<number|null>(null);
  const [candidatos,setCandidatos]=useState<Candidato[]>([]);
  const [notaCandidatos,setNotaCandidatos]=useState('');
  const [contenedoresElegidos,setContenedoresElegidos]=useState<number[]>([]);
  const [comprobados,setComprobados]=useState<Record<number,number[]>>({});
  const [recepcionSeleccionada,setRecepcionSeleccionada]=useState<number|null>(null);

  const cargarDatos = async (rol?:string) => {
    const r=rol||sesionActual()?.area||'';
    if (!['logistica','almacen','produccion','ventas','contaduria'].includes(r)) {
      setError('Acceso exclusivo del personal autorizado.');
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [cat,ent,con,inv]=await Promise.all([
        pedir('/api/logistica/catalogos',undefined,'GET'),
        pedir('/api/logistica/entregas',undefined,'GET'),
        pedir('/api/logistica/conciliacion',undefined,'GET'),
        ['logistica','almacen','produccion'].includes(r)
          ? pedir('/api/logistica/contenedores',undefined,'GET') : Promise.resolve({data:[]}),
      ]);
      setCatalogos({vehiculos:cat.vehiculos,viajes:cat.viajes,ordenes:cat.ordenes,ubicaciones:cat.ubicaciones});
      setEntregas(ent.data||[]);
      setConciliaciones(con.data||[]);
      setContenedores(inv.data||[]);
      setError('');
    } catch(e) { setError(e instanceof Error ? e.message : 'No fue posible consultar Logística.'); }
    finally { setCargando(false); }
  };
  useEffect(() => {const rol=sesionActual()?.area||'';setArea(rol);void cargarDatos(rol);},[]);

  const ejecutar=async (fn:()=>Promise<unknown>,exito:string) => {
    if(busy) return;
    setBusy(true);setError('');setMensaje('');
    try {await fn();setMensaje(exito);await cargarDatos();}
    catch(e){setError(e instanceof Error?e.message:'Operación no completada.');}
    finally {setBusy(false);}
  };
  const getForm=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();return Object.fromEntries(new FormData(e.currentTarget));
  };
  const entregaActiva=entregas.find(e=>e.id_Entrega===entregaSeleccionada);
  const recepcionActiva=entregas.find(e=>e.id_Entrega===recepcionSeleccionada);
  const viajeSeleccionado=(v:Viaje)=>entregas.filter(e=>e.viaje_id===v.id&&e.estado_entrega!=='CANCELADA');
  const códigosDe=(v:Viaje)=>viajeSeleccionado(v).flatMap(e=>e.detalles)
    .flatMap(d=>d.contenedores)
    .map(d=>contenedores.find(c=>c.id===d.contenedor_id))
    .filter((c):c is Contenedor=>!!c);
  const consultaCandidatos=async (id:number|null) => {
    setEntregaSeleccionada(id);setContenedoresElegidos([]);setCandidatos([]);setNotaCandidatos('');
    if(id==null) return;
    const e=entregas.find(x=>x.id_Entrega===id);
    if(!e) return;
    try {
      const x=await pedir('/api/logistica/candidatos?ovId='+e.orden_venta_id,undefined,'GET');
      setCandidatos(x.data||[]);setNotaCandidatos(x.nota||'');
    } catch(err){setError(err instanceof Error?err.message:'No se pudo obtener el inventario.');}
  };
  const pesoElegido=candidatos.filter(c=>contenedoresElegidos.includes(c.id))
    .reduce((s,c)=>s+(Number(c.kg)||0),0);
  const pendientes=entregas.filter(e=>e.estado_entrega==='BORRADOR'&&!e.detalles.length);

  return <main className="min-h-screen bg-[#f3f7f4] px-3 py-6 text-slate-800 sm:px-6 lg:py-9">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">GRAFITO · LOGÍSTICA</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#173e35]">Entregas y embarques</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Desde la preparación de contenedores hasta el acuse del cliente. Solo el despacho
            descontará inventario; la programación y la carga se mantienen como compromisos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/manifiestos" className={secondary}>Manifiestos</Link>
          <Link href="/" className={secondary}>Inicio</Link>
          <button type="button" onClick={()=>void cargarDatos()} disabled={cargando} className={secondary}>
            <RefreshCw size={16} className={cargando?'animate-spin':''}/> Actualizar
          </button>
        </div>
      </div>

      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {mensaje&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>}
      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm">
        {([
          ['operacion','Viajes y entregas',Truck],
          ['vehiculos','Vehículos',Warehouse],
          ['inventario','Contenedores',Package],
          ['conciliacion','Conciliación OV',ClipboardCheck],
        ] as const).map(([id,label,Icon])=><button key={id} type="button" onClick={()=>setTab(id)}
          className={'inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold '+
            (tab===id?'bg-emerald-700 text-white':'text-slate-600 hover:bg-emerald-50')}>
          <Icon size={16}/>{label}
        </button>)}
      </div>

      {tab==='operacion'&&<div className="space-y-4">
        {area==='logistica'&&<div className="grid gap-4 lg:grid-cols-2">
          <form className={box} onSubmit={e=>{
            const b=getForm(e);
            if(b.fecha_programada) b.fecha_programada=new Date(String(b.fecha_programada)).toISOString();
            void ejecutar(()=>pedir('/api/logistica/viajes',b),'Viaje programado.');}}>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-[#173e35]"><Truck size={19}/> Nuevo viaje</h2>
            <div className="space-y-3">
              <label className="block text-xs font-semibold">Vehículo
                <select name="vehiculo_id" required className={field} defaultValue="">
                  <option value="">Selecciona vehículo</option>
                  {catalogos.vehiculos.filter(v=>v.activo).map(v=><option key={v.id} value={v.id}>
                    {v.tipo==='TORTON'?'Tortón':'Tráiler'} · {v.placa} · {v.capacidad_contenedores} cont.
                  </option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Operador
                <input name="operador" required maxLength={150} className={field} placeholder="Responsable del transporte"/>
              </label>
              <label className="block text-xs font-semibold">Salida programada
                <input name="fecha_programada" type="datetime-local" className={field}/>
              </label>
              <button disabled={busy||!catalogos.vehiculos.length} className={primary}><Plus size={15}/> Programar viaje</button>
            </div>
          </form>
          <form className={box} onSubmit={e=>{
            const b=getForm(e);void ejecutar(()=>pedir('/api/logistica/entregas',b),'Entrega creada para su preparación.');}}>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-[#173e35]"><PackageCheck size={19}/> Nueva entrega de OV</h2>
            <div className="space-y-3">
              <label className="block text-xs font-semibold">Orden de venta
                <select name="orden_venta_id" required className={field} defaultValue="">
                  <option value="">Selecciona OV confirmada</option>
                  {catalogos.ordenes.map(v=><option key={v.id} value={v.id}>
                    {v.folio} · {v.cliente.nombre} · {formato(v.cantidad)} {v.unidad}
                  </option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Asignar a viaje
                <select name="viaje_id" required className={field} defaultValue="">
                  <option value="">Selecciona viaje programado</option>
                  {catalogos.viajes.filter(v=>v.estado==='PROGRAMADO').map(v=><option key={v.id} value={v.id}>
                    {v.folio} · {catalogos.vehiculos.find(c=>c.id===v.vehiculo_id)?.placa||'Vehículo'}
                  </option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Dirección / destino
                <input name="destino" required maxLength={1000} className={field} placeholder="Lugar exacto de recepción"/>
              </label>
              <button disabled={busy||!catalogos.ordenes.length} className={primary}><Plus size={15}/> Crear entrega</button>
            </div>
          </form>
        </div>}

        {['logistica','almacen'].includes(area)&&<section className={box}>
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><Package size={19}/> Preparación de entrega</h2>
          <p className="mt-1 text-xs text-slate-500">Selecciona contenedores físicos verificados y liberados para la OV. La selección no genera una salida.</p>
          <select value={entregaSeleccionada??''} onChange={e=>void consultaCandidatos(e.target.value?Number(e.target.value):null)}
            className={field+' mt-3'} disabled={busy}>
            <option value="">Selecciona una entrega sin carga</option>
            {pendientes.map(e=><option key={e.id_Entrega} value={e.id_Entrega}>
              {e.folio} · {e.orden_venta.cliente.nombre} · {e.orden_venta.folio}
            </option>)}
          </select>
          {entregaActiva&&<div className="mt-4">
            <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              {candidatos.map(c=><label key={c.id} className={'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs '+
                (contenedoresElegidos.includes(c.id)?'border-emerald-500 bg-emerald-50':'border-slate-100 bg-white')}>
                <input type="checkbox" checked={contenedoresElegidos.includes(c.id)} onChange={e=>
                  setContenedoresElegidos(prev=>e.target.checked?[...prev,c.id]:prev.filter(v=>v!==c.id))}/>
                <span className="min-w-0 flex-1">
                  <strong className="block text-slate-800">{c.codigo} · {formato(c.kg)} kg</strong>
                  <span className="text-slate-500">{c.lote} · {c.prensa} · vuelta {c.vuelta??'S/R'}</span>
                </span>
              </label>)}
              {!candidatos.length&&<p className="text-sm text-slate-500">{notaCandidatos||'Sin contenedores disponibles.'}</p>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-600"><strong>{contenedoresElegidos.length}</strong> contenedores · <strong>{formato(pesoElegido)} kg</strong></span>
              <button type="button" disabled={busy||contenedoresElegidos.length===0} className={primary}
                onClick={()=>void ejecutar(async()=>{
                  await pedir('/api/logistica/entregas/'+entregaActiva.id_Entrega+'/preparar',
                    {contenedor_ids:contenedoresElegidos});
                  await consultaCandidatos(null);
                },'Contenedores reservados para la entrega.')}>
                <ClipboardCheck size={16}/> Preparar entrega
              </button>
            </div>
          </div>}
        </section>}

        <section className={box}>
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><Truck size={19}/> Viajes programados y en tránsito</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {catalogos.viajes.map(v=>{
              const vehiculo=catalogos.vehiculos.find(x=>x.id===v.vehiculo_id);
              const envios=viajeSeleccionado(v);
              const cajas=códigosDe(v);
              const cotejados=comprobados[v.id]||[];
              return <article key={v.id} className="rounded-xl border border-slate-200 bg-[#fcfdfc] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-bold text-[#173e35]">{v.folio}</p>
                    <p className="text-xs text-slate-500">{vehiculo?.tipo==='TORTON'?'Tortón':'Tráiler'} · {vehiculo?.placa||'Sin vehículo'} · {v.operador}</p></div>
                  <span className={'rounded-full border px-2.5 py-1 text-[11px] font-semibold '+etiqueta(v.estado)}>{v.estado}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>{envios.length} entregas</span>
                  <span>{cajas.length}/{vehiculo?.capacidad_contenedores||0} contenedores</span>
                  <span>{formato(envios.flatMap(e=>e.detalles).reduce((s,d)=>s+Number(d.cantidad),0))} kg</span>
                </div>
                {envios.length>0&&<p className="mt-2 text-xs text-slate-500">{envios.map(x=>x.orden_venta.cliente.nombre).join(', ')}</p>}
                {v.estado==='PROGRAMADO'&&area==='almacen'&&cajas.length>0&&<div className="mt-3 rounded-lg bg-emerald-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-emerald-900">Cotejo físico · marca cada código presente en la carga</p>
                  <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
                    {cajas.map(c=><label key={c.id} className="flex items-center gap-2 text-xs text-emerald-900">
                      <input type="checkbox" checked={cotejados.includes(c.id)} onChange={e=>
                        setComprobados(prev=>({
                          ...prev,[v.id]:e.target.checked?[...(prev[v.id]||[]),c.id]:(prev[v.id]||[]).filter(i=>i!==c.id),
                        }))}/>
                      {c.codigo}
                    </label>)}
                  </div>
                  <button type="button" className={primary+' mt-3'} disabled={busy||cotejados.length!==cajas.length}
                    onClick={()=>void ejecutar(()=>pedir('/api/logistica/viajes/'+v.id+'/cargar',{
                      confirmo_carga:true,contenedores_verificados:cajas.filter(c=>cotejados.includes(c.id)).map(c=>({id:c.id,codigo:c.codigo})),
                    }),'Carga física validada.')}>
                    <CheckCircle2 size={15}/> Confirmar carga ({cotejados.length}/{cajas.length})
                  </button>
                </div>}
                {v.estado==='CARGADO'&&['logistica','almacen'].includes(area)&&<button type="button"
                  disabled={busy} className={primary+' mt-3'}
                  onClick={()=>{if(window.confirm('¿Confirmas que el transporte salió físicamente de planta? Descontará inventario.')){
                    void ejecutar(()=>pedir('/api/logistica/viajes/'+v.id+'/despachar',{}),'Despacho registrado y existencia descontada.');}}}>
                  <ArrowRight size={15}/> Confirmar salida real
                </button>}
                {(v.estado==='PROGRAMADO'||v.estado==='CARGADO')&&area==='logistica'&&<button type="button"
                  className={secondary+' mt-3 ml-2'} disabled={busy} onClick={()=>{
                    const motivo=window.prompt('Motivo para cancelar el viaje completo:');
                    if(motivo)void ejecutar(()=>pedir('/api/logistica/viajes/'+v.id+'/cancelar',{motivo}),'Viaje cancelado sin movimiento físico.');
                  }}>Cancelar</button>}
              </article>;
            })}
            {!catalogos.viajes.length&&<p className="text-sm text-slate-500">Aún no hay viajes registrados.</p>}
          </div>
        </section>

        <section className={box}>
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><FileCheck2 size={19}/> Confirmación de entrega al cliente</h2>
          <p className="mt-1 text-xs text-slate-600">El acuse requiere un PDF y la cantidad recibida de cada lote. Las diferencias quedan como incidencia, sin crear existencias ficticias.</p>
          <select className={field+' mt-3'} value={recepcionSeleccionada??''}
            onChange={e=>setRecepcionSeleccionada(e.target.value?Number(e.target.value):null)}>
            <option value="">Selecciona una entrega despachada</option>
            {entregas.filter(e=>e.estado_entrega==='DESPACHADA').map(e=><option key={e.id_Entrega} value={e.id_Entrega}>
              {e.folio} · {e.orden_venta.cliente.nombre}
            </option>)}
          </select>
          {recepcionActiva&&<form key={recepcionActiva.id_Entrega} className="mt-4 space-y-3"
            onSubmit={e=>{
              e.preventDefault();
              const f=new FormData(e.currentTarget);
              const detalles=recepcionActiva.detalles.map(d=>({
                id:d.id,cantidad_recibida:f.get('recibido_'+d.id),
              }));
              f.set('detalles',JSON.stringify(detalles));
              void ejecutar(async()=>{
                const response=await apiFetch(API_URL+'/api/logistica/entregas/'+recepcionActiva.id_Entrega+'/confirmar',{
                  method:'POST',body:f,
                });
                const result=await response.json().catch(()=>null);
                if(!response.ok||!result?.success)throw new Error(result?.message||'No se pudo confirmar recepción.');
                setRecepcionSeleccionada(null);
              },'Recepción y comprobante registrados.');
            }}>
            <label className="block text-xs font-semibold">Recibido por
              <input name="recibido_por" required className={field} maxLength={150}/>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {recepcionActiva.detalles.map(d=><label key={d.id} className="block rounded-xl border border-slate-200 p-3 text-xs font-semibold">
                {d.lote.folio} · despachados {formato(d.cantidad)} kg
                <input name={'recibido_'+d.id} type="number" required min="0" max={d.cantidad} step="0.0001"
                  defaultValue={d.cantidad} className={field+' mt-2'}/>
              </label>)}
            </div>
            <label className="block text-xs font-semibold">Comprobante firmado (PDF máximo 10 MB)
              <input name="comprobante" type="file" accept="application/pdf,.pdf" required className={field+' mt-2'}/>
            </label>
            <label className="block text-xs font-semibold">Observaciones de recepción
              <textarea name="observaciones" rows={2} className={field}/>
            </label>
            <button className={primary} disabled={busy}><FileCheck2 size={15}/> Confirmar recepción</button>
          </form>}
        </section>

        <section className={box}>
          <h2 className="font-bold text-[#173e35]">Historial de entregas</h2>
          <div className="mt-3 space-y-2">
            {entregas.map(e=><div key={e.id_Entrega}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <div><p className="font-semibold">{e.folio} · {e.orden_venta.cliente.nombre}</p>
                <p className="mt-1 text-xs text-slate-500">{e.orden_venta.folio} · {formato(e.detalles.reduce((s,d)=>s+Number(d.cantidad),0))} kg · {e.detalles.flatMap(d=>d.contenedores).length} cont.</p>
                <p className="text-xs text-slate-500">{e.destino}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={'rounded-full border px-2.5 py-1 text-xs font-semibold '+etiqueta(e.estado_entrega)}>{e.estado_entrega}</span>
                {e.comprobante_nombre&&<button className={secondary} onClick={async()=>{
                  try {const r=await apiFetch(API_URL+'/api/logistica/entregas/'+e.id_Entrega+'/comprobante');
                    if(!r.ok)throw new Error('No se pudo obtener el acuse.');
                    const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');
                    a.href=url;a.download=e.comprobante_nombre||'acuse.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
                  }catch(err){setError(err instanceof Error?err.message:'No se pudo descargar el comprobante.');}
                }}>Acuse PDF</button>}
                {e.estado_entrega==='BORRADOR'&&area==='logistica'&&<button className={secondary}
                  onClick={()=>{const motivo=window.prompt('Motivo de cancelación de entrega:');
                    if(motivo)void ejecutar(()=>pedir('/api/logistica/entregas/'+e.id_Entrega+'/cancelar',{motivo}),'Entrega cancelada.');}}
                >Cancelar</button>}
              </div>
            </div>)}
            {!entregas.length&&<p className="text-sm text-slate-500">No existen entregas confirmadas o planeadas en este momento.</p>}
          </div>
        </section>
      </div>}

      {tab==='vehiculos'&&<div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        {area==='logistica'&&<form className={box} onSubmit={e=>{
          const b=getForm(e);void ejecutar(()=>pedir('/api/logistica/vehiculos',b),'Vehículo registrado.');}}>
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><Truck size={19}/> Registrar transporte</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold">Tipo de transporte
              <select name="tipo" className={field}>
                <option value="TORTON">Tortón · capacidad 12 contenedores</option>
                <option value="TRAILER">Tráiler · capacidad 22 contenedores</option>
              </select>
            </label>
            <label className="block text-xs font-semibold">Placas
              <input required name="placa" maxLength={30} className={field} placeholder="Placas de la unidad"/>
            </label>
            <label className="block text-xs font-semibold">Capacidad autorizada en kilogramos
              <input required type="number" step="0.0001" min="1" name="capacidad_kg" className={field}/>
            </label>
            <label className="block text-xs font-semibold">Transportista (opcional)
              <input name="transportista" className={field} maxLength={150}/>
            </label>
            <button disabled={busy} className={primary}><Plus size={15}/> Registrar</button>
          </div>
        </form>}
        <section className={box}>
          <h2 className="font-bold text-[#173e35]">Flota disponible</h2>
          <div className="mt-3 space-y-3">
            {catalogos.vehiculos.map(v=><div key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Truck className="text-emerald-700" size={24}/>
                <div><p className="font-semibold">{v.tipo==='TORTON'?'Tortón':'Tráiler'} · {v.placa}</p>
                  <p className="text-xs text-slate-500">Máximo {v.capacidad_contenedores} contenedores · {formato(v.capacidad_kg)} kg</p></div>
              </div>
              <span className="text-xs text-emerald-700">{v.activo?'Activo':'Inactivo'}</span>
            </div>)}
            {!catalogos.vehiculos.length&&<p className="text-sm text-slate-500">Registra una unidad para comenzar.</p>}
          </div>
        </section>
      </div>}

      {tab==='inventario'&&<div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {area==='almacen'&&<form className={box} onSubmit={e=>{
          e.preventDefault();const f=new FormData(e.currentTarget);
          const lines=String(f.get('lista')||'').split(/\r?\n/).filter(x=>x.trim());
          const contenedores=lines.map(x=>{const campos=x.split(',');return {codigo:campos[0]?.trim(),peso_kg:campos[1]?.trim()};});
          void ejecutar(()=>pedir('/api/logistica/contenedores/conciliar',{
            lote_inventario_id:f.get('lote_inventario_id'),ubicacion_id:f.get('ubicacion_id'),
            motivo:f.get('motivo'),contenedores,
          }),'Existencias individualizadas y conciliadas.');}}>
          <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><Warehouse size={19}/> Conciliar contenedores históricos</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Requiere conteo físico real. La suma de pesos debe ser idéntica al kardex actual.
            No crea inventario adicional.
          </p>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold">ID del lote de inventario
              <input required name="lote_inventario_id" type="number" min="1" step="1" className={field}/>
            </label>
            <label className="block text-xs font-semibold">Ubicación
              <select name="ubicacion_id" required className={field} defaultValue="">
                <option value="">Selecciona</option>
                {catalogos.ubicaciones.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Un contenedor por línea: CÓDIGO,PESO_KG
              <textarea name="lista" rows={6} required className={field} placeholder={'CONT-001,850\nCONT-002,835.5000'}/>
            </label>
            <label className="block text-xs font-semibold">Motivo y evidencia del conteo físico
              <textarea name="motivo" rows={2} minLength={12} maxLength={4000} required className={field}/>
            </label>
            <button disabled={busy} className={primary}><ShieldCheck size={15}/> Conciliar</button>
          </div>
        </form>}
        <section className={box}>
          <h2 className="font-bold text-[#173e35]">Contenedores identificados</h2>
          <p className="mt-1 text-xs text-slate-500">Estado físico individual; disponible para entrega solo si el producto está liberado con expediente aprobado.</p>
          <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto">
            {contenedores.map(c=><div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5">
              <div><p className="text-sm font-semibold">{c.codigo}</p>
                <p className="text-[11px] text-slate-500">Lote #{c.lote_inventario_id} · Ubicación #{c.ubicacion_id}</p></div>
              <div className="text-right"><p className="text-sm font-semibold">{formato(c.saldo_kg)} kg</p>
                <p className="text-[11px] text-slate-500">{c.estado}</p></div>
            </div>)}
            {!contenedores.length&&<p className="text-sm text-slate-500">Sin contenedores individualizados en el sistema.</p>}
          </div>
        </section>
      </div>}

      {tab==='conciliacion'&&<section className={box}>
        <h2 className="flex items-center gap-2 font-bold text-[#173e35]"><ClipboardCheck size={19}/> Conciliación comercial de órdenes de venta</h2>
        <p className="mt-1 text-xs text-slate-500">Compara lo solicitado con producto asignado, despachado y recibido. La conciliación no crea CFDI ni pagos.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[#edf5ef] text-[#173e35]"><tr>
              {['OV / Cliente','Solicitado','Asignado','Despachado','Recibido','Pendiente','Diferencia','Comprobantes / pagos','Estado'].map(x=>
                <th key={x} className="whitespace-nowrap px-3 py-3">{x}</th>)}
            </tr></thead>
            <tbody>
              {conciliaciones.map(c=><tr key={c.ov_id} className="border-b border-slate-100">
                <td className="px-3 py-3"><strong>{c.folio}</strong><br/>{c.cliente}</td>
                <td className="px-3 py-3">{formato(c.cantidad_solicitada)} {c.unidad}</td>
                <td className="px-3 py-3">{formato(c.cantidad_asignada)}</td>
                <td className="px-3 py-3">{formato(c.cantidad_despachada)}</td>
                <td className="px-3 py-3">{formato(c.cantidad_recibida)}</td>
                <td className="px-3 py-3">{formato(c.pendiente_entrega)}</td>
                <td className="px-3 py-3">{formato(c.discrepancia_kg)}</td>
                <td className="px-3 py-3">{c.facturas_registradas} facturas / {c.pagos_confirmados} pagos</td>
                <td className="px-3 py-3">{c.cerrada_fisicamente?'Entregado':'Pendiente'}</td>
              </tr>)}
            </tbody>
          </table>
          {!conciliaciones.length&&<p className="mt-4 text-sm text-slate-500">No hay órdenes de venta confirmadas para conciliar.</p>}
        </div>
      </section>}

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
        <AlertCircle size={17} className="mt-0.5 shrink-0"/>
        La planeación visual del portal del cliente continúa siendo una simulación separada.
        Los movimientos reales se crean exclusivamente al confirmar el despacho desde esta sección.
        Toda discrepancia de recepción queda registrada y requiere una devolución física documentada antes de reingresar material.
      </p>
    </div>
  </main>;
}
