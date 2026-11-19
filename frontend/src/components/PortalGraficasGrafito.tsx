'use client';

import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, ChartColumn, CircleGauge, Info, PackageCheck } from 'lucide-react';

export type EtapaGrafito = 'SUCIO' | 'PROCESANDO' | 'LIBERADO';
export type PrensaGrafito = 'Fagor' | 'Forgemaster' | 'Polymaster';
export type AnilloVuelta = {
  etapa: EtapaGrafito;
  prensa: PrensaGrafito;
  maxVuelta: number | null;
  vueltasDetectadas: number[];
  kg: number;
  sinVueltaKg: number;
  limite: number;
  excedida: boolean;
};
export type GraficasGrafito = {
  unidad: 'Kilogramos';
  estadoActual: Array<{ clave: EtapaGrafito; etiqueta: string; kg: number }>;
  estadoActualPorPrensa: Array<{
    clave: EtapaGrafito; etiqueta: string; Fagor: number; Forgemaster: number;
    Polymaster: number; sinIdentificar: number; total: number;
  }>;
  acumulados: Array<{ clave: 'ENTRADAS' | 'LIBERADO'; etiqueta: string; kg: number }>;
  anillosVueltas: AnilloVuelta[];
  sinPrensaKg: Record<EtapaGrafito, number>;
  sinVueltaKg: Record<EtapaGrafito, number>;
  lotesConSaldoNegativo: number;
  alcance: {
    estadoActual: string;
    acumulados: string;
    nota: string;
  };
};

const PRENSAS: PrensaGrafito[] = ['Fagor', 'Forgemaster', 'Polymaster'];
const ETAPAS: Array<{ id: EtapaGrafito; titulo: string; descripcion: string }> = [
  { id: 'SUCIO', titulo: 'Material sucio', descripcion: 'Existencia pendiente de proceso' },
  { id: 'PROCESANDO', titulo: 'En producción', descripcion: 'Consumo asignado a lotes activos' },
  { id: 'LIBERADO', titulo: 'Material liberado', descripcion: 'Existencia con dictamen liberado' },
];
const COLORES: Record<PrensaGrafito, string> = {
  Fagor: '#2563eb',
  Forgemaster: '#16a34a',
  Polymaster: '#eab308',
};
const COLOR_EXCESO = '#dc2626';
const n = (valor: number, digitos = 0) => new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: digitos,
}).format(valor);

function IndicadorAnillos({ elementos, etapa }: {
  elementos: AnilloVuelta[];
  etapa: string;
}) {
  // Los radios más amplios dejan un hueco central real: los textos ya no invaden
  // el anillo interior incluso cuando el SVG se reduce en pantallas pequeñas.
  const centro = 140;
  const radios = [110, 84, 58];
  const ancho = 14;
  return <div className="flex w-full flex-col">
    <div className="flex w-full justify-center py-4">
      <svg className="h-auto w-full max-w-[264px] shrink-0" viewBox="0 0 280 280" role="img"
        aria-label={'Vueltas por prensa para ' + etapa + ': ' +
          elementos.map(e => e.prensa + ' ' + (e.maxVuelta ?? 'sin registro') + ' de 10').join(', ')}>
        {elementos.map((registro, i) => {
          const radio = radios[i];
          const perimetro = 2 * Math.PI * radio;
          const porcentaje = registro.maxVuelta == null ? 0 :
            Math.min(registro.maxVuelta / registro.limite, 1);
          const color = registro.excedida ? COLOR_EXCESO : COLORES[registro.prensa];
          return <g key={registro.prensa} transform={'rotate(-90 ' + centro + ' ' + centro + ')'}>
            <circle cx={centro} cy={centro} r={radio} fill="none" stroke="#e3ebe7" strokeWidth={ancho}/>
            <circle cx={centro} cy={centro} r={radio} fill="none"
              stroke={color} strokeWidth={ancho} strokeLinecap="round"
              strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - porcentaje)}/>
          </g>;
        })}
        <circle cx={centro} cy={centro} r={48} fill="#fcfefc"/>
        <text x={centro} y={centro - 22} textAnchor="middle" fontSize="10" fill="#64748b">Límite de</text>
        <text x={centro} y={centro + 11} textAnchor="middle" fontSize="28" fontWeight="700" fill="#163c30">10</text>
        <text x={centro} y={centro + 29} textAnchor="middle" fontSize="10" fill="#64748b">vueltas</text>
      </svg>
    </div>
    <div className="mt-2 w-full space-y-1.5" aria-label={'Detalle por prensa en ' + etapa}>
      {elementos.map(e => <div key={e.prensa}
        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5 rounded-lg bg-white px-2.5 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: e.excedida ? COLOR_EXCESO : COLORES[e.prensa] }}/>
          <span className="truncate">{e.prensa}</span>
        </span>
        <span className={'whitespace-nowrap font-semibold tabular-nums ' +
          (e.excedida ? 'text-red-700' : 'text-[#173e35]')}>
          {e.maxVuelta == null ? 'Sin dato' : e.maxVuelta + ' / 10'}
        </span>
        <span className="min-w-[72px] whitespace-nowrap text-right tabular-nums text-slate-500">
          {n(e.kg, 2)} kg
        </span>
      </div>)}
    </div>
  </div>;
}

export default function PortalGraficasGrafito({ graficas }: { graficas: GraficasGrafito }) {
  const porEtapa = useMemo(() => ETAPAS.map(e => ({
    ...e,
    anillos: PRENSAS.map(prensa => graficas.anillosVueltas.find(a => a.etapa === e.id && a.prensa === prensa)
      ?? {
        etapa: e.id, prensa, maxVuelta: null, vueltasDetectadas: [],
        kg: 0, sinVueltaKg: 0, limite: 10, excedida: false,
      }),
  })), [graficas]);
  const totalSinVuelta = Object.values(graficas.sinVueltaKg).reduce((a, b) => a + b, 0);
  const totalSinPrensa = Object.values(graficas.sinPrensaKg).reduce((a, b) => a + b, 0);
  const exceso = graficas.anillosVueltas.filter(a => a.excedida);
  const estadoColores = ['#d6a150', '#3176bb', '#16916f'];
  const desgloseEstado = graficas.estadoActualPorPrensa.map(dato => ({
    ...dato,
    eje: dato.clave === 'SUCIO' ? 'Sucio' :
      dato.clave === 'PROCESANDO' ? 'En proceso' : 'Liberado',
  }));
  const haySinPrensa = desgloseEstado.some(dato => dato.sinIdentificar > 0);
  const acColores = ['#3176bb', '#16916f'];
  return <section className="space-y-5" aria-label="Control de volumen y vueltas de grafito">
    <div>
      <h2 className="flex items-center gap-2 text-xl font-bold text-[#173e35]">
        <CircleGauge size={22} className="text-emerald-700"/> Control de inventario y vueltas
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Material de este cliente, expresado en kilogramos. La fotografía operativa
        incluye las existencias de apertura histórica; los acumulados se basan en movimientos físicos.
      </p>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="min-w-0 rounded-2xl border border-[#e1e9e2] bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-[#173e35]">
          <ChartColumn size={18} className="text-[#176f5b]"/> Estado actual por prensa
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Sucio en inventario, consumido en lotes activos y liberado disponible, separados por tipo de prensa.
        </p>
        <div className="mt-5 h-[305px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={desgloseEstado} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              barGap={3} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="#e8efea" strokeDasharray="3 3"/>
              <XAxis dataKey="eje" tick={{ fontSize: 11, fill: '#52655e' }}
                axisLine={false} tickLine={false} interval={0}/>
              <YAxis width={59} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => n(Number(v))}
                axisLine={false} tickLine={false}/>
              <Tooltip formatter={(value, name) => [n(Number(value), 2) + ' kg', name]}
                labelFormatter={label => 'Material ' + label}/>
              <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: 11 }}/>
              {PRENSAS.map(prensa => <Bar key={prensa} dataKey={prensa} name={prensa}
                fill={COLORES[prensa]} maxBarSize={25} radius={[4, 4, 0, 0]}/>)}
              {haySinPrensa && <Bar dataKey="sinIdentificar" name="Sin prensa" fill="#94a3b8"
                maxBarSize={25} radius={[4, 4, 0, 0]}/>}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {graficas.estadoActual.map((dato, i) => <div key={dato.clave}
            className="min-w-0 rounded-xl bg-[#f7faf7] px-2 py-3">
            <div className="text-[11px] font-semibold leading-4" style={{ color: estadoColores[i] }}>
              {dato.etiqueta}
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums">{n(dato.kg, 2)} kg</div>
          </div>)}
        </div>
      </article>
      <article className="rounded-2xl border border-[#e1e9e2] bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-[#173e35]">
          <PackageCheck size={18} className="text-[#176f5b]"/> Acumulado de entradas y liberaciones
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Entradas de recepción y generación de producto liberado durante el período indicado.
        </p>
        <div className="mt-6 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graficas.acumulados} margin={{ top: 12, right: 8, left: 8, bottom: 10 }}>
              <CartesianGrid vertical={false} stroke="#e8efea" strokeDasharray="3 3"/>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: '#52655e' }}
                axisLine={false} tickLine={false} interval={0}/>
              <YAxis width={58} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => n(Number(v))}
                axisLine={false} tickLine={false}/>
              <Tooltip formatter={value => n(Number(value), 2) + ' kg'}/>
              <Bar dataKey="kg" name="Kilogramos" maxBarSize={90} radius={[7, 7, 0, 0]}>
                {graficas.acumulados.map((dato, i) =>
                  <Cell key={dato.clave} fill={acColores[i]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          {graficas.acumulados.map((dato, i) => <div key={dato.clave} className="rounded-xl bg-[#f7faf7] p-2">
            <div className="text-xs font-semibold" style={{ color: acColores[i] }}>{dato.etiqueta}</div>
            <div className="mt-1 text-sm font-bold">{n(dato.kg, 2)} kg</div>
          </div>)}
        </div>
      </article>
    </div>
    <div className="rounded-2xl border border-[#e1e9e2] bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-semibold text-[#173e35]">
        <CircleGauge size={19} className="text-[#176f5b]"/> Anillos de vueltas por prensa
      </h3>
      <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
        Cada gráfico muestra tres anillos concéntricos: Fagor (azul), Forgemaster (verde) y Polymaster (amarillo).
        Cada anillo refleja la <strong>vuelta máxima registrada</strong> de material con masa en esa etapa.
        El máximo permitido es 10; si se registra la vuelta 11 o mayor, el anillo se vuelve rojo.
      </p>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {PRENSAS.map(prensa => <div key={prensa} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORES[prensa] }}/>
          {prensa}
        </div>)}
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_EXCESO }}/>
          Límite excedido
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {porEtapa.map(etapa => <article key={etapa.id} className="flex min-w-0 flex-col rounded-2xl border border-[#e6eee8] bg-[#fcfefc] p-4 sm:p-5">
          <div className="text-sm font-bold text-[#173e35]">{etapa.titulo}</div>
          <p className="mt-1 min-h-[30px] text-xs leading-5 text-slate-500">{etapa.descripcion}</p>
          <IndicadorAnillos elementos={etapa.anillos} etapa={etapa.titulo}/>
          <div className="mt-4 border-t border-[#e6eee8] pt-3 text-xs leading-5 text-slate-500">
            <p className="mb-1 font-semibold text-[#37564a]">Vueltas observadas</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {etapa.anillos.map(a => <span key={a.prensa}>
                {a.prensa}: {a.vueltasDetectadas.length ? a.vueltasDetectadas.join(', ') : '—'}
              </span>)}
            </div>
          </div>
        </article>)}
      </div>
      {(exceso.length > 0 || totalSinVuelta > 0 || totalSinPrensa > 0 ||
        graficas.lotesConSaldoNegativo > 0) &&
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          <div className="mb-1 flex items-center gap-2 font-bold">
            <AlertTriangle size={16}/> Avisos de trazabilidad
          </div>
          {exceso.length > 0 && <p>
            Superan las 10 vueltas: {exceso.map(a => a.prensa + ' (' + a.etapa.toLowerCase() +
              ', vuelta ' + a.maxVuelta + ')').join('; ')}.
          </p>}
          {totalSinVuelta > 0 && <p>
            {n(totalSinVuelta, 2)} kg en el reporte operativo no tienen número de vuelta;
            se muestran en los volúmenes, pero no avanzan ningún anillo.
          </p>}
          {totalSinPrensa > 0 && <p>{n(totalSinPrensa, 2)} kg no tienen prensa
            identificada; sí se incluyen en los volúmenes correspondientes.</p>}
          {graficas.lotesConSaldoNegativo > 0 &&
            <p>{graficas.lotesConSaldoNegativo} lote(s) presentan saldos negativos.
              Se requiere revisar sus movimientos antes de certificar un balance.</p>}
        </div>}
    </div>
    <div className="flex items-start gap-2 rounded-xl border border-[#dfe9e1] bg-white p-4 text-xs leading-6 text-slate-600">
      <Info size={17} className="mt-0.5 shrink-0 text-[#176f5b]"/>
      <p>{graficas.alcance.estadoActual} {graficas.alcance.acumulados} {graficas.alcance.nota}
        La vuelta de producto liberado es la registrada en su propio lote; no se incrementa
        ni se infiere automáticamente de una carga mezclada.</p>
    </div>
  </section>;
}
