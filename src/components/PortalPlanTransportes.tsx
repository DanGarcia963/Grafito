'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, Minus, Package, Plus, Trash2, Truck } from 'lucide-react';

type TipoTransporte = 'TORTON' | 'TRAILER';
type Vehiculo = { id: string; tipo: TipoTransporte; contenedores: number };

const CAPACIDAD: Record<TipoTransporte, number> = {
  TORTON: 12,
  TRAILER: 22,
};
const ETIQUETAS: Record<TipoTransporte, string> = {
  TORTON: 'Tortón',
  TRAILER: 'Tráiler',
};
const MAX_VEHICULOS = 40;
const STORAGE_VERSION = 'grafito:portal-cliente:transporte-visual:v1';

function enteroEnRango(valor: unknown, maximo: number): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.min(maximo, Math.max(0, Math.trunc(numero))) : 0;
}

function validarVehiculos(datos: unknown): Vehiculo[] {
  if (!Array.isArray(datos)) return [];
  const ids = new Set<string>();
  const resultado: Vehiculo[] = [];
  for (const registro of datos.slice(0, MAX_VEHICULOS)) {
    if (!registro || typeof registro !== 'object' || Array.isArray(registro)) continue;
    const item = registro as Record<string, unknown>;
    if (item.tipo !== 'TORTON' && item.tipo !== 'TRAILER') continue;
    const id = typeof item.id === 'string' && item.id.length <= 120 ? item.id : '';
    if (!id || ids.has(id)) continue;
    ids.add(id);
    resultado.push({
      id,
      tipo: item.tipo,
      contenedores: enteroEnRango(item.contenedores, CAPACIDAD[item.tipo]),
    });
  }
  return resultado;
}

function CamionVisual({ tipo, contenedores }: { tipo: TipoTransporte; contenedores: number }) {
  const esTrailer = tipo === 'TRAILER';
  const capacidad = CAPACIDAD[tipo];
  const columnas = capacidad / 2;
  const cajaX = esTrailer ? 24 : 64;
  const cajaY = 56;
  const cajaAncho = esTrailer ? 464 : 366;
  const cajaAlto = 122;
  const cabinaX = esTrailer ? 510 : 449;
  const separacion = esTrailer ? 3.5 : 5;
  const margen = 9;
  const anchoContenedor = (cajaAncho - margen * 2 - (columnas - 1) * separacion) / columnas;
  const altoContenedor = (cajaAlto - margen * 2 - separacion) / 2;
  const cargados = enteroEnRango(contenedores, capacidad);
  const color = esTrailer ? '#0f766e' : '#2563eb';

  return <svg className="w-full max-w-[650px]" viewBox="0 0 680 244"
    role="img" aria-label={ETIQUETAS[tipo] + ': ' + cargados + ' de ' + capacidad + ' contenedores representados'}>
    <path d="M 23 223 H 655" stroke="#dbe7df" strokeWidth="3" strokeLinecap="round"/>
    <path d={'M ' + (cajaX + 8) + ' 187 H 642'} stroke="#64748b" strokeWidth="11" strokeLinecap="round"/>
    <rect x={cajaX} y={cajaY} width={cajaAncho} height={cajaAlto} rx="8"
      fill="#f8fafc" stroke="#64748b" strokeWidth="3"/>
    <rect x={cajaX + 3} y={cajaY + 3} width={cajaAncho - 6} height="13" rx="4"
      fill={esTrailer ? '#ccfbf1' : '#dbeafe'}/>
    {Array.from({ length: capacidad }, (_, indice) => {
      const fila = 1 - Math.floor(indice / columnas);
      const columna = indice % columnas;
      const x = cajaX + margen + columna * (anchoContenedor + separacion);
      const y = cajaY + margen + fila * (altoContenedor + separacion);
      const lleno = indice < cargados;
      return <g key={indice}>
        <rect x={x} y={y} width={anchoContenedor} height={altoContenedor} rx="3"
          fill={lleno ? (esTrailer ? '#99f6e4' : '#93c5fd') : '#eef2f5'}
          stroke={lleno ? color : '#cbd5e1'} strokeWidth={lleno ? 1.7 : 1.1}
          style={{ transition: 'fill 260ms ease, stroke 260ms ease' }}/>
        {lleno && <>
          <path d={'M ' + (x + anchoContenedor * 0.33) + ' ' + (y + 5) +
            ' V ' + (y + altoContenedor - 5) +
            ' M ' + (x + anchoContenedor * 0.66) + ' ' + (y + 5) +
            ' V ' + (y + altoContenedor - 5)}
            fill="none" stroke={color} strokeWidth="1.2" opacity=".5"/>
          <rect x={x + 4} y={y + 4} width={Math.max(3, anchoContenedor - 8)} height="4" rx="1.5"
            fill="#fff" opacity=".42"/>
        </>}
      </g>;
    })}
    <path d={'M ' + cabinaX + ' 185 V 111 Q ' + cabinaX + ' 100 ' + (cabinaX + 12) +
      ' 100 H ' + (cabinaX + 95) + ' L ' + (cabinaX + 139) +
      ' 147 V 185 Z'} fill={esTrailer ? '#115e59' : '#1d4ed8'}
      stroke={esTrailer ? '#134e4a' : '#1e40af'} strokeWidth="3" strokeLinejoin="round"/>
    <path d={'M ' + (cabinaX + 17) + ' 112 H ' + (cabinaX + 85) +
      ' L ' + (cabinaX + 111) + ' 141 H ' + (cabinaX + 17) + ' Z'}
      fill="#dbeafe" stroke="#93c5fd" strokeWidth="2" strokeLinejoin="round"/>
    <path d={'M ' + (cabinaX + 96) + ' 114 V 182'} stroke="#ffffff" strokeWidth="2" opacity=".45"/>
    <rect x={cabinaX + 120} y="159" width="19" height="11" rx="3" fill="#fef3c7"/>
    <rect x={cabinaX + 8} y="168" width="14" height="6" rx="2" fill="#cbd5e1"/>
    {[cajaX + (esTrailer ? 360 : 115), cajaX + (esTrailer ? 431 : 304), cabinaX + 98].map((cx, indice) =>
      <g key={indice}>
        <circle cx={cx} cy="202" r="22" fill="#334155"/>
        <circle cx={cx} cy="202" r="12" fill="#cbd5e1" stroke="#64748b" strokeWidth="3"/>
        <circle cx={cx} cy="202" r="4" fill="#64748b"/>
      </g>)}
    <rect x={cajaX + 9} y={cajaY + cajaAlto + 3} width={cajaAncho - 18} height="5" rx="2" fill="#94a3b8"/>
  </svg>;
}

function TarjetaTransporte({ vehiculo, ordinal, cambiar, eliminar }: {
  vehiculo: Vehiculo;
  ordinal: number;
  cambiar: (id: string, contenedores: number) => void;
  eliminar: (id: string) => void;
}) {
  const capacidad = CAPACIDAD[vehiculo.tipo];
  const porcentaje = vehiculo.contenedores / capacidad * 100;
  const libres = capacidad - vehiculo.contenedores;
  return <article className="min-w-0 rounded-2xl border border-[#e1e9e2] bg-[#fbfdfb] p-4 sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className={'rounded-xl p-2.5 ' +
          (vehiculo.tipo === 'TORTON' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-800')}>
          <Truck size={23} strokeWidth={1.8}/>
        </span>
        <div>
          <h4 className="font-bold text-[#173e35]">{ETIQUETAS[vehiculo.tipo]} {ordinal}</h4>
          <p className="mt-0.5 text-xs text-slate-500">Capacidad máxima: {capacidad} contenedores</p>
        </div>
      </div>
      <button type="button" onClick={() => eliminar(vehiculo.id)}
        aria-label={'Eliminar ' + ETIQUETAS[vehiculo.tipo] + ' ' + ordinal}
        title="Eliminar este vehículo"
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600">
        <Trash2 size={17}/>
      </button>
    </div>

    <div className="mt-2 flex justify-center"><CamionVisual tipo={vehiculo.tipo} contenedores={vehiculo.contenedores}/></div>

    <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Carga planeada</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-[#173e35]">
          {vehiculo.contenedores}<span className="mx-1 text-sm font-normal text-slate-400">/</span>{capacidad}
          <span className="ml-2 text-xs font-normal text-slate-500">contenedores</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {libres === 0 ? 'Capacidad completa' : libres + ' espacio(s) disponibles'}
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
        <button type="button" disabled={vehiculo.contenedores === 0}
          onClick={() => cambiar(vehiculo.id, vehiculo.contenedores - 1)}
          aria-label={'Quitar un contenedor de ' + ETIQUETAS[vehiculo.tipo] + ' ' + ordinal}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#173e35] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35">
          <Minus size={17}/>
        </button>
        <input type="number" min={0} max={capacidad} step={1}
          value={vehiculo.contenedores} onChange={e => cambiar(vehiculo.id, Number(e.target.value))}
          aria-label={'Número de contenedores de ' + ETIQUETAS[vehiculo.tipo] + ' ' + ordinal}
          className="w-14 rounded-md border border-slate-200 bg-white px-1 py-2 text-center text-sm font-semibold tabular-nums text-[#173e35] focus:border-emerald-700 focus:outline-none"/>
        <button type="button" disabled={vehiculo.contenedores >= capacidad}
          onClick={() => cambiar(vehiculo.id, vehiculo.contenedores + 1)}
          aria-label={'Agregar un contenedor a ' + ETIQUETAS[vehiculo.tipo] + ' ' + ordinal}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#173e35] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35">
          <Plus size={17}/>
        </button>
      </div>
    </div>
    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar"
      aria-label={'Ocupación de ' + ETIQUETAS[vehiculo.tipo] + ' ' + ordinal}
      aria-valuemin={0} aria-valuemax={capacidad} aria-valuenow={vehiculo.contenedores}>
      <div className={'h-full rounded-full transition-all duration-300 ' +
        (vehiculo.tipo === 'TORTON' ? 'bg-blue-600' : 'bg-teal-600')}
        style={{ width: porcentaje + '%' }}/>
    </div>
    <p className="mt-1 text-right text-[11px] font-semibold tabular-nums text-slate-500">
      {Math.round(porcentaje)} % de ocupación
    </p>
  </article>;
}

/**
 * Panel de planeación 100 % visual: no crea salidas ni afecta inventario.
 * Su persistencia es exclusivamente local al navegador y por ID de cliente.
 */
export default function PortalPlanTransportes({ clienteId }: { clienteId: number }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [claveCargada, setClaveCargada] = useState<string | null>(null);
  const storageKey = STORAGE_VERSION + ':' + clienteId;

  useEffect(() => {
    let guardados: Vehiculo[] = [];
    try {
      const almacenado = window.localStorage.getItem(storageKey);
      guardados = almacenado ? validarVehiculos(JSON.parse(almacenado)) : [];
    } catch {
      guardados = [];
    }
    setVehiculos(guardados);
    setClaveCargada(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (claveCargada !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(vehiculos));
    } catch {
      // Puede estar deshabilitado el almacenamiento del navegador; la vista sigue funcionando.
    }
  }, [claveCargada, storageKey, vehiculos]);

  const totales = useMemo(() => vehiculos.reduce((total, vehiculo) => {
    total.contenedores += vehiculo.contenedores;
    total.capacidad += CAPACIDAD[vehiculo.tipo];
    return total;
  }, { contenedores: 0, capacidad: 0 }), [vehiculos]);

  const agregar = (tipo: TipoTransporte) => {
    if (vehiculos.length >= MAX_VEHICULOS) return;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    setVehiculos(actuales => [...actuales, { id, tipo, contenedores: 0 }]);
  };
  const cambiar = (id: string, cantidad: number) => setVehiculos(actuales =>
    actuales.map(v => v.id === id
      ? { ...v, contenedores: enteroEnRango(cantidad, CAPACIDAD[v.tipo]) } : v));
  const eliminar = (id: string) => setVehiculos(actuales => actuales.filter(v => v.id !== id));
  const cargando = claveCargada !== storageKey;

  return <section className="rounded-2xl border border-[#e0e8e0] bg-white p-5 shadow-sm md:p-6"
    aria-labelledby="plan-transporte-titulo">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="plan-transporte-titulo" className="flex items-center gap-2 text-lg font-bold text-[#173e35]">
            <Truck size={21} className="text-[#13735c]"/> Planeación visual de transportes
          </h3>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            Simulación
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
          Agrega vehículos y representa cómo se llenan con contenedores.
          No se generan salidas reales, manifiestos, reservas ni movimientos de inventario.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => agregar('TORTON')} disabled={cargando || vehiculos.length >= MAX_VEHICULOS}
          className="inline-flex items-center gap-2 rounded-xl bg-[#13735c] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#105b4a] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={15}/> Tortón · 12
        </button>
        <button type="button" onClick={() => agregar('TRAILER')} disabled={cargando || vehiculos.length >= MAX_VEHICULOS}
          className="inline-flex items-center gap-2 rounded-xl border border-[#bcd7c6] bg-[#edf7f0] px-3 py-2.5 text-xs font-semibold text-[#155941] transition-colors hover:bg-[#dff1e5] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={15}/> Tráiler · 22
        </button>
      </div>
    </div>
    <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-xl bg-[#f4f8f5] p-3">
        <p className="text-[11px] text-slate-500">Vehículos agregados</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-[#173e35]">{vehiculos.length}</p>
      </div>
      <div className="rounded-xl bg-[#f4f8f5] p-3">
        <p className="text-[11px] text-slate-500">Contenedores planeados</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-[#173e35]">{totales.contenedores}</p>
      </div>
      <div className="rounded-xl bg-[#f4f8f5] p-3">
        <p className="text-[11px] text-slate-500">Capacidad total</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-[#173e35]">{totales.capacidad}</p>
      </div>
    </div>
    {cargando ? <p className="mt-5 py-8 text-center text-sm text-slate-500">Recuperando planeación visual...</p>
      : vehiculos.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {vehiculos.map((vehiculo, indice) =>
          <TarjetaTransporte key={vehiculo.id} vehiculo={vehiculo} ordinal={indice + 1}
            cambiar={cambiar} eliminar={eliminar}/>)}
      </div> : <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-[#cbded1] bg-[#fbfdfb] px-4 py-8 text-center">
        <span className="rounded-xl bg-[#e8f3ec] p-3 text-[#176f5b]"><Package size={27}/></span>
        <p className="mt-3 text-sm font-semibold text-[#173e35]">Todavía no hay transportes en esta planeación</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
          Agrega un tortón o un tráiler y utiliza los controles para cargar contenedores.
          Cada casilla iluminada representa un contenedor ocupado.
        </p>
      </div>}
    <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
      <Info size={15} className="mt-0.5 shrink-0"/>
      Esta planeación se conserva únicamente en este navegador, separada por cliente.
      Otros usuarios o dispositivos no la verán y puede perderse si se borran los datos del navegador.
      No representa embarques confirmados ni modifica existencias.
    </p>
  </section>;
}
