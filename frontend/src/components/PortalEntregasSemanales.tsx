'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, ChartColumn, Info, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { pedir } from '@/utils/api';

type Prensa = 'Fagor' | 'Forgemaster' | 'Polymaster';
type ResumenPrensas = Record<Prensa | 'sinIdentificar', number> & { total: number };
type SemanaEntrega = ResumenPrensas & { semana: number; etiqueta: string; inicio: string; fin: string };
type RespuestaSemanal = {
  success: boolean;
  anio: number;
  anioActual: number;
  semanaActual: number;
  numeroSemanas: number;
  zonaHoraria: string;
  unidad: string;
  semanas: SemanaEntrega[];
  anterior: SemanaEntrega & { anio: number };
  acumuladoAnual: ResumenPrensas;
  movimientosAnuales: number;
  fuente: string;
  nota: string;
};

const PRENSAS: Prensa[] = ['Fagor', 'Forgemaster', 'Polymaster'];
const COLORES: Record<Prensa, string> = { Fagor: '#2563eb', Forgemaster: '#16a34a', Polymaster: '#eab308' };
const FORMATO = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const fmt = (n: number) => FORMATO.format(n);
const fecha = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
  day: 'numeric', month: 'short',
});

function TotalesPrensas({ totales }: { totales: ResumenPrensas }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {PRENSAS.map(prensa => <div key={prensa} className="min-w-0 rounded-xl bg-[#f4f8f5] p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORES[prensa] }}/>
        {prensa}
      </div>
      <p className="mt-2 text-base font-bold tabular-nums text-[#173e35]">{fmt(totales[prensa])} kg</p>
    </div>)}
    <div className="min-w-0 rounded-xl bg-[#e8f5ed] p-3">
      <p className="text-[11px] font-semibold text-[#176f5b]">Total entregado</p>
      <p className="mt-2 text-base font-bold tabular-nums text-[#173e35]">{fmt(totales.total)} kg</p>
    </div>
  </div>;
}

export default function PortalEntregasSemanales({ clienteId, esProduccion }: {
  clienteId: number; esProduccion: boolean;
}) {
  const [anioElegido, setAnioElegido] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [datos, setDatos] = useState<RespuestaSemanal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    const parametros = new URLSearchParams();
    if (esProduccion) parametros.set('clienteId', String(clienteId));
    if (anioElegido != null) parametros.set('anio', String(anioElegido));
    setCargando(true);
    setError('');
    void pedir('/api/portal-cliente/entregas-semanales?' + parametros.toString(), undefined, 'GET')
      .then(res => {
        if (!activo) return;
        const info = res as RespuestaSemanal;
        setDatos(info);
        setSeleccion(prev => prev != null && prev >= 1 && prev <= info.numeroSemanas ? prev :
          info.anio === info.anterior.anio ? info.anterior.semana :
          info.anio === info.anioActual ? info.semanaActual : info.numeroSemanas);
      })
      .catch(e => {
        if (!activo) return;
        setDatos(null);
        setError(e instanceof Error ? e.message : 'No se pudo consultar el historial de entregas.');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [anioElegido, clienteId, esProduccion]);

  const semanaElegida = useMemo(() => datos?.semanas.find(s => s.semana === seleccion), [datos, seleccion]);
  const anios = useMemo(() => {
    const actual = datos?.anioActual ?? new Date().getFullYear();
    return Array.from({ length: Math.max(1, actual - 2019) }, (_, i) => actual - i);
  }, [datos?.anioActual]);

  return <section className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm md:p-6"
    aria-labelledby="entregas-semana-titulo">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="entregas-semana-titulo" className="flex items-center gap-2 text-lg font-bold text-[#173e35]">
          <Truck size={21} className="text-[#13735c]"/> Resumen semanal de entregas por prensa
        </h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          Entregas efectivamente registradas en inventario. Semanas ISO de lunes a domingo, con fechas en Ciudad de México.
          Se distinguen de las liberaciones acumuladas y de los camiones simulados.
        </p>
      </div>
      <label className="text-xs font-semibold text-slate-600">
        Año de las entregas
        <select value={anioElegido ?? datos?.anio ?? ''} disabled={!datos || cargando}
          onChange={e => { setAnioElegido(Number(e.target.value)); setSeleccion(null); }}
          className="mt-1 block min-w-[120px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#173e35]">
          {anios.map(anio => <option key={anio} value={anio}>{anio}</option>)}
        </select>
      </label>
    </div>
    {cargando && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-slate-600">
      <RefreshCw size={16} className="animate-spin"/> Consultando las entregas...
    </p>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {datos && <>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <article className="min-w-0 rounded-xl border border-[#e2ece5] bg-[#fcfefc] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-bold text-[#173e35]">
              <CalendarDays size={17} className="text-[#176f5b]"/> Semana anterior
            </h4>
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#176f5b]">
              {datos.anterior.etiqueta} · {datos.anterior.anio}
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            {fecha(datos.anterior.inicio)} – {fecha(datos.anterior.fin)} · Semana completa anterior a la actual
          </p>
          <TotalesPrensas totales={datos.anterior}/>
          {datos.anterior.sinIdentificar > 0 && <p className="mt-2 text-xs text-amber-700">
            {fmt(datos.anterior.sinIdentificar)} kg sin prensa identificada.
          </p>}
        </article>
        <article className="min-w-0 rounded-xl border border-[#e2ece5] bg-[#fcfefc] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-bold text-[#173e35]">
              <PackageCheck size={17} className="text-[#176f5b]"/> Acumulado anual
            </h4>
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#176f5b]">
              {datos.anio} · {datos.numeroSemanas} semanas
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Del {fecha(datos.semanas[0].inicio)} al {fecha(datos.semanas[datos.semanas.length - 1].fin)}
          </p>
          <TotalesPrensas totales={datos.acumuladoAnual}/>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            {datos.movimientosAnuales} movimiento(s) de entrega válida.
            {datos.acumuladoAnual.sinIdentificar > 0 &&
              ' ' + fmt(datos.acumuladoAnual.sinIdentificar) + ' kg sin prensa identificada.'}
          </p>
        </article>
      </div>
      <div className="mt-5 min-w-0 rounded-xl border border-[#e2ece5] bg-[#fcfefc] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-[#173e35]">
              <ChartColumn size={17} className="text-[#176f5b]"/> Entregas semana a semana · {datos.anio}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Se muestran todas las semanas, incluso las que no tienen entregas.
              Desliza horizontalmente para consultar el año completo.
            </p>
          </div>
          <label className="text-xs font-semibold text-slate-600">
            Consultar semana
            <select value={seleccion ?? ''} onChange={e => setSeleccion(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
              {datos.semanas.map(semana => <option key={semana.semana} value={semana.semana}>
                {semana.etiqueta} · {fecha(semana.inicio)} – {fecha(semana.fin)}
              </option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 w-full overflow-x-auto pb-3" tabIndex={0}
          aria-label={'Gráfica desplazable con todas las semanas de ' + datos.anio}>
          <div style={{ width: Math.max(920, datos.numeroSemanas * 44), height: 285 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.semanas} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                barGap={1} barCategoryGap="17%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5ece7"/>
                <XAxis dataKey="etiqueta" interval={0} axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b' }}/>
                <YAxis width={66} axisLine={false} tickLine={false} tick={{ fontSize: 10 }}
                  tickFormatter={v => fmt(Number(v))}/>
                <Tooltip labelFormatter={(_, items) => {
                    const fila = items?.[0]?.payload as SemanaEntrega | undefined;
                    return fila ? 'Semana ' + fila.etiqueta + ' · ' +
                      fecha(fila.inicio) + ' – ' + fecha(fila.fin) : 'Entregas';
                  }}
                  formatter={(v, name) => [fmt(Number(v)) + ' kg', name]}/>
                <Legend verticalAlign="top" height={35} wrapperStyle={{ fontSize: 11 }}/>
                {PRENSAS.map(prensa => <Bar key={prensa} dataKey={prensa} name={prensa}
                  fill={COLORES[prensa]} maxBarSize={12} radius={[2,2,0,0]}/>)}
                <Bar dataKey="sinIdentificar" name="Sin prensa" fill="#94a3b8"
                  maxBarSize={12} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {semanaElegida && <div className="mt-2 rounded-xl border border-[#dce8df] bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#173e35]">
              Semana {semanaElegida.etiqueta}
            </p>
            <span className="text-xs text-slate-500">
              {fecha(semanaElegida.inicio)} – {fecha(semanaElegida.fin)}
            </span>
          </div>
          <TotalesPrensas totales={semanaElegida}/>
          {semanaElegida.sinIdentificar > 0 && <p className="mt-2 text-xs text-amber-700">
            {fmt(semanaElegida.sinIdentificar)} kg sin clasificación por prensa.
          </p>}
        </div>}
        {datos.movimientosAnuales === 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          No hay entregas de grafito regenerado acreditadas en los movimientos del año {datos.anio}.
          Esto no significa que no hayan ocurrido físicamente: aún podrían faltar registros de Logística.
          No se consideran como entregas los ajustes administrativos del inventario histórico.
        </div>}
      </div>
      <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
        <Info size={15} className="mt-0.5 shrink-0"/>
        {datos.nota} La semana anterior se calcula respecto a la fecha actual, incluso al consultar otro año.
      </p>
    </>}
  </section>;
}
