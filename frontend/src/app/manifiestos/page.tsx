'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, CheckCircle2, ClipboardCheck, FileText, Mail, RefreshCw, Truck } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { API_URL, apiFetch, pedir, sesionActual } from '@/utils/api';
import FloatingModal from '@/components/FloatingModal';

type Stage = 'PEDIDO' | 'RECOLECCION' | 'PESAJE' | 'VERIFICAR_DATOS' | 'CORRECCION_DATOS' | 'CONTADURIA' | 'RESGUARDO';
type Person = { id_Persona: number; nombre: string; tipo_persona: string };
type Client = { id_Persona: number; nombre: string; crm_perfil_comercial?: { correo: string | null } | null };
type Order = {
  id: number; folio: string; cantidad: string; unidad: string; orden_cliente: string;
  estado: string; tipo_venta: string; cliente: Client;
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
  cliente?: Client | null; orden_venta?: Order | null; eventos: EventItem[];
};
type Catalogs = { operadores: Person[]; clientes: Client[]; ordenes: Omit<Order, 'estado' | 'tipo_venta' | 'materiales_recibidos'>[] };
type ManifestModal = { tipo: 'crear' | 'completo' | 'asignar' | 'pesaje' | 'verificar' | 'corregir' | 'resguardo'; manifest?: Manifest };

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

function MetadataInputs({ manifest, operators, withAssignment = false, allowGknEdit = false, complete = false }: { manifest?: Manifest; operators: Person[]; withAssignment?: boolean; allowGknEdit?: boolean; complete?: boolean }) {
  const requiredFields = new Set(['razon_social_generadora', 'nombre_residuo', 'destino_autorizacion', 'destino_razon_social', 'linea_Produccion']);
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
        return <label key={key}>{label}<input name={key} required={complete && requiredFields.has(key)} maxLength={key === 'transportista_placas' ? 40 : 200} defaultValue={asText(manifest?.[key])} className="field" /></label>;
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
  const [catalogs, setCatalogs] = useState<Catalogs>({ operadores: [], clientes: [], ordenes: [] });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ManifestModal | null>(null);

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([
      pedir('/api/manifiestos', undefined, 'GET'),
      pedir('/api/manifiestos/catalogos', undefined, 'GET'),
    ]);
    setManifests(m.data ?? []);
    setCatalogs({ operadores: c.operadores ?? [], clientes: c.clientes ?? [], ordenes: c.ordenes ?? [] });
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
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
    finally { setBusy(null); }
    return false;
  };

  const submitForm = (id: number, path: string, build: (form: FormData) => unknown) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (await act(id, path, build(new FormData(e.currentTarget)))) setModal(null);
  };

  const actUpload = async (id: number, path: string, form: FormData) => {
    setBusy(id); setError(''); setNotice('');
    try { const result = await upload(path, form); setNotice(result.mensaje ?? 'Documento guardado.'); await load(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el documento'); }
    finally { setBusy(null); }
    return false;
  };

  const submitUpload = (id: number, path: string) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (await actUpload(id, path, new FormData(e.currentTarget))) setModal(null);
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
        cliente_id: form.get('cliente_id') || null,
        es_gkn: form.get('es_gkn') === 'on',
        razon_social_generadora: form.get('razon_social_generadora'),
        nombre_residuo: form.get('nombre_residuo'),
        peso_pedido: form.get('peso_pedido') || null,
      });
      setNotice(result.mensaje ?? 'Solicitud creada para Recolección.');
      formElement.reset();
      await load();
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el manifiesto'); }
    finally { setBusy(null); }
  };

  const createComplete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    setBusy(0); setError(''); setNotice('');
    try {
      const result = await upload('/api/manifiestos/completo', new FormData(formElement));
      setNotice(result.mensaje ?? 'Manifiesto completo registrado.');
      formElement.reset();
      await load();
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el manifiesto completo'); }
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

    {area === 'seguridad' && <div className="mb-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => setModal({ tipo: 'crear' })} className="rounded-lg border border-cyan-800 bg-cyan-950/60 px-4 py-3 text-left text-sm font-semibold text-cyan-200 hover:bg-cyan-900/60">+ Crear solicitud para Recolección</button>
      <button type="button" onClick={() => setModal({ tipo: 'completo' })} className="rounded-lg border border-violet-800 bg-violet-950/60 px-4 py-3 text-left text-sm font-semibold text-violet-200 hover:bg-violet-900/60">+ Registrar manifiesto completo</button>
    </div>}

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
              {(m.orden_venta || m.cliente) && <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[11px] text-slate-400">{m.orden_venta?.cliente.nombre ?? m.cliente?.nombre}{area === 'seguridad' && ((m.cliente?.crm_perfil_comercial?.correo ?? m.orden_venta?.cliente.crm_perfil_comercial?.correo) ? ` · ${m.cliente?.crm_perfil_comercial?.correo ?? m.orden_venta?.cliente.crm_perfil_comercial?.correo}` : ' · sin correo registrado')}{m.orden_venta && <> · Compra {m.numero_compra ?? m.orden_venta.orden_cliente} · Inventario {m.orden_venta.materiales_recibidos?.length ? 'vinculado' : 'pendiente'}</>}</p>}
              {m.motivo_correccion && <p className="mt-3 whitespace-pre-line rounded-lg border border-amber-900/70 bg-amber-950/40 p-2 text-[11px] text-amber-200">Observaciones SHyMA: {m.motivo_correccion}</p>}
              {m.documento_llegada_nombre && <button onClick={() => void download(m.id, 'llegada', m.documento_llegada_nombre!)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><ArrowDownToLine size={13} /> Documento de llegada</button>}
              {m.documento_manifiesto_nombre && <button onClick={() => void download(m.id, 'manifiesto', m.documento_manifiesto_nombre!)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><FileText size={13} /> PDF de manifiesto</button>}

              {m.estado === 'PEDIDO' && area === 'logistica' && <button type="button" onClick={() => setModal({ tipo: 'asignar', manifest: m })} className="mt-3 w-full rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold hover:bg-cyan-600">Asignar número y completar datos</button>}
              {m.estado === 'RECOLECCION' && area === 'almacen' && <button disabled={busy === m.id} onClick={() => void act(m.id, `/api/manifiestos/${m.id}/recibir`, {})} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"><Truck size={14} /> Confirmar llegada · pasar a Pesaje</button>}
              {m.estado === 'PESAJE' && area === 'almacen' && <button type="button" onClick={() => setModal({ tipo: 'pesaje', manifest: m })} className="mt-3 w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold hover:bg-amber-600">Registrar pesaje</button>}
              {m.estado === 'VERIFICAR_DATOS' && area === 'seguridad' && <button type="button" onClick={() => setModal({ tipo: 'verificar', manifest: m })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold hover:bg-cyan-600"><ClipboardCheck size={14} /> Abrir checklist SHyMA</button>}
              {m.estado === 'CORRECCION_DATOS' && area === 'logistica' && <button type="button" onClick={() => setModal({ tipo: 'corregir', manifest: m })} className="mt-3 w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold hover:bg-amber-600">Corregir datos</button>}
              {m.estado === 'CONTADURIA' && area === 'contaduria' && <button disabled={busy === m.id} onClick={() => void act(m.id, `/api/manifiestos/${m.id}/firmar`, {})} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"><CheckCircle2 size={14} /> Firmar y enviar a Resguardo</button>}
              {m.estado === 'RESGUARDO' && area === 'seguridad' && <div className="mt-3 space-y-2">
                {m.resguardado_en
                  ? <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 p-2 text-xs text-emerald-200">Resguardado {showDate(m.resguardado_en)}{m.resguardado_por ? ` · ${m.resguardado_por.nombre}` : ''}</p>
                  : <button type="button" onClick={() => setModal({ tipo: 'resguardo', manifest: m })} className="w-full rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold hover:bg-cyan-600">{m.documento_manifiesto_nombre ? 'Confirmar resguardo' : 'Guardar PDF en resguardo'}</button>}
                {m.resguardado_en && (m.cliente?.crm_perfil_comercial?.correo || m.orden_venta?.cliente.crm_perfil_comercial?.correo
                  ? <button disabled={busy === m.id} onClick={() => void act(m.id, `/api/manifiestos/${m.id}/enviar-correo`, {})} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-800 px-3 py-2 text-xs font-semibold hover:bg-cyan-700 disabled:opacity-50"><Mail size={14} /> Enviar manifiesto al cliente</button>
                  : <p className="rounded-lg border border-amber-900/70 bg-amber-950/40 p-2 text-[11px] text-amber-200">Registra el correo del cliente en su perfil comercial para habilitar el envío manual.</p>)}
                {m.eventos.find(event => event.accion === 'CORREO_MANIFIESTO_ENVIADO') && <p className="text-[10px] text-slate-500">Último envío: {showDate(m.eventos.find(event => event.accion === 'CORREO_MANIFIESTO_ENVIADO')!.creado_en)} · Puedes reenviarlo manualmente.</p>}
              </div>}

              <details className="mt-3 border-t border-slate-800 pt-2"><summary className="cursor-pointer text-[11px] text-slate-500">Bitácora · {m.eventos.length}</summary>
                <ol className="mt-2 space-y-2">{m.eventos.map(event => <li key={event.id} className="border-l border-slate-700 pl-2 text-[10px]"><span className="text-slate-300">{event.accion.replaceAll('_', ' ')}</span><span className="block text-slate-500">{event.actor?.nombre ?? event.actor_usuario} · {showDate(event.creado_en)}</span></li>)}</ol>
              </details>
            </article>)}
          </div>
        </section>;
      })}
    </div>}
    {modal && <FloatingModal
      title={modal.tipo === 'crear' ? 'Crear solicitud para Recolección' : modal.tipo === 'completo' ? 'Registrar manifiesto completo' : modal.tipo === 'asignar' ? 'Asignar número y completar datos' : modal.tipo === 'pesaje' ? 'Registrar pesaje de llegada' : modal.tipo === 'verificar' ? 'Checklist SHyMA' : modal.tipo === 'corregir' ? 'Corregir datos del manifiesto' : 'Guardar manifiesto en resguardo'}
      description={modal.manifest ? `${modal.manifest.no_Manifiesto ?? `Manifiesto #${modal.manifest.id}`} · ${modal.manifest.orden_venta?.folio ?? (modal.manifest.es_gkn ? 'GKN' : 'Sin OV')}` : modal.tipo === 'crear' ? 'La solicitud queda en Pedido/Recolección para que las áreas continúen el flujo.' : 'SHyMA registra los datos y el expediente en una sola captura.'}
      onClose={() => setModal(null)}
      closeDisabled={busy !== null}
      size="xl"
      theme="dark"
    >
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-900 bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}
      {modal.tipo === 'crear' && <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">Orden de venta (opcional)<select name="orden_venta_id" className="field"><option value="">Sin OV · recepción independiente</option>{catalogs.ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.cliente.nombre} · {o.cantidad} {o.unidad}</option>)}</select></label>
        <label className="sm:col-span-2">Cliente registrado (para poder enviarle el manifiesto)<select name="cliente_id" className="field"><option value="">Selecciona cliente si no hay OV</option>{catalogs.clientes.map(p => <option key={p.id_Persona} value={p.id_Persona}>{p.nombre}{p.crm_perfil_comercial?.correo ? ` · ${p.crm_perfil_comercial.correo}` : ' · sin correo'}</option>)}</select></label>
        <label>Razón social generadora<input name="razon_social_generadora" required maxLength={200} className="field" /></label>
        <label>Nombre del residuo<input name="nombre_residuo" required maxLength={200} className="field" /></label>
        <label>Peso pedido (kg, opcional)<input name="peso_pedido" type="number" min="0.0001" step="0.0001" className="field" /></label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs"><input type="checkbox" name="es_gkn" /> Es GKN (obligatorio si no hay OV)</label>
        <p className="text-xs text-slate-400 sm:col-span-2">Al elegir una OV se conserva el manifiesto generado al confirmar esa venta. Sin OV, completa el cliente y marca GKN para registrar una recepción independiente.</p>
        <button disabled={busy === 0} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold hover:bg-cyan-600 disabled:opacity-50 sm:col-span-2">Crear solicitud para Recolección</button>
      </form>}
      {modal.tipo === 'completo' && <form onSubmit={createComplete} encType="multipart/form-data" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">Orden de venta (opcional)<select name="orden_venta_id" className="field"><option value="">Sin OV · GKN independiente</option>{catalogs.ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.cliente.nombre} · {o.cantidad} {o.unidad}</option>)}</select></label>
          <label className="sm:col-span-2">Cliente registrado<select name="cliente_id" className="field"><option value="">Se toma del cliente de la OV o selecciona uno</option>{catalogs.clientes.map(p => <option key={p.id_Persona} value={p.id_Persona}>{p.nombre}{p.crm_perfil_comercial?.correo ? ` · ${p.crm_perfil_comercial.correo}` : ' · sin correo'}</option>)}</select></label>
          <MetadataInputs operators={catalogs.operadores} withAssignment allowGknEdit complete />
          <label>Peso pedido (kg, opcional)<input name="peso_pedido" type="number" min="0.0001" step="0.0001" className="field" /></label>
          <label>Peso de llegada (kg)<input required name="peso_llegada" type="number" min="0.0001" step="0.0001" className="field" /></label>
          <label>PDF del manifiesto (opcional)<input name="documento_manifiesto" type="file" accept="application/pdf,.pdf" className="field" /></label>
          <label>PDF de llegada a almacén (opcional)<input name="documento_llegada" type="file" accept="application/pdf,.pdf" className="field" /></label>
        </div>
        <p className="text-[11px] text-slate-400">Para manifiestos no GKN se requieren transportista, autorización SEMARNAT, placas y registro SCT. Cada PDF puede pesar hasta 10 MB.</p>
        <button disabled={busy === 0} className="w-full rounded-lg bg-violet-700 px-4 py-2 font-semibold hover:bg-violet-600 disabled:opacity-50">Registrar y enviar a checklist SHyMA</button>
      </form>}
      {modal.tipo === 'asignar' && modal.manifest && <form onSubmit={submitForm(modal.manifest.id, `/api/manifiestos/${modal.manifest.id}/asignar`, f => Object.fromEntries([...f.entries()]))} className="space-y-4">
        <MetadataInputs manifest={modal.manifest} operators={catalogs.operadores} withAssignment />
        <button disabled={busy === modal.manifest.id} className="w-full rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50">Enviar a Recolección</button>
      </form>}
      {modal.tipo === 'pesaje' && modal.manifest && <form onSubmit={submitUpload(modal.manifest.id, `/api/manifiestos/${modal.manifest.id}/pesaje`)} className="space-y-4">
        <label>Peso real de llegada (kg)<input required name="peso_llegada" type="number" min="0.0001" step="0.0001" defaultValue={modal.manifest.peso_llegada ?? ''} className="field" /></label>
        <label>Documento de llegada a almacén (PDF)<input name="documento_llegada" type="file" accept="application/pdf,.pdf" className="field" /></label>
        <button disabled={busy === modal.manifest.id} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">Guardar pesaje</button>
      </form>}
      {modal.tipo === 'verificar' && modal.manifest && <form onSubmit={submitForm(modal.manifest.id, `/api/manifiestos/${modal.manifest.id}/verificar`, f => ({ checklist: Object.fromEntries([...f.entries()].map(([k, v]) => [k, v === 'on'])) }))} className="space-y-3">
        <ChecklistInputs manifest={modal.manifest} />
        <button disabled={busy === modal.manifest.id} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50"><ClipboardCheck size={14} /> Validar y enviar</button>
      </form>}
      {modal.tipo === 'corregir' && modal.manifest && <form onSubmit={submitForm(modal.manifest.id, `/api/manifiestos/${modal.manifest.id}/corregir`, f => Object.fromEntries([...f.entries()]))} className="space-y-4">
        <MetadataInputs manifest={modal.manifest} operators={catalogs.operadores} allowGknEdit />
        <label>Después de corregir, enviar a<select name="destino" defaultValue="VERIFICAR_DATOS" className="field"><option value="VERIFICAR_DATOS">Revalidación del checklist SHyMA</option><option value="CONTADURIA">Contaduría, si se cumplen los controles pendientes</option></select></label>
        <p className="text-[11px] text-slate-400">El pase directo vuelve a revisar los datos, el peso y la trazabilidad. SHyMA debe haber confirmado la clasificación GKN y la bitácora.</p>
        <button disabled={busy === modal.manifest.id} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">Guardar corrección y enviar</button>
      </form>}
      {modal.tipo === 'resguardo' && modal.manifest && <form onSubmit={submitUpload(modal.manifest.id, `/api/manifiestos/${modal.manifest.id}/resguardo`)} className="space-y-4">
        <label>{modal.manifest.documento_manifiesto_nombre ? `PDF del manifiesto ya cargado: ${modal.manifest.documento_manifiesto_nombre}` : 'PDF final del manifiesto'}<input required={!modal.manifest.documento_manifiesto_nombre} name="documento_manifiesto" type="file" accept="application/pdf,.pdf" className="field" /></label>
        <button disabled={busy === modal.manifest.id} className="w-full rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50">{modal.manifest.documento_manifiesto_nombre ? 'Confirmar resguardo' : 'Guardar en resguardo'}</button>
      </form>}
    </FloatingModal>}
    <style jsx global>{`
      .field { display:block; width:100%; margin-top:6px; border:1px solid #334155; border-radius:8px; background:#020617; padding:9px 10px; color:#e2e8f0; font-size:12px; outline:none; }
      .field:focus { border-color:#0891b2; box-shadow:0 0 0 2px #0891b233; }
      label { color:#cbd5e1; font-size:11px; }
      input[type=file].field { padding:7px; }
      input[type=file]::file-selector-button { margin-right:8px; border:0; border-radius:5px; background:#1e293b; color:#a5f3fc; padding:4px 7px; }
    `}</style>
  </main>;
}
