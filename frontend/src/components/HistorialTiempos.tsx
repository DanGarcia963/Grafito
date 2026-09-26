'use client';
import { useEffect, useState } from 'react';
import { API_URL, apiFetch as fetch } from '@/utils/api';
import { useSocket } from '@/context/SocketContext';
export default function HistorialTiempos({ entidad, id, onClose }: { entidad: 'MUESTRA' | 'TANQUE'; id: number; onClose: () => void }) {
 const socket = useSocket();
 const [tramos, setTramos] = useState<any[]>([]), [eventos, setEventos] = useState<any[]>([]), [error, setError] = useState('');
 useEffect(() => {
   const abort = new AbortController();
   const cargar = async () => {
    try {
     const respuestas = await Promise.all(['tramos', 'eventos'].map(tipo => fetch(`${API_URL}/api/trazabilidad/${tipo}?entidad=${entidad}&id=${id}`, { signal: abort.signal })));
     if (respuestas.some(r => !r.ok)) throw new Error('No se pudo cargar el historial');
     const [t,e] = await Promise.all(respuestas.map(r => r.json()));
     setTramos(t.data); setEventos(e.data); setError('');
    } catch(e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Error'); }
   };
   void cargar(); socket?.on('TRAZABILIDAD_ACTUALIZADA', cargar); socket?.on('connect', cargar);
   return () => { abort.abort(); socket?.off('TRAZABILIDAD_ACTUALIZADA', cargar); socket?.off('connect', cargar); };
 }, [entidad, id, socket]);
 const fecha = (v: string | null) => v ? new Date(v).toLocaleString('es-MX') : 'En curso';
 return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Historial de tiempos">
  <div className="bg-white text-slate-800 rounded-xl p-5 w-full max-w-5xl max-h-[90vh] overflow-auto">
   <div className="flex justify-between gap-3"><h2 className="font-bold">Historial {entidad} #{id}</h2><button type="button" onClick={onClose} className="border rounded px-3">Cerrar</button></div>
   {error && <p role="alert">{error}</p>}
   <p className="text-xs my-3">Últimos 200 tramos y 500 eventos. Duraciones en minutos; etapas abiertas no se cuentan como terminadas. <a href="/trazabilidad" className="underline">Exportar historial completo de tramos</a></p>
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Ciclo','Etapa','Inicio','Fin','Minutos'].map(t=><th key={t} className="p-2 text-left">{t}</th>)}</tr></thead><tbody>{tramos.map(t=><tr key={t.id} className="border-t"><td className="p-2">{t.ciclo}</td><td>{t.etapa}</td><td>{fecha(t.inicio)}</td><td>{fecha(t.fin)}</td><td>{t.duracionSegundos == null ? 'En curso' : (t.duracionSegundos/60).toFixed(2)}</td></tr>)}</tbody></table></div>
   {!tramos.length && <p className="p-3">Sin tiempos registrados. No se reconstruyen horas históricas desconocidas.</p>}
   <h3 className="font-bold mt-5">Eventos</h3>{eventos.map(e=><div key={e.id} className="border-t py-2 text-xs break-words">{fecha(e.fecha)} · Ciclo {e.ciclo} · {e.accion}<p>{e.detalle}</p></div>)}
  </div>
 </div>;
}
