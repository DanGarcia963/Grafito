
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import { EstadoMuestra } from '@/types/muestras';
import { 

  ClipboardCheck, Truck, PackageCheck, AlertTriangle
} from 'lucide-react';
type IconProps = React.SVGProps<SVGSVGElement>;

const Icon = ({ children, ...props }: IconProps & { children?: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

const FlaskConical = (props: IconProps) => <Icon {...props}><path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3M8 15h8" /></Icon>;
const Search = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
const Filter = (props: IconProps) => <Icon {...props}><path d="M4 5h16M7 12h10M10 19h4" /></Icon>;
const Clock = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
const CheckCircle2 = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></Icon>;
const XCircle = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></Icon>;
const AlertCircle = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></Icon>;
const Database = (props: IconProps) => <Icon {...props}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5m-16 7v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></Icon>;
const User = (props: IconProps) => <Icon {...props}><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></Icon>;
const Calendar = (props: IconProps) => <Icon {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>;
const ChevronRight = (props: IconProps) => <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>;
const RefreshCw = (props: IconProps) => <Icon {...props}><path d="M20 11a8 8 0 0 0-14.8-4L3 10m0-4v4h4M4 13a8 8 0 0 0 14.8 4L21 14m0 4v-4h-4" /></Icon>;
const Lock = (props: IconProps) => <Icon {...props}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></Icon>;

interface ParametroLaboratorio {
  id_Parametro?: number;
  id?: number;
  nombre_Parametro?: string;
  nombre?: string;
  unidad_Medida?: string;
  unidad?: string;
  tipo_Dato?: string;
  }

export const CalidadMuestrasScreen: React.FC = () => {
  const socket = useSocket();
  const [muestras, setMuestras] = useState<any[]>([]);
  const [loadingMuestras, setLoadingMuestras] = useState<boolean>(true);
  const [loadingMuestrasDictaminadas, setLoadingMuestrasDictaminadas] = useState<boolean>(true);
  const [muestrasDictaminadas, setMuestrasDictaminadas] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS'); // Cambiado a TODOS por defecto
  const [tipoMuestra, setTipoMuestra] = useState<string>('MUESTRA_INICIAL');

// Estado para controlar el modo del modal (captura vs lectura)
const [esModoLectura, setEsModoLectura] = useState<boolean>(false);

// Estado para almacenar las especificaciones/resultados traídos de la BD
const [especificacionesGuardadas, setEspecificacionesGuardadas] = useState<any[]>([]);
const [loadingEspecificaciones, setLoadingEspecificaciones] = useState<boolean>(false);

  const [analistaNombre, setAnalistaNombre] = useState<string>('');
const [sugerenciasAnalistas, setSugerenciasAnalistas] = useState<any[]>([]);
const [mostrarSugerencias, setMostrarSugerencias] = useState<boolean>(false);

// Estados nuevos para Lotes de Grafito
  const [lotesLlegada, setLotesLlegada] = useState<any[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<any>(null);

// Pestaña activa: 'MUESTRAS' o 'CHECKLIST'
  const [vistaActiva, setVistaActiva] = useState<'MUESTRAS' | 'CHECKLIST'>('MUESTRAS');

  // Estado del Modal de Captura
  const [muestraSeleccionada, setMuestraSeleccionada] = useState<any | null>(null);
  const [parametros, setParametros] = useState<ParametroLaboratorio[]>([]);
  const [loadingParametros, setLoadingParametros] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediciones, setMediciones] = useState<{ [paramId: number]: string }>({});
  const [observaciones, setObservaciones] = useState('');
  const [dictamen, setDictamen] = useState<'APROBADO' | 'RECHAZADO'>('APROBADO');

  // Lista de IDs de parámetros que se muestran actualmente en el formulario
const [parametrosSeleccionados, setParametrosSeleccionados] = useState<number[]>([]);

// ID del parámetro seleccionado en el combo para agregar
const [parametroAAgregar, setParametroAAgregar] = useState<string>('');

  // Helper para normalizar el acceso a propiedades (camelCase vs snake_case)
const getMuestraData = (muestra: any) => {
  return {
    id: muestra.id_Muestra ?? muestra.id,
    codigo: muestra.no_Muestra ?? muestra.codigo,

    estado:
      muestra.dictamen ??
      muestra.estado_Muestra ??
      muestra.estatus ??
      'EN_ANALISIS',

    nombreTanque:
      muestra.equipos_tanques?.nombre_Equipo ??
      muestra.nombreTanque ??
      'N/A',

    noLote:
      muestra.lotes_produccion?.no_Lote ??
      muestra.noLote ??
      'N/A',

    nombreProducto:
      muestra.productos_materiales?.nombre_Producto ??
      muestra.nombreProducto ??
      'N/A',

    nombreCliente:
      muestra.personas_muestras_cliente_idTopersonas?.nombre ??
      muestra.personas_muestras_cliente_idTopersonas,

    nombreAnalista:
      muestra.personas_muestras_analista_idTopersonas?.nombre ??
      muestra.personas_muestras_analista_idTopersonas,

    fecha:
      muestra.fecha_Toma ??
      muestra.fecha,

tipoMuestra: obtenerTipoMuestra(muestra),
  };
};

const cargarLotesLlegada = async () => {
  try {
    const response = await fetch(
      'http://localhost:4002/api/calidad/obtenerOrdenesPendientesDeLlegada'
    );

    const res = await response.json();

    if (!response.ok || !res.success) {
      throw new Error(res.error || 'Error al obtener órdenes pendientes');
    }

    console.log('Órdenes pendientes:', res.result);

  } catch (error) {
    console.error('Error cargando órdenes pendientes de llegada:', error);
  }
};

  // 1. Cargar Muestras desde la API
  const fetchMuestras = useCallback(async () => {
    setLoadingMuestras(true);
    try {
      const res = await fetch('http://localhost:4002/api/calidad/obtenerMuestras');
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      
      const data = await res.json();

      

      // Desenvolver respuesta dinámicamente según la estructura recibida
      let lista = [];
      if (Array.isArray(data)) {
        lista = data;
      } else if (Array.isArray(data.result)) {
        lista = data.result;
      } else if (Array.isArray(data.data?.result)) {
        lista = data.data.result;
      } else if (Array.isArray(data.data)) {
        lista = data.data;
      } else if (Array.isArray(data.muestras)) {
        lista = data.muestras;
      }

      setMuestras(lista);
    } catch (err) {
      console.error('Error al cargar muestras:', err);
    } finally {
      setLoadingMuestras(false);
    }
  }, []);

const fetchMuestrasDictaminadas = useCallback(async () => {
  setLoadingMuestrasDictaminadas(true);
  try {
    const res = await fetch('http://localhost:4002/api/calidad/obtenerMuestrasDictaminadas');
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const data = await res.json();
    let lista = [];
    if (Array.isArray(data)) lista = data;
    else if (Array.isArray(data.result)) lista = data.result;
    else if (Array.isArray(data.data?.result)) lista = data.data.result;
    else if (Array.isArray(data.data)) lista = data.data;

    setMuestrasDictaminadas(lista); // <--- Corrección aquí
  } catch (err) {
    console.error('Error al cargar muestras dictaminadas:', err);
  } finally {
    setLoadingMuestrasDictaminadas(false);
  }
}, []);

const obtenerTipoMuestra = (muestra: any): string => {
  const valor =
    muestra?.tipo_Muestra ||
    muestra?.tipoMuestra ||
    muestra?.tipo_muestra ||
    muestra?.categoria_Muestra ||
    'MUESTRA_INICIAL';

  return String(valor)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
};

  // 2. Cargar Parámetros de laboratorio desde la API
  const fetchParametros = useCallback(async () => {
    setLoadingParametros(true);
    try {
      const res = await fetch('http://localhost:4002/api/calidad/obtenerParametros');
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      
      const data = await res.json();
      console.log("Respuesta servidor Parámetros:", data);

      let listaParametros = [];
      if (Array.isArray(data)) {
        listaParametros = data;
      } else if (Array.isArray(data.result)) {
        listaParametros = data.result;
      } else if (Array.isArray(data.data?.result)) {
        listaParametros = data.data.result;
      } else if (Array.isArray(data.data)) {
        listaParametros = data.data;
      }

      setParametros(listaParametros);
    } catch (err) {
      console.error('Error al cargar parámetros:', err);
    } finally {
      setLoadingParametros(false);
    }
  }, []);

useEffect(() => {
    if (!socket) return;

    // A) Reutilizar el evento existente de Tanques:
    // Si un tanque cambia a "En Espera de Calidad", refrescamos las muestras
    const handleEstatusTanque = () => {
      console.log('⚡ Cambio en tanques detectado. Refrescando muestras de Calidad...');
      fetchMuestras();
    };

    // B) Eventos específicos de Calidad (Nuevos o recomendados):
    const handleMuestraCreada = () => {
      console.log('🧪 Nueva muestra recibida en laboratorio. Refrescando...');
      fetchMuestras();
    };

    const handleMuestraActualizada = () => {
      console.log('✅ Dictamen de muestra actualizado. Refrescando...');
      fetchMuestras();
    };

    // Suscripción
    socket.on('ESTATUS_TANQUE_CAMBIADO', handleEstatusTanque);
    socket.on('MUESTRA_CREADA', handleMuestraCreada);
    socket.on('MUESTRA_ACTUALIZADA', handleMuestraActualizada);

    // Limpieza (Cleanup)
    return () => {
      socket.off('ESTATUS_TANQUE_CAMBIADO', handleEstatusTanque);
      socket.off('MUESTRA_CREADA', handleMuestraCreada);
      socket.off('MUESTRA_ACTUALIZADA', handleMuestraActualizada);
    };
  }, [socket, fetchMuestras]);

  useEffect(() => {
    fetchMuestras();
    fetchParametros();
  }, [fetchMuestras, fetchParametros]);

// Al abrir el modal, inicializamos los parámetros seleccionados con los que vienen de la BD
const abrirModalCaptura = async (muestra: any) => {
const muestraData = getMuestraData(muestra);

  setMuestraSeleccionada(muestra);
  setTipoMuestra(muestraData.tipoMuestra);
  const dictamenActual = (muestraData.estado || '').toUpperCase().trim();
  const esFinalizada = dictamenActual === 'APROBADO' || dictamenActual === 'RECHAZADO' || dictamenActual === 'APROBADA' || dictamenActual === 'RECHAZADA';

  if (esFinalizada) {
    // --- MODO SOLO LECTURA ---
    setEsModoLectura(true);
    setLoadingEspecificaciones(true);
    setEspecificacionesGuardadas([]);

    try {
      const res = await fetch(`http://localhost:4002/api/calidad/${muestraData.id}/especificaciones`);
      if (res.ok) {
        const data = await res.json();
        // Si data viene envuelto en algún objeto de respuesta o directamente como array
        const listaSpecs = Array.isArray(data) ? data : (data.data || data.result || []);
        setEspecificacionesGuardadas(listaSpecs);
      } else {
        console.warn('No se encontraron especificaciones guardadas para esta muestra.');
      }
    } catch (err) {
      console.error('Error al cargar especificaciones de la muestra:', err);
    } finally {
      setLoadingEspecificaciones(false);
    }

  } else {
    // --- MODO CAPTURA/EDICIÓN ---
    setEsModoLectura(false);
    setMediciones({});
    setObservaciones('');
    setDictamen('APROBADO');
    setAnalistaNombre('');
    setParametroAAgregar('');

    if (parametros.length > 0) {
      const idsIniciales = parametros.map((p) => p.id_Parametro ?? p.id ?? 0);
      setParametrosSeleccionados(idsIniciales);
    } else {
      setParametrosSeleccionados([]);
    }
  }
};

// Eliminar un parámetro de la captura actual
const handleEliminarParametro = (idParam: number) => {
  setParametrosSeleccionados((prev) => prev.filter((id) => id !== idParam));
  
  // Opcional: Limpiar el valor capturado si se quita el campo
  setMediciones((prev) => {
    const copia = { ...prev };
    delete copia[idParam];
    return copia;
  });
};

// Agregar un parámetro del catálogo a la lista activa
const handleAgregarParametro = () => {
  if (!parametroAAgregar) return;
  const idNum = Number(parametroAAgregar);

  if (!parametrosSeleccionados.includes(idNum)) {
    setParametrosSeleccionados((prev) => [...prev, idNum]);
  }
  
  setParametroAAgregar(''); // Resetear el select
};

const cerrarModal = () => {
  setMuestraSeleccionada(null);
  setEsModoLectura(false);
  setEspecificacionesGuardadas([]);
  setMediciones({});
  setObservaciones('');
  setAnalistaNombre('');
};

  const handleMedicionChange = (paramId: number, valor: string) => {
    setMediciones((prev) => ({
      ...prev,
      [paramId]: valor,
    }));
  };

const guardarResultados = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!muestraSeleccionada) return;

  const { id: idMuestra } = getMuestraData(muestraSeleccionada);

  setSubmitting(true);
  try {
    // 1. Mapear mediciones en una lista de objetos
    const listaMediciones = Object.entries(mediciones).map(([paramId, valor]) => ({
      id_Parametro: Number(paramId),
      valor: String(valor),
    }));

    // 2. Un solo POST al backend enviando todo el paquete
    const resResultados = await fetch('http://localhost:4002/api/calidad/crearResultado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_Muestra: idMuestra,
        mediciones: listaMediciones,
        observaciones,
      }),
    });

    const dataResultados = await resResultados.json();
    if (!dataResultados.success) {
      throw new Error(dataResultados.error || 'Error al guardar los resultados');
    }

    // 3. Actualizar el dictamen, observaciones y tipo de muestra
    const resEstado = await fetch('http://localhost:4002/api/calidad/actualizarEstadoMuestra', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idMuestra: Number(idMuestra),
        dictamen: dictamen,
        tipoMuestra: tipoMuestra, // Se envía el tipo de muestra
        observaciones: observaciones, // Se envían las observaciones
        analistaNombre: analistaNombre.trim(), // <--- Enviamos el nombre escrito
      }),
    });

    const dataEstado = await resEstado.json();
    console.log('Respuesta actualización estado:', dataEstado);

    if (!dataEstado.success || dataEstado.count === 0) {
      console.warn('⚠️ No se actualizó ningún registro en muestras. Revisa el idMuestra o los campos.');
    }
    cerrarModal();
    await fetchMuestras();
    const lotesLlegada = await cargarLotesLlegada()
    console.log("lotes llegada", lotesLlegada)
    
  } catch (err) {
    console.error('Error al registrar resultados de laboratorio:', err);
  } finally {
    setSubmitting(false);
  }
};

  // Filtrado dinámico
  const muestrasFiltradas = muestras.filter((m) => {
    const { codigo, noLote, nombreTanque, nombreProducto, estado } = getMuestraData(m);

    const q = busqueda.toLowerCase();
    const coincideBusqueda =
      codigo.toLowerCase().includes(q) ||
      noLote.toLowerCase().includes(q) ||
      nombreTanque.toLowerCase().includes(q) ||
      nombreProducto.toLowerCase().includes(q);

    const coincideEstado = filtroEstado === 'TODOS' || estado.toUpperCase() === filtroEstado.toUpperCase();

    return coincideBusqueda && coincideEstado;
  });

const buscarAnalistas = async (query: string) => {
  setAnalistaNombre(query);
  if (query.trim().length < 2) {
    setSugerenciasAnalistas([]);
    return;
  }

  try {
    const res = await fetch(`http://localhost:4002/api/calidad/buscarAnalistas?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success) {
      setSugerenciasAnalistas(data.analistas);
      setMostrarSugerencias(true);
    }
  } catch (err) {
    console.error('Error al buscar analistas:', err);
  }
};

const seleccionarAnalista = (nombre: string) => {
  setAnalistaNombre(nombre);
  setMostrarSugerencias(false);
};

const renderBadgeEstado = (estado: string) => {
  const est = (estado || '').toUpperCase().trim();

  switch (est) {
    case 'EN_ANALISIS':
    case 'EN ANALISIS':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
          <Clock className="w-3.5 h-3.5" /> En Análisis
        </span>
      );
    case 'APROBADO':
    case 'APROBADA':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> Aprobado
        </span>
      );
    case 'RECHAZADO':
    case 'RECHAZADA':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3.5 h-3.5" /> Rechazado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
          <AlertCircle className="w-3.5 h-3.5" /> {estado || 'Pendiente'}
        </span>
      );
  }
};

return (
  <div className="p-6 bg-slate-950 min-h-screen text-slate-100 space-y-6">
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Muestras en Calidad</h1>
          <p className="text-sm text-slate-400">
            Monitoreo e inspección de muestras recibidas desde Tanques de Grafito
          </p>
        </div>
      </div>

      {/* Selector de Pestañas Integrado */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setVistaActiva('MUESTRAS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                vistaActiva === 'MUESTRAS'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FlaskConical className="w-4 h-4" /> Muestras Calidad
            </button>
            <button
              onClick={() => setVistaActiva('CHECKLIST')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                vistaActiva === 'CHECKLIST'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" /> Checklist Recepción
            </button>
          </div>

      <button 
        onClick={fetchMuestras}
        disabled={loadingMuestras}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loadingMuestras ? 'animate-spin' : ''}`} /> Actualizar Lista
      </button>
    </div>
    {vistaActiva === 'MUESTRAS' && (
      <>
        {/* Tarjetas resumen (KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">En Análisis</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {muestras.filter(m => getMuestraData(m).estado.toUpperCase() === 'EN_ANALISIS').length}
            </p>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Aprobadas</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {muestras.filter(m => getMuestraData(m).estado.toUpperCase() === 'APROBADO').length}
            </p>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rechazadas</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              {muestras.filter(m => getMuestraData(m).estado.toUpperCase() === 'RECHAZADO').length}
            </p>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Recibidas</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{muestras.length}</p>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar muestra, lote o tanque..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full sm:w-auto bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="TODOS">Todas las muestras</option>
              <option value="EN_ANALISIS">En Análisis</option>
              <option value="APROBADO">Aprobadas</option>
              <option value="RECHAZADO">Rechazadas</option>
            </select>
          </div>
        </div>

        {/* Grid de Tarjetas de Muestras */}
        {loadingMuestras ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-cyan-500" />
            <p className="text-sm">Cargando muestras de laboratorio...</p>
          </div>
        ) : muestrasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl text-center">
            <FlaskConical className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-medium text-slate-300">No hay muestras para mostrar</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              {muestras.length > 0 
                ? 'No se encontraron muestras que coincidan con la búsqueda o el filtro actual.'
                : 'Las muestras aparecerán aquí automáticamente una vez que un tanque pase al estado "En Espera de Calidad".'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {muestrasFiltradas.map((muestra) => {
              const data = getMuestraData(muestra);
              const estadoUpper = String(data.estado || '').toUpperCase();
              const esPendiente = estadoUpper === 'PENDIENTE'
              const esFinalizada = estadoUpper === 'APROBADO' || estadoUpper === 'RECHAZADO' || estadoUpper === 'ACEPTADO';

              return (
                <div
                  key={data.id}
                  className="group bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-cyan-950/20"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">
                          Muestra #{data.id}
                        </span>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {data.codigo}
                        </h3>
                      </div>
                      {renderBadgeEstado(data.estado)}
                    </div>

                    <div className="space-y-2.5 text-sm border-t border-slate-800/80 pt-4 mb-4">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-cyan-400" /> Tanque Origen:
                        </span>
                        <span className="font-medium bg-slate-800 px-2.5 py-0.5 rounded text-slate-200">
                          {data.nombreTanque}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Lote de Prod.:</span>
                        <span className="font-semibold text-slate-200">{data.noLote}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Producto:</span>
                        <span className="font-medium text-slate-300 truncate max-w-[180px]" title={data.nombreProducto}>
                          {data.nombreProducto}
                        </span>
                      </div>

                      {data.nombreCliente && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-500" /> Registrado por:
                          </span>
                          <span className="font-medium text-slate-400 truncate max-w-[180px]" title={data.nombreCliente}>
                            {data.nombreCliente}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/40">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> 
                          {data.fecha ? new Date(data.fecha).toLocaleString('es-MX') : 'Fecha no disp.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800">
                    <button
                      onClick={() => abrirModalCaptura(muestra)}
                      disabled={esPendiente}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                        esPendiente
                          ? 'bg-slate-900/40 text-slate-500 border border-slate-800/80 cursor-not-allowed'
                          : esFinalizada
                          ? 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                          : 'bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 group-hover:border-cyan-500/50'
                      }`}
                    >
                      {esPendiente ? (
                        <>
                          <Clock className="w-4 h-4 text-slate-500" /> Muestra en Tránsito
                        </>
                      ) : esFinalizada ? (
                        <>
                          <Lock className="w-4 h-4 text-slate-400" /> Ver Dictamen (Finalizado)
                        </>
                      ) : (
                        <>
                          Capturar Resultados
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </>
    )}
    {/* ==================================================================== */}
      {/* VISTA 2: CHECKLIST MANTENIMIENTO (LOTES DE GRAFITO SUCIO) */}
      {/* ==================================================================== */}
      {vistaActiva === 'CHECKLIST' && (
        <div className="space-y-6">
          
          {/* KPIs Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pendientes de Checklist</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">2</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/30" />
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Con Incidencias</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">1</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-rose-500/30" />
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Completados Hoy</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">5</p>
              </div>
              <PackageCheck className="w-8 h-8 text-emerald-500/30" />
            </div>
          </div>

          {/* Tabla de Lotes Llegados para Inspección */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                Lotes de Grafito Sucio Arribados a Planta
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Lote</th>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5">Fecha Llegada</th>
                    <th className="p-3.5">Revisó</th>
                    <th className="p-3.5">Estatus Checklist</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-bold text-cyan-400">AR511-5-7961</td>
                    <td className="p-3.5">ORSA VFG-SUCIO</td>
                    <td className="p-3.5">11/09/2026</td>
                    <td className="p-3.5">JUAN</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                        PENDIENTE
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button 
                        onClick={() => setLoteSeleccionado({
                          lote: "AR511-5-7961",
                          producto: "ORSA VFG-SUCIO",
                          fecha: "11/09/2026",
                          reviso: "JUAN"
                        })}
                        className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Realizar Checklist
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* MODAL CHECKLIST CONTENEDORES (Mantenimiento) */}
      {/* ==================================================================== */}
      {loteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-8 text-slate-100">
            
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Checklist de Recepción - Lote <span className="text-cyan-400">{loteSeleccionado.lote}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Producto: {loteSeleccionado.producto} • Fecha: {loteSeleccionado.fecha} • Inspector: {loteSeleccionado.reviso}
                </p>
              </div>
              <button 
                onClick={() => setLoteSeleccionado(null)} 
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Captura de Tabla de Inspección según Hoja de Campo */}
            <div className="p-6 space-y-4">
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 text-center">No. Cons.</th>
                      <th className="p-2.5">No. Contenedor</th>
                      <th className="p-2.5 text-center">Tapa Válvula Dañada</th>
                      <th className="p-2.5 text-center">Rejilla Dañada</th>
                      <th className="p-2.5 text-center">Base Dañada</th>
                      <th className="p-2.5 text-center">Derrame</th>
                      <th className="p-2.5">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {[1, 2, 3].map((num) => (
                      <tr key={num} className="hover:bg-slate-800/20">
                        <td className="p-2.5 text-center font-bold">{num}</td>
                        <td className="p-2.5">
                          <input 
                            type="text" 
                            defaultValue="S/R" 
                            className="bg-slate-950 border border-slate-700/80 rounded px-2 py-1 w-24 text-slate-200"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input type="checkbox" className="w-4 h-4 accent-cyan-500 rounded" />
                        </td>
                        <td className="p-2.5 text-center">
                          <input type="checkbox" className="w-4 h-4 accent-cyan-500 rounded" />
                        </td>
                        <td className="p-2.5 text-center">
                          <input type="checkbox" className="w-4 h-4 accent-cyan-500 rounded" />
                        </td>
                        <td className="p-2.5 text-center">
                          <input type="checkbox" className="w-4 h-4 accent-rose-500 rounded" />
                        </td>
                        <td className="p-2.5">
                          <input 
                            type="text" 
                            placeholder="Ej. FAGOR 3RA VUELTA" 
                            className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-slate-200"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setLoteSeleccionado(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Guardar Checklist Mantenimiento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Formulario Captura */}
      {/* Modal Formulario Captura / Vista Detalle */}
      {muestraSeleccionada && (() => {
        const datosMuestra = getMuestraData(muestraSeleccionada);
        const estadoActual = String(datosMuestra.estado || '').toUpperCase();
        const esReadOnly = esModoLectura || estadoActual === 'APROBADO' || estadoActual === 'RECHAZADO' || estadoActual === 'ACEPTADO';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 text-slate-100">
              
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {esReadOnly ? 'Detalle de Análisis' : 'Captura de Análisis'} - <span className="text-cyan-400">{datosMuestra.codigo}</span>
                      {esReadOnly && (
                        <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-normal">
                          <Lock className="w-3 h-3" /> Solo Lectura
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {datosMuestra.nombreProducto} • Lote: {datosMuestra.noLote} • Tanque: {datosMuestra.nombreTanque || 'N/A'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={cerrarModal}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {esReadOnly ? (
                  /* ================= VISTA DE DETALLE (SÓLO LECTURA) ================= */
                  <div className="space-y-6">
                    
                    {/* Ficha Resumen de Dictamen */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                      <div>
                        <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider mb-1">Dictamen Emitido</span>
                        <div>{renderBadgeEstado(muestraSeleccionada.dictamen || muestraSeleccionada.estado_Muestra)}</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider mb-1">Tipo de Muestra</span>
                        <span className="text-sm font-semibold text-slate-200">
                          {datosMuestra.tipoMuestra}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider mb-1">Analista Responsable</span>
                        <span className="text-sm font-semibold text-slate-200">
                          {muestraSeleccionada.analista_Nombre || muestraSeleccionada.personas?.nombre || datosMuestra.nombreAnalista || 'No registrado'}
                        </span>
                      </div>
                    </div>

                    {/* Tabla de Parámetros Medidos */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Parámetros de Laboratorio Registrados
                      </h3>
                      {loadingEspecificaciones ? (
                        <p className="text-slate-400 text-sm italic">Cargando parámetros...</p>
                      ) : especificacionesGuardadas.length === 0 ? (
                        <div className="p-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                          No hay parámetros registrados para esta muestra.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                              <tr>
                                <th className="p-3">Parámetro</th>
                                <th className="p-3">Valor Obtenido</th>
                                <th className="p-3">Estatus</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                              {especificacionesGuardadas.map((spec: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-800/30">
                                  <td className="p-3 font-medium">
                                    {spec.parametros_laboratorio?.nombre_Parametro || 'N/A'}
                                  </td>
                                  <td className="p-3 font-mono text-cyan-400">
                                    {spec.valor_Obtenido_Num ?? 'N/A'}
                                  </td>
                                  <td className="p-3">
                                    {spec.cumple_Especificacion ? (
                                      <span className="text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        Cumple
                                      </span>
                                    ) : (
                                      <span className="text-rose-400 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                                        No Cumple
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Sección de Observaciones */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Observaciones de Calidad
                      </h3>
                      <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 text-sm min-h-[60px]">
                        {muestraSeleccionada.observaciones || 'Sin observaciones registradas.'}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-800">
                      <button
                        onClick={cerrarModal}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ================= VISTA DE FORMULARIO (EDICIÓN / CAPTURA) ================= */
                  <form onSubmit={guardarResultados} className="space-y-5">
                    
                    {/* Sección de Parámetros Dinámicos */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Parámetros de Laboratorio ({parametrosSeleccionados.length})
                        </h3>

                        {/* Controles para Agregar Parámetro faltante */}
                        {parametros.length > parametrosSeleccionados.length && (
                          <div className="flex items-center gap-2">
                            <select
                              value={parametroAAgregar}
                              onChange={(e) => setParametroAAgregar(e.target.value)}
                              className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            >
                              <option value="">+ Agregar otro parámetro...</option>
                              {parametros
                                .filter((p) => {
                                  const idParam = p.id_Parametro ?? p.id ?? 0;
                                  return !parametrosSeleccionados.includes(idParam);
                                })
                                .map((p) => {
                                  const idParam = p.id_Parametro ?? p.id ?? 0;
                                  const nombre = p.nombre_Parametro ?? p.nombre;
                                  return (
                                    <option key={idParam} value={idParam}>
                                      {nombre}
                                    </option>
                                  );
                                })}
                            </select>

                            <button
                              type="button"
                              onClick={handleAgregarParametro}
                              disabled={!parametroAAgregar}
                              className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                            >
                              Agregar
                            </button>
                          </div>
                        )}
                      </div>

                      {loadingParametros ? (
                        <p className="text-sm text-slate-400">Cargando parámetros...</p>
                      ) : parametrosSeleccionados.length === 0 ? (
                        <div className="p-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                          No hay parámetros seleccionados para esta prueba.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {parametros
                            .filter((p) => {
                              const idParam = p.id_Parametro ?? p.id ?? 0;
                              return parametrosSeleccionados.includes(idParam);
                            })
                            .map((p) => {
                              const idParam = p.id_Parametro ?? p.id ?? 0;
                              const nombre = p.nombre_Parametro ?? p.nombre ?? `Parámetro #${idParam}`;
                              const unidad = p.unidad_Medida ?? p.unidad;
                              const tipoDato = String(p.tipo_Dato ?? '').toUpperCase();
                              const esTexto = tipoDato === 'TEXTO';

                              return (
                                <div key={idParam} className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                                  <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                                      <span>{nombre}</span>
                                      {unidad && <span className="text-slate-500">({unidad})</span>}
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => handleEliminarParametro(idParam)}
                                      title="Quitar este parámetro de la captura"
                                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors text-xs"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <input
                                    type={esTexto ? "text" : "number"}
                                    step={esTexto ? undefined : "any"}
                                    required
                                    placeholder={esTexto ? "Ej. Cumple / Incoloro" : "0.00"}
                                    value={mediciones[idParam] || ''}
                                    onChange={(e) => handleMedicionChange(idParam, e.target.value)}
                                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                  />
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Tipo de muestra */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Tipo de Muestra
                      </label>
                      <select
                        value={tipoMuestra}
                        onChange={(e) => setTipoMuestra(e.target.value)}
                        className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-500/50 transition-all"
                      >
                        <option value="MUESTRA_INICIAL">MUESTRA INICIAL</option>
                        <option value="MUESTRA_EVAPOR_DESMETAL">MUESTRA EVAPOR DESMETAL</option>
                        <option value="MUESTRA_POR_AJUSTE">MUESTRA POR AJUSTE</option>
                        <option value="MUESTRA_AJUSTADO">MUESTRA AJUSTADO</option>
                      </select>
                    </div>

                    {/* Buscador / Creador de Analista */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Analista / Laboratorista
                      </label>
                      <input
                        type="text"
                        value={analistaNombre}
                        onChange={(e) => buscarAnalistas(e.target.value)}
                        onFocus={() => analistaNombre.length >= 2 && setMostrarSugerencias(true)}
                        placeholder="Escribe el nombre del analista..."
                        className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-500/50 transition-all"
                      />

                      {mostrarSugerencias && sugerenciasAnalistas.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl max-h-40 overflow-y-auto shadow-lg">
                          {sugerenciasAnalistas.map((item) => (
                            <li
                              key={item.id}
                              onClick={() => seleccionarAnalista(item.nombre)}
                              className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                              {item.nombre}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Dictamen Final */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Dictamen Final
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setDictamen('APROBADO')}
                          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                            dictamen === 'APROBADO'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" /> Aprobado
                        </button>
                        <button
                          type="button"
                          onClick={() => setDictamen('RECHAZADO')}
                          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                            dictamen === 'RECHAZADO'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <XCircle className="w-4 h-4" /> Rechazado
                        </button>
                      </div>
                    </div>

                    {/* Observaciones */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Observaciones
                      </label>
                      <textarea
                        rows={3}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Escribe comentarios o desviaciones sobre la prueba..."
                        className="w-full p-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={cerrarModal}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {submitting ? 'Guardando...' : 'Guardar Resultados'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })()}
  </div>
);
};

export default CalidadMuestrasScreen;