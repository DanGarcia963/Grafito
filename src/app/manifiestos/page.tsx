'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, CheckCircle2, ClipboardCheck, FileText, RefreshCw, Truck } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { API_URL, apiFetch, pedir, sesionActual } from '@/utils/api';

type Stage = 'PEDIDO' | 'RECOLECCION' | 'PESAJE' | 'VERIFICAR_DATOS' | 'CORRECCION_DATOS' | 'CONTADURIA' | 'RESGUARDO';
type Person = { id_Persona: number; nombre: string; tipo_persona: string };
type Order = {
  id: number; folio: string; cantidad: string; unidad: string; orden_cliente: string;
  estado: string; tipo_venta: string; cliente: { id_Persona: number; nombre: string };
  producto: { nombre_Producto: string }; materiales_recibidos: { id: number }[];
};
type EventItem = { id: number; accion: string; estado_anterior: string | null; estado_nuevo: string; actor_usuario: string; actor?: { nombre: string } | null; creado_en: string; datos?: Record<string, unknown> | null };
type Manifest = {
  id: number; no_Manifiesto: string | null; fecha_Expedicion: string | null; estado: Stage;
  orden_venta_id: number | null; es_gkn: boolean; razon_social_generadora: string | null; nombre_residuo: string | null;
  transportista: string | null; transportista_autorizacion: string | null; transportista_placas: string | null;
  transportista_registro_sct: string | null; destino_autorizacion: string | null; destino_razon_social: string | null;
  linea_Produccion: string | null; numero_compra: string | null; peso_pedido: string | null; peso_llegada: string | null;
  fecha_recepcion_almacen: string | null; checklist: Record<string, boolean> | null; motivo_correccion: string | null;
  documento_llegada_nombre: string | null; documento_manifiesto_nombre: string | null; resguardado_en: string | null;
  creado_en: string; actualizado_en: string; operador?: { id_Persona: number; nombre: string } | null;
  firmado_por?: { id_Persona: number; nombre: string } | null; resguardado_por?: { id_Persona: number; nombre: string } | null;
  orden_venta?: Order | null; eventos: EventItem[];
};
type Catalogs = { operadores: Person[]; ordenes: Omit<Order, 'estado' | 'tipo_venta' | 'materiales_recibidos'>[] };

const stages: { id: Stage; label: string; area: string; hint: string }[] = [
  { id: 'PEDIDO', label: 'Pedido', area: 'Logística', hint: 'Asigna número de manifiesto y operador.' },
  { id: 'RECOLECCION', label: 'Recolección', area: 'Almacén', hint: 'Confirma que la carga llegó a planta.' },
  { id: 'PESAJE', label: 'Pesaje', area: 'Almacén', hint: 'Registra el peso real y el documento de llegada.' },
  { id: 'VERIFICAR_DATOS', label: 'Verificar datos', area: 'SHyMA', hint: 'Completa el checklist documental y de trazabilidad.' },
  { id: 'CORRECCION_DATOS', label: 'Corrección datos', area: 'Logística', hint: 'Corrige los datos observados y devuelve a SHyMA.' },
  { id: 'CONTADURIA', label: 'Contaduría', area: 'Contaduría', hint: 'Registra la firma de la persona autenticada.' },
  { id: 'RESGUARDO', label: 'Resguardo', area: 'SHyMA', hint: 'Sube y conserva el PDF final del manifiesto.' },
];
const metadataFields = [
  ['razon_social_generadora', 'Razón social generadora'],
  ['nombre_residuo', 'Nombre del residuo'],
  ['transportista', 'Transportista'],
  ['transportista_autorizacion', 'Autorización SEMARNAT del transportista'],
  ['transportista_placas', 'Placas'],
  ['transportista_registro_sct', 'Registro SCT'],
  ['destino_autorizacion', 'Autorización SEMARNAT del destino'],
  ['destino_razon_social', 'Razón social del destino'],
  ['linea_Produccion', 'Línea de producción'],
  ['numero_compra', 'No. de compra'],
] as const;
const checkItems: { key: string; label: string }[] = [
  { key: 'razonSocial', label: 'Razón social generadora validada' },
  { key: 'nombreResiduo', label: 'Nombre del residuo validado' },
  { key: 'gknVerificado', label: 'Confirmé si el manifiesto corresponde a GKN' },
  { key: 'transportistaAutorizacion', label: 'Autorización SEMARNAT del transportista' },
  { key: 'transportistaPlacas', label: 'Placas del transportista' },
  { key: 'transportistaRegistroSct', label: 'Número de registro SCT' },
  { key: 'destinoAutorizacion', label: 'Autorización SEMARNAT del destino final' },
  { key: 'destinoRazonSocial', label: 'Razón social del destino final' },
  { key: 'lineaProduccion', label: 'Línea de producción' },
  { key: 'certificadoTrazable', label: 'Certificado trazable con inventario de la OV' },
  { key: 'numeroCompra', label: 'Número de compra de Ventas' },
  { key: 'registroBitacora', label: 'Registro en bitácora de residuos' },
];
const asText = (value: unknown) => value == null ? '' : String(value);
const dateOnly = (value: string | null) => value ? value.slice(0, 10) : '';
const showDate = (value: string | null) => value ? new Date(value).toLocaleString('es-MX') : '—';
const subscribeArea = (callback: () => void) => {
  window.addEventListener('sesion-cambiada', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('sesion-cambiada', callback);
    window.removeEventListener('storage', callback);
  };
};
const currentArea = () => sesionActual()?.area ?? 'guest';
const serverArea = () => 'loading';

async function upload(path: string, form: FormData) {
  const response = await apiFetch(`${API_URL}${path}`, { method: 'POST', body: form });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false)
    throw new Error(Array.isArray(result?.message) ? result.message.join(', ') : result?.message ?? 'No se pudo completar la acción.');
  return result;
}

function MetadataInputs({ manifest, operators, withAssignment = false, allowGknEdit = false }: { manifest?: Manifest; operators: Person[]; withAssignment?: boolean; allowGknEdit?: boolean }) {
  return <>
    {withAssignment && <div className="grid gap-3 sm:grid-cols-3">
      <label>No. manifiesto <input required name="no_Manifiesto" maxLength={100} defaultValue={manifest?.no_Manifiesto ?? ''} className="field" /></label>
      <label>Fecha de expedición <input required type="date" name="fecha_Expedicion" defaultValue={dateOnly(manifest?.fecha_Expedicion ?? new Date().toISOString())} className="field" /></label>
      <label>Operador <select required name="operador_id" defaultValue={manifest?.operador?.id_Persona ?? ''} className="field"><option value="">Selecciona operador</option>{operators.map(p => <option key={p.id_Persona} value={p.id_Persona}>{p.nombre} · {p.tipo_persona}</option>)}</select></label>
    </div>}
    {allowGknEdit && <label>Clasificación<select name="es_gkn" defaultValue={String(manifest?.es_gkn ?? false)} className="field"><option value="false">No es GKN</option><option value="true">Es GKN</option></select></label>}
    <div className="grid gap-3 sm:grid-cols-2">
      {metadataFields.map(([key, label]) => {
        if (manifest?.es_gkn && !allowGknEdit && (key === 'transportista' || key.startsWith('transportista_'))) return null;
        return <label key={key}>{label}<input name={key} maxLength={key === 'transportista_placas' ? 40 : 200} defaultValue={asText(manifest?.[key])} className="field" /></label>;
      })}
    </div>
  </>;
}

function ChecklistInputs({ manifest }: { manifest: Manifest }) {
  const prior = manifest.checklist ?? {};
  const applicable = checkItems.filter(item => {
    if (manifest.es_gkn && item.key.startsWith('transportista')) return false;
    if (!manifest.orden_venta_id && ['certificadoTrazable', 'numeroCompra'].includes(item.key)) return false;
    return true;
  });
  return <div className="space-y-2">
    {applicable.map(item => <label key={item.key} className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-2.5 text-xs text-slate-200">
      <input type="checkbox" name={item.key} defaultChecked={prior[item.key] === true} className="mt-0.5 accent-cyan-500" />
      <span>{item.label}</span>
    </label>)}
    {manifest.orden_venta && <p className="rounded-lg bg-slate-950 p-2 text-xs text-slate-400">El backend confirma además que la OV esté relacionada con una entrada de inventario.</p>}
    {manifest.peso_llegada && <p className="rounded-lg bg-slate-950 p-2 text-xs text-slate-400">Peso de llegada: {manifest.peso_llegada} kg · comparación de ±500 kg validada durante el pesaje.</p>}
  </div>;
}

export default function ManifiestosPage() {
  const socket = useSocket();
  const router = useRouter();
  const area = useSyncExternalStore(subscribeArea, currentArea, serverArea);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>({ operadores: [], ordenes: [] });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([
      pedir('/api/manifiestos', undefined, 'GET'),
      pedir('/api/manifiestos/catalogos', undefined, 'GET'),
    ]);
    setManifests(m.data ?? []);
    setCatalogs({ operadores: c.operadores ?? [], ordenes: c.ordenes ?? [] });
  }, []);

  useEffect(() => {
    if (area === 'loading') return;
    const allowed = ['seguridad', 'logistica', 'almacen', 'contaduria'];
    if (!allowed.includes(area)) { router.replace('/'); return; }
    const timer = window.setTimeout(() => {
      void load().catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar los manifiestos')).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [area, load, router]);

  useEffect(() => {
    const refresh = () => { void load().catch(e => setError(e instanceof Error ? e.message : 'No se pudieron actualizar los manifiestos')); };
    socket?.on('MANIFIESTO_ACTUALIZADO', refresh);
    return () => { socket?.off('MANIFIESTO_ACTUALIZADO', refresh); };
  }, [socket, load]);

  const filtered = useMemo(() => manifests.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLocaleLowerCase();
    return [m.no_Manifiesto, m.razon_social_generadora, m.nombre_residuo, m.orden_venta?.folio, m.orden_venta?.cliente.nombre, m.transportista]
      .some(v => String(v ?? '').toLocaleLowerCase().includes(q));
  }), [manifests, search]);

  const act = async (id: number, path: string, body?: unknown) => {
    setBusy(id); setError(''); setNotice('');
    try {
      const result = await pedir(path, body);
      setNotice(result.mensaje ?? 'Cambios guardados.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
    finally { setBusy(null); }
  };

  const submitForm = (id: number, path: string, build: (form: FormData) => unknown) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await act(id, path, build(new FormData(e.currentTarget)));
  };

  const actUpload = async (id: number, path: string, form: FormData) => {
    setBusy(id); setError(''); setNotice('');
    try { const result = await upload(path, form); setNotice(result.mensaje ?? 'Documento guardado.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el documento'); }
    finally { setBusy(null); }
  };

  const download = async (id: number, tipo: 'manifiesto' | 'llegada', nombre: string) => {
    try {
      const response = await apiFetch(`${API_URL}/api/manifiestos/${id}/documento/${tipo}`);
      if (!response.ok) throw new Error('No se pudo descargar el documento.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = nombre; anchor.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar el documento'); }
  };

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formElement = e.currentTarget; const form = new FormData(formElement);
    setBusy(0); setError(''); setNotice('');
    try {
      const result = await pedir('/api/manifiestos', {
        orden_venta_id: form.get('orden_venta_id') || null,
        es_gkn: form.get('es_gkn') === 'on',
        razon_social_generadora: form.get('razon_social_generadora'),
        nombre_residuo: form.get('nombre_residuo'),
        peso_pedido: form.get('peso_pedido') || null,
      });
      setNotice(result.mensaje ?? 'Manifiesto creado en Pedido.');
      formElement.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el manifiesto'); }
    finally { setBusy(null); }
  };

  const roleLabel: Record<string, string> = { seguridad: 'SHyMA', logistica: 'Logística', almacen: 'Almacén', contaduria: 'Contaduría' };

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-400">Operación · Manifiestos</p>
        <h1 className="mt-1 text-3xl font-bold">Seguimiento de manifiestos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Cada tarjeta solo habilita la acción del área responsable de su etapa. Las ventas confirmadas generan un manifiesto en Pedido; SHyMA puede registrar entradas GKN sin OV.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-900 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-200">Sesión: {roleLabel[area] ?? area}</span>
        {area === 'seguridad' && <Link href="/matriz" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Matriz Legal</Link>}
        <Link href="/" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Inicio</Link>
        <button onClick={() => { setLoading(true); void load().catch(e => setError(e.message)).finally(() => setLoading(false)); }} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"><RefreshCw size={15} /> Actualizar</button>
      </div>
    </header>

    {error && <p role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/50 p-3 text-sm text-emerald-200">{notice}</p>}

    {area === 'seguridad' && <details className="mb-5 rounded-xl border border-cyan-900/60 bg-slate-900 p-4">
      <summary className="cursor-pointer font-semibold text-cyan-200">+ Registrar manifiesto GKN</summary>
      <form onSubmit={create} className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="md:col-span-2">Orden de venta (opcional)
          <select name="orden_venta_id" className="field"><option value="">Sin OV · recepción independiente</option>{catalogs.ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.cliente.nombre} · {o.cantidad} {o.unidad}</option>)}</select>
        </label>
        <label>Razón social generadora<input name="razon_social_generadora" required maxLength={200} className="field" /></label>
        <label>Nombre del residuo<input name="nombre_residuo" required maxLength={200} className="field" /></label>
        <label>Peso pedido (kg, opcional)<input name="peso_pedido" type="number" min="0.0001" step="0.0001" className="field" /></label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"><input type="checkbox" name="es_gkn" defaultChecked /> Es un manifiesto de GKN</label>
        <button disabled={busy === 0} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold hover:bg-cyan-600 disabled:opacity-50">Crear en Pedido</button>
      </form>
    </details>}

    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-400">{filtered.length} manifiestos · {manifests.filter(m => m.estado === 'RESGUARDO' && m.resguardado_en).length} con PDF resguardado</p>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por folio, cliente, manifiesto o residuo" className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-600" />
    </div>

    {loading ? <p className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">Cargando manifiestos…</p> : <div className="grid grid-cols-[repeat(7,minmax(265px,1fr))] gap-4 overflow-x-auto pb-3">
      {stages.map(stage => {
        const cards = filtered.filter(m => m.estado === stage.id);
        return <section key={stage.id} className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 xl:min-w-[265px]">
          <div className="border-b border-slate-800 p-3">
            <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{stage.label}</h2><span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{cards.length}</span></div>
            <p className="mt-1 text-[11px] text-slate-500">{stage.area} · {stage.hint}</p>
          </div>
          <div className="space-y-3 p-3">
            {!cards.length && <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-600">Sin manifiestos en esta etapa</p>}
            {cards.map(m => <article key={m.id} className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-[10px] uppercase tracking-wider text-cyan-400">{m.no_Manifiesto ?? 'Pendiente de número'}</p><h3 className="mt-1 break-words font-semibold">{m.orden_venta?.folio ?? `Manifiesto #${m.id}`}</h3></div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${m.es_gkn ? 'bg-violet-950 text-violet-200' : 'bg-slate-800 text-slate-300'}`}>{m.es_gkn ? 'GKN' : 'OV'}</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Generador</dt><dd className="text-right text-slate-300">{m.razon_social_generadora ?? m.orden_venta?.cliente.nombre ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Residuo</dt><dd className="text-right text-slate-300">{m.nombre_residuo ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Peso pedido</dt><dd className="text-right text-slate-300">{m.peso_pedido ?? m.orden_venta?.cantidad ?? '—'} {m.peso_pedido || m.orden_venta?.unidad === 'Kilogramos' ? 'kg' : m.orden_venta?.unidad ?? ''}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Peso llegada</dt><dd className="text-right text-slate-300">{m.peso_llegada ? `${m.peso_llegada} kg` : '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Operador</dt><dd className="text-right text-slate-300">{m.operador?.nombre ?? '—'}</dd></div>
              </dl>
              {m.orden_venta && <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[11px] text-slate-400">{m.orden_venta.cliente.nombre} · Compra {m.numero_compra ?? m.orden_venta.orden_cliente} · Inventario {m.orden_venta.materiales_recibidos?.length ? 'vinculado' : 'pendiente'}</p>}
              {m.motivo_correccion && <p className="mt-3 whitespace-pre-line rounded-lg border border-amber-900/70 bg-amber-950/40 p-2 text-[11px] text-amber-200">Observaciones SHyMA: {m.motivo_correccion}</p>}
              {m.documento_llegada_nombre && <button onClick={() => void download(m.id, 'llegada', m.documento_llegada_nombre!)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><ArrowDownToLine size={13} /> Documento de llegada</button>}
              {m.documento_manifiesto_nombre && <button onClick={() => void download(m.id, 'manifiesto', m.documento_manifiesto_nombre!)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><FileText size={13} /> PDF de manifiesto</button>}

              {m.estado === 'PEDIDO' && area === 'logistica' && <details className="mt-3 rounded-lg border border-slate-800 p-2"><summary className="cursor-pointer text-xs font-semibold text-cyan-300">Asignar número y completar datos</summary>
                <form onSubmit={submitForm(m.id, `/api/manifiestos/${m.id}/asignar`, f => Object.fromEntries([...f.entries()]))} className="mt-3 space-y-3">
                  <MetadataInputs manifest={m} operators={catalogs.operadores} withAssignment />
                  <button disabled={busy === m.id} className="w-full rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50">Enviar a Recolección</button>
                </form>
              </details>}
              {m.estado === 'RECOLECCION' && area === 'almacen' && <button disabled={busy === m.id} onClick={() => void act(m.id, `/api/manifiestos/${m.id}/recibir`, {})} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"><Truck size={14} /> Confirmar llegada · pasar a Pesaje</button>}
              {m.estado === 'PESAJE' && area === 'almacen' && <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void actUpload(m.id, `/api/manifiestos/${m.id}/pesaje`, form); }} className="mt-3 space-y-3">
                <label>Peso real de llegada (kg)<input required name="peso_llegada" type="number" min="0.0001" step="0.0001" defaultValue={m.peso_llegada ?? ''} className="field" /></label>
                <label>Documento de llegada a almacén (PDF)<input name="documento_llegada" type="file" accept="application/pdf,.pdf" className="field" /></label>
                <button disabled={busy === m.id} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold hover:bg-amber-600 disabled:opacity-50">Guardar pesaje</button>
              </form>}
              {m.estado === 'VERIFICAR_DATOS' && area === 'seguridad' && <details className="mt-3 rounded-lg border border-slate-800 p-2"><summary className="cursor-pointer text-xs font-semibold text-cyan-300">Abrir checklist SHyMA</summary>
                <form onSubmit={submitForm(m.id, `/api/manifiestos/${m.id}/verificar`, f => ({ checklist: Object.fromEntries([...f.entries()].map(([k, v]) => [k, v === 'on'])) }))} className="mt-3 space-y-2">
                  <ChecklistInputs manifest={m} />
                  <button disabled={busy === m.id} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50"><ClipboardCheck size={14} /> Validar y enviar</button>
                </form>
              </details>}
              {m.estado === 'CORRECCION_DATOS' && area === 'logistica' && <details className="mt-3 rounded-lg border border-amber-900/60 p-2" open><summary className="cursor-pointer text-xs font-semibold text-amber-200">Corregir datos</summary>
                <form onSubmit={submitForm(m.id, `/api/manifiestos/${m.id}/corregir`, f => Object.fromEntries([...f.entries()]))} className="mt-3 space-y-3">
                  <MetadataInputs manifest={m} operators={catalogs.operadores} allowGknEdit />
                  <button disabled={busy === m.id} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold hover:bg-amber-600 disabled:opacity-50">Devolver a SHyMA</button>
                </form>
              </details>}
              {m.estado === 'CONTADURIA' && area === 'contaduria' && <button disabled={busy === m.id} onClick={() => void act(m.id, `/api/manifiestos/${m.id}/firmar`, {})} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"><CheckCircle2 size={14} /> Firmar y enviar a Resguardo</button>}
              {m.estado === 'RESGUARDO' && area === 'seguridad' && (m.resguardado_en ? <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/50 p-2 text-xs text-emerald-200">Resguardado {showDate(m.resguardado_en)}{m.resguardado_por ? ` · ${m.resguardado_por.nombre}` : ''}</p> : <form onSubmit={e => { e.preventDefault(); void actUpload(m.id, `/api/manifiestos/${m.id}/resguardo`, new FormData(e.currentTarget)); }} className="mt-3 space-y-3">
                <label>PDF final del manifiesto<input required name="documento_manifiesto" type="file" accept="application/pdf,.pdf" className="field" /></label>
                <button disabled={busy === m.id} className="w-full rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50">Guardar en resguardo</button>
              </form>)}

              <details className="mt-3 border-t border-slate-800 pt-2"><summary className="cursor-pointer text-[11px] text-slate-500">Bitácora · {m.eventos.length}</summary>
                <ol className="mt-2 space-y-2">{m.eventos.map(event => <li key={event.id} className="border-l border-slate-700 pl-2 text-[10px]"><span className="text-slate-300">{event.accion.replaceAll('_', ' ')}</span><span className="block text-slate-500">{event.actor?.nombre ?? event.actor_usuario} · {showDate(event.creado_en)}</span></li>)}</ol>
              </details>
            </article>)}
          </div>
        </section>;
      })}
    </div>}
    <style jsx global>{`
      .field { display:block; width:100%; margin-top:6px; border:1px solid #334155; border-radius:8px; background:#020617; padding:9px 10px; color:#e2e8f0; font-size:12px; outline:none; }
      .field:focus { border-color:#0891b2; box-shadow:0 0 0 2px #0891b233; }
      label { color:#cbd5e1; font-size:11px; }
      input[type=file].field { padding:7px; }
      input[type=file]::file-selector-button { margin-right:8px; border:0; border-radius:5px; background:#1e293b; color:#a5f3fc; padding:4px 7px; }
    `}</style>
  </main>;
}
