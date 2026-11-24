'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle2, ClipboardList, Droplets, Factory, FileCheck2, Info, Leaf, PackageCheck, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pedir, sesionActual } from '@/utils/api';
import PortalGraficasGrafito, { type GraficasGrafito } from '@/components/PortalGraficasGrafito';
import PortalEntregasSemanales from '@/components/PortalEntregasSemanales';
import PortalPlanTransportes from '@/components/PortalPlanTransportes';

type Lote = {
  recepcion: string; lote: string; fecha: string; prensa: string; vuelta: string | null;
  recibido: number; procesado: number; saldo: number; humedad: number | null;
  muestra: string | null; origenHumedad: string | null; masaConHumedad: number | null; lotesProduccion: number[]; unidad: string;
};
type Prensa = { prensa: string; recibido: number; procesado: number; saldo: number; liberado: number };
type Unidad = {
  unidad: string; recibido: number; procesado: number; liberado: number; liberadoSinVinculo: number;
  entregado: number; saldoRecepciones: number; humedadPonderada: number | null;
  aguaEstimadaKg: number | null; lotesMuestreados: number; lotesRecibidos: number; masaConHumedad: number;
  rendimiento: number | null; prensas: Prensa[]; lotes: Lote[];
};
type Reporte = {
  graficas: GraficasGrafito;
  inventarioActual: Array<{ unidad: string; condicion: string; prensa: string; vuelta: string | null; saldo: number; lotes: number }>;
  cliente: { id: number; nombre: string };
  periodo: { descripcion: string };
  unidades: Unidad[];
  documentos: { manifiestos: number; resguardados: number };
  trazabilidad: { recepcionesConfirmadas: number; lotesSinEntrada: number; nota: string };
};
type Cliente = { id_Persona: number; nombre: string };
type Sesion = { area: string; personaId: number; token: string };
const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits }).format(n);
const pct = (n: number | null) => n == null ? 'Sin análisis' : fmt(n, 2) + ' %';
const bonita = (iso: string) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
function Tarjeta({ titulo, valor, detalle, color, icono }: {
  titulo: string; valor: string; detalle: string; color: string; icono: React.ReactNode;
}) {
  return <article className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-600">{titulo}</span>
      <span className="rounded-xl p-2" style={{ backgroundColor: color + '16', color }}>{icono}</span>
    </div>
    <div className="text-2xl font-bold tracking-tight text-[#183f34]">{valor}</div>
    <p className="mt-2 text-xs leading-5 text-slate-500">{detalle}</p>
  </article>;
}
export default function PortalClientePage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [unidad, setUnidad] = useState('');
  const [cargando, setCargando] = useState(false);
  const [inicializando, setInicializando] = useState(true);
  const [error, setError] = useState('');
  const esProduccion = sesion?.area === 'produccion';
  const actual = useMemo(() => reporte?.unidades.find(u => u.unidad === unidad) || reporte?.unidades[0] || null, [reporte, unidad]);
  const consultar = useCallback(async (id: string, inicio: string, fin: string) => {
    if (!id) return;
    setError(''); setCargando(true);
    try {
      if (inicio && fin && inicio > fin) throw new Error('La fecha inicial no puede ser posterior a la final.');
      const params = new URLSearchParams();
      if (sesionActual()?.area === 'produccion') params.set('clienteId', id);
      if (inicio) params.set('desde', inicio);
      if (fin) params.set('hasta', fin);
      const data = await pedir('/api/portal-cliente/resumen?' + params.toString(), undefined, 'GET') as Reporte;
      setReporte(data);
      setUnidad(prev => data.unidades.some(u => u.unidad === prev) ? prev : data.unidades[0]?.unidad || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error consultando el reporte.');
      setReporte(null);
    } finally { setCargando(false); }
  }, []);
  useEffect(() => {
    const s = sesionActual() as Sesion | null;
    if (!s?.token || !['produccion', 'cliente'].includes(s.area)) { router.replace('/'); return; }
    setSesion(s);
    if (s.area === 'cliente') {
      void consultar(String(s.personaId), '', '').finally(() => setInicializando(false));
      return;
    }
    pedir('/api/portal-cliente/clientes', undefined, 'GET')
      .then((d: { data: Cliente[] }) => {
        setClientes(d.data || []);
        if (d.data?.length) {
          const id = String(d.data[0].id_Persona);
          setClienteId(id);
          return consultar(id, '', '');
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'No fue posible recuperar los clientes.'))
      .finally(() => setInicializando(false));
  }, [router, consultar]);
  const valor = (num: number) => fmt(num, 2) + ' ' + actual?.unidad;
  const salir = () => {
    localStorage.removeItem('sesion');
    window.dispatchEvent(new Event('sesion-cambiada'));
    router.replace('/');
  };
  return <main className="min-h-screen bg-[#f6f9f6] text-[#18372f]">
    <div className="bg-[#173e35] px-5 py-9 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200"><Leaf size={18}/> US Technologies · Close the Loop</div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-2">{esProduccion ? 'Vista de Producción' : 'Portal privado del cliente'}</span>
            {esProduccion && <Link className="underline underline-offset-4" href="/tanques">Volver a Producción</Link>}
            <button onClick={salir} className="rounded-lg border border-white/25 px-3 py-2 hover:bg-white/10">Cerrar sesión</button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">Trazabilidad y regeneración de materiales</p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">Economía circular, con evidencia.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">Conoce cuánto material se recibe, cuánto se procesa y qué volumen de esa misma materia prima se libera.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4">
            <ShieldCheck size={24} className="text-emerald-200" />
            <div><p className="text-[11px] uppercase tracking-wider text-emerald-100">Cliente</p><p className="text-sm font-semibold">{reporte?.cliente.nombre || 'Seleccionar cliente'}</p></div>
          </div>
        </div>
      </div>
    </div>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-7 md:px-8">
      <section className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm">
        <form onSubmit={e => { e.preventDefault(); void consultar(esProduccion ? clienteId : String(sesion?.personaId || ''), desde, hasta); }} className="flex flex-wrap items-end gap-3">
          {esProduccion && <label className="min-w-[190px] flex-1 text-xs font-semibold text-slate-600">Cliente
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              {clientes.map(c => <option key={c.id_Persona} value={c.id_Persona}>{c.nombre}</option>)}
            </select>
          </label>}
          <label className="min-w-[160px] flex-1 text-xs font-semibold text-slate-600">Recepciones desde
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/>
          </label>
          <label className="min-w-[160px] flex-1 text-xs font-semibold text-slate-600">Hasta
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/>
          </label>
          <button type="submit" disabled={cargando || (esProduccion && !clienteId)} className="flex items-center justify-center gap-2 rounded-xl bg-[#13735c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#105b4a] disabled:opacity-50">
            <RefreshCw size={17} className={cargando ? 'animate-spin' : ''}/>{cargando ? 'Consultando...' : 'Actualizar reporte'}
          </button>
        </form>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><Info size={15} className="shrink-0"/> El filtro selecciona recepciones por fecha y considera sus consumos y producción asociados incluso después de ese período.</p>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {inicializando && <p className="py-10 text-center text-slate-500">Consultando registros...</p>}
      {!inicializando && !cargando && !reporte && !error && <p className="rounded-xl bg-white p-8 text-center text-slate-500">Selecciona un cliente para comenzar.</p>}
      {reporte && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Balance de materiales</h2><p className="mt-1 text-xs text-slate-500">{reporte.trazabilidad.recepcionesConfirmadas} recepción(es) con checklist completo</p></div>
          <div className="flex flex-wrap gap-2">
            {reporte.unidades.map(u => <button key={u.unidad} type="button" onClick={() => setUnidad(u.unidad)}
              className={'rounded-full px-4 py-2 text-xs font-semibold ' + (actual?.unidad === u.unidad ? 'bg-[#173e35] text-white' : 'border border-slate-200 bg-white text-slate-600')}>{u.unidad}</button>)}
          </div>
        </div>
        {reporte.graficas && <PortalGraficasGrafito graficas={reporte.graficas}/>}
        <PortalEntregasSemanales key={reporte.cliente.id} clienteId={reporte.cliente.id} esProduccion={esProduccion}/>
        <PortalPlanTransportes key={reporte.cliente.id} clienteId={reporte.cliente.id}/>
        <section className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">Existencias actuales del cliente</h3>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                Inventario físico registrado, incluidas aperturas históricas. Es distinto al balance de recepciones del período
                y no demuestra por sí mismo qué volumen se procesó o entregó.
              </p>
            </div>
            <span className="rounded-full bg-[#e8f5ed] px-3 py-1.5 text-xs font-semibold text-[#176f5b]">Fotografía actual</span>
          </div>
          {(reporte.inventarioActual || []).length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-[#f1f7f3] text-slate-600">
                  <tr>{['Condición', 'Prensa', 'Vuelta', 'Existencia', 'Unidad', 'Lotes'].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[#e8eee9]">
                  {reporte.inventarioActual.map((stock, i) => <tr key={i}>
                    <td className="px-4 py-3 font-medium">{stock.condicion === 'REGENERADO' ? 'Procesado / regenerado' : stock.condicion === 'SUCIO' ? 'Pendiente de regenerar' : stock.condicion.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3">{stock.prensa}</td>
                    <td className="px-4 py-3">{stock.vuelta ?? 'Sin registrar'}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{fmt(stock.saldo, 2)}</td>
                    <td className="px-4 py-3">{stock.unidad}</td>
                    <td className="px-4 py-3">{stock.lotes}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">No hay existencias positivas de grafito registradas para este cliente.</p>}
        </section>
        {!actual && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          No hay lotes de recepción con entradas acreditadas para esta selección. No se contabilizan inventarios de apertura histórica como nuevas recepciones.
        </div>}
        {actual && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta titulo="Material recibido" valor={valor(actual.recibido)} detalle={String(actual.lotesRecibidos) + ' lote(s) con entrada documentada'} icono={<PackageCheck size={20}/>} color="#3176bb"/>
            <Tarjeta titulo="Humedad inicial registrada" valor={pct(actual.humedadPonderada)} detalle={String(actual.lotesMuestreados) + ' de ' + String(actual.lotesRecibidos) + ' lotes con medición; ' + fmt(actual.masaConHumedad, 2) + ' ' + actual.unidad + ' con respaldo (recepción o producción)'} icono={<Droplets size={20}/>} color="#348eaa"/>
            <Tarjeta titulo="Material procesado" valor={valor(actual.procesado)} detalle="Consumo de los mismos lotes recibidos" icono={<Factory size={20}/>} color="#c88e37"/>
            <Tarjeta titulo="Producto liberado vinculado" valor={valor(actual.liberado)} detalle="Solo producción liberada con origen documentado" icono={<CheckCircle2 size={20}/>} color="#12836e"/>
          </section>
          <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <article className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm md:p-6">
              <h3 className="flex items-center gap-2 font-semibold"><BarChart3 size={20} className="text-[#13735c]"/> Por tipo de prensa</h3>
              <p className="mt-1 text-xs text-slate-500">Material recibido, consumido y liberado (solo trazabilidad confirmada)</p>
              {actual.prensas.length ? <div className="mt-6 h-[285px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actual.prensas} barGap={3}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5ece7"/>
                    <XAxis dataKey="prensa" axisLine={false} tickLine={false} tick={{ fontSize: 11 }}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={n => fmt(Number(n))}/>
                    <Tooltip formatter={v => fmt(Number(v), 2) + ' ' + actual.unidad}/>
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    <Bar dataKey="recibido" name="Recibido" fill="#3176bb" radius={[3,3,0,0]}/>
                    <Bar dataKey="procesado" name="Procesado" fill="#e6a04b" radius={[3,3,0,0]}/>
                    <Bar dataKey="liberado" name="Liberado" fill="#12836e" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div> : <div className="flex h-64 items-center justify-center text-slate-500">No hay cantidades para graficar.</div>}
            </article>
            <article className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm md:p-6">
              <h3 className="font-semibold">Indicadores de recuperación</h3>
              <p className="mt-1 text-xs text-slate-500">Balance acumulado de la cohorte de lotes recibidos</p>
              <div className="mt-7 space-y-6">
                <div><div className="mb-2 flex justify-between text-xs"><span>Fracción recibida que se procesa</span><strong>{actual.recibido ? fmt(actual.procesado / actual.recibido * 100, 2) + ' %' : '—'}</strong></div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#e6a04b]" style={{ width: String(Math.min(100, Math.max(0, actual.recibido ? actual.procesado / actual.recibido * 100 : 0))) + '%' }}/></div></div>
                <div><div className="mb-2 flex justify-between text-xs"><span>Rendimiento liberado / procesado</span><strong>{actual.rendimiento == null ? 'No calculable' : fmt(actual.rendimiento, 2) + ' %'}</strong></div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#12836e]" style={{ width: String(Math.min(100, Math.max(0, actual.rendimiento ?? 0))) + '%' }}/></div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f6f9f6] p-3"><p className="text-xs text-slate-500">Saldo de recepciones</p><p className="mt-2 text-lg font-bold">{valor(actual.saldoRecepciones)}</p></div>
                  <div className="rounded-xl bg-[#f6f9f6] p-3"><p className="text-xs text-slate-500">Liberado entregado</p><p className="mt-2 text-lg font-bold">{valor(actual.entregado)}</p></div>
                </div>
                {actual.aguaEstimadaKg != null && <p className="rounded-lg bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                  Agua estimada únicamente en masa con muestra inicial: <strong>{fmt(actual.aguaEstimadaKg, 2)} kg</strong>. No equivale al agua efectivamente evaporada.
                </p>}
              </div>
            </article>
          </section>
          <section className="grid gap-3 md:grid-cols-3">
            <Tarjeta titulo="Manifiestos del cliente" valor={fmt(reporte.documentos.manifiestos)} detalle={String(reporte.documentos.resguardados) + ' archivo(s) resguardados; total histórico'} color="#13735c" icono={<FileCheck2 size={20}/>}/>
            <Tarjeta titulo="Recepciones confirmadas" valor={fmt(reporte.trazabilidad.recepcionesConfirmadas)} detalle="Checklist completo y confirmación registrada" color="#13735c" icono={<ClipboardList size={20}/>}/>
            <Tarjeta titulo="Liberación sin vínculo" valor={valor(actual.liberadoSinVinculo)} detalle="No atribuida a las recepciones seleccionadas" color="#a27643" icono={<Info size={20}/>}/>
          </section>
          <section className="overflow-hidden rounded-2xl border border-[#e0e8e0] bg-white shadow-sm">
            <div className="p-5"><h3 className="font-semibold">Evidencia por lote de recepción</h3><p className="mt-1 text-xs text-slate-500">Cantidades trazadas, saldo de inventario y resultado del laboratorio inicial.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-[#f1f7f3] text-slate-600"><tr>{['Fecha','Recepción','Lote inventario','Prensa','Vuelta','Recibido','Procesado','Saldo','Humedad medida','Origen del análisis'].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#e8eee9]">
                  {actual.lotes.map(l => <tr key={l.lote}>
                    <td className="px-4 py-3">{bonita(l.fecha)}</td>
                    <td className="px-4 py-3 font-medium">{l.recepcion}</td>
                    <td className="px-4 py-3">{l.lote}</td><td className="px-4 py-3">{l.prensa}</td><td className="px-4 py-3">{l.vuelta ?? 'Sin registrar'}</td>
                    <td className="px-4 py-3">{fmt(l.recibido, 2)}</td><td className="px-4 py-3">{fmt(l.procesado, 2)}</td>
                    <td className="px-4 py-3">{fmt(l.saldo, 2)}</td>
                    <td className="px-4 py-3">{l.humedad == null ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-900">Sin análisis</span> : <span title={'Muestra ' + l.muestra} className="font-semibold text-[#13735c]">{pct(l.humedad)}</span>}</td>
                    <td className="px-4 py-3">{l.origenHumedad === 'INFERIDA_PRODUCCION' ?
                      <span title={'LP: ' + l.lotesProduccion.join(', ') + ' · Muestra(s): ' + l.muestra}>Producción · {fmt(l.masaConHumedad)} {l.unidad} muestreados</span> :
                      l.origenHumedad === 'DIRECTA_RECEPCION' ? <span>Recepción · muestra directa</span> : '—'}</td>
                  </tr>)}
                  {!actual.lotes.length && <tr><td colSpan={10} className="p-8 text-center text-slate-500">No hay lotes de recepción acreditados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          {(reporte.trazabilidad.lotesSinEntrada > 0 || actual.liberadoSinVinculo > 0 || actual.lotesMuestreados < actual.lotesRecibidos) &&
            <aside className="rounded-xl border border-amber-200 bg-[#fffaf0] p-5 text-xs leading-6 text-amber-950">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert size={17}/> Pendiente de documentación o conciliación</h3>
              {reporte.trazabilidad.lotesSinEntrada > 0 && <p>{reporte.trazabilidad.lotesSinEntrada} lotes de recepción sin entrada de inventario.</p>}
              {actual.lotesMuestreados < actual.lotesRecibidos && <p>{actual.lotesRecibidos - actual.lotesMuestreados} lotes recibidos sin muestra inicial asociada.</p>}
              {actual.liberadoSinVinculo > 0 && <p>Hay producción liberada del cliente sin un vínculo comprobable con esta cohorte; se informa por separado.</p>}
            </aside>}
        </>}
        <footer className="flex items-start gap-2 rounded-xl border border-[#dce7de] bg-white p-5 text-xs leading-6 text-slate-600">
          <Info className="mt-0.5 shrink-0 text-[#13735c]" size={17}/>
          <p><strong>Criterio de cálculo.</strong> {reporte.periodo.descripcion} La humedad es un promedio ponderado sobre la masa respaldada por análisis. Si la muestra inicial se tomó en producción, se atribuye únicamente al material consumido por ese LP cuando existe un solo lote origen, y no se presenta como humedad medida al llegar. Las aperturas históricas y los procesos sin vínculo no se suman al rendimiento. La planificación del Excel GKN se toma como referencia de diseño, no como registros transaccionales.</p>
        </footer>
      </>}
    </div>
  </main>;
}
