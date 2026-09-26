'use client';
import { useState } from 'react';
import { API_URL, apiFetch as fetch } from '@/utils/api';
export default function TrazabilidadPage() {
 const [entidad,setEntidad]=useState(''), [id,setId]=useState(''), [lote,setLote]=useState('');
 const [desde,setDesde]=useState(''), [hasta,setHasta]=useState(''), [datos,setDatos]=useState<any[]>([]);
 const [error,setError]=useState(''), [ocupado,setOcupado]=useState(false), [consultado,setConsultado]=useState(false);
 const consultar=async()=>{
  setOcupado(true);setError('');setConsultado(false);setDatos([]);
  try {
   const q=new URLSearchParams();if(entidad)q.set('entidad',entidad);if(id)q.set('id',id);if(lote)q.set('loteId',lote);
   if(desde)q.set('desde',new Date(desde).toISOString());if(hasta)q.set('hasta',new Date(hasta).toISOString());
   const todos:any[]=[];let pagina=1,total=0;
   do {q.set('pagina',String(pagina++));const r=await fetch(`${API_URL}/api/trazabilidad/tramos?${q}`);const d=await r.json();if(!r.ok||!d.success)throw new Error(d.message||'No se pudo consultar');total=d.total;todos.push(...d.data);} while(todos.length<total);
   // Los filtros son una cohorte por inicio. No se truncan intervalos al rango.
   setDatos(todos);setConsultado(true);
  }catch(e){setError(e instanceof Error?e.message:'Error');}finally{setOcupado(false);}
 };
 const grupos:Record<string,number[]>={};for(const d of datos)if(d.duracionSegundos!=null)(grupos[`${d.entidad}: ${d.etapa}`]??=[]).push(d.duracionSegundos/60);
 const exportar=()=>{
  const filas=[['id','entidad','entidad_id','lote_id','tanque_id','ciclo','etapa','inicio_UTC','fin_UTC','duracion_segundos'],...datos.map(d=>[d.id,d.entidad,d.entidad_id,d.lote_id,d.tanque_id,d.ciclo,d.etapa,d.inicio,d.fin,d.duracionSegundos])];
  const csv=filas.map(f=>f.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='tiempos_procesos.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <main className="max-w-6xl mx-auto p-6 space-y-5 text-slate-800 bg-white min-h-screen"><h1 className="text-2xl font-bold">Tiempos de procesos</h1><a href="/tanques" className="underline">Tanques</a> · <a href="/calidad" className="underline">Calidad</a>
 <p>Selecciona una cohorte por fecha de inicio. El límite final es exclusivo. Los tiempos abiertos y los registros históricos sin hora no entran en las estadísticas. Las fechas de captura se interpretan en la zona horaria de tu navegador; el CSV usa UTC.</p>
 <form onSubmit={e=>{e.preventDefault();void consultar();}} className="flex flex-wrap gap-3 items-end">
 <label>Entidad<select className="block border p-2" value={entidad} onChange={e=>setEntidad(e.target.value)}><option value="">Todas</option><option>MUESTRA</option><option>TANQUE</option></select></label>
 <label>ID entidad<input className="block border p-2 w-28" type="number" min="1" value={id} onChange={e=>setId(e.target.value)}/></label>
 <label>ID lote<input className="block border p-2 w-28" type="number" min="1" value={lote} onChange={e=>setLote(e.target.value)}/></label>
 <label>Inicio desde<input className="block border p-2" type="datetime-local" value={desde} onChange={e=>setDesde(e.target.value)}/></label>
 <label>Inicio antes de<input className="block border p-2" type="datetime-local" value={hasta} onChange={e=>setHasta(e.target.value)}/></label>
 <button disabled={ocupado} className="bg-blue-700 text-white rounded p-2">{ocupado?'Consultando…':'Consultar'}</button></form>
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 {consultado&&<><p>{datos.length} tramos · {datos.filter(d=>!d.fin).length} en curso. <button onClick={exportar} className="border rounded p-2">Descargar CSV</button></p>
 <div className="overflow-auto"><table className="w-full"><thead><tr>{['Etapa','Terminados','Promedio (min)','Mediana (min)','Máximo (min)'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{Object.entries(grupos).map(([g,v])=>{const a=[...v].sort((a,b)=>a-b),n=a.length;return <tr className="border-t" key={g}><td>{g}</td><td>{n}</td><td>{(a.reduce((s,v)=>s+v,0)/n).toFixed(2)}</td><td>{((a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2).toFixed(2)}</td><td>{a[n-1].toFixed(2)}</td></tr>})}</tbody></table></div>
 {!datos.length&&<p>No hay tramos registrados para estos filtros.</p>}</>}
 </main>;
}
