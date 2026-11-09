
'use client';
import { API_URL, apiFetch as fetch, sesionActual } from '@/utils/api';
import HistorialTiempos from '@/components/HistorialTiempos';
import FloatingModal from '@/components/FloatingModal';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';

interface ParametroLaboratorio {
  id_Parametro?: number;
  id?: number;
  nombre_Parametro?: string;
  nombre?: string;
  unidad_Medida?: string;
  unidad?: string;
  tipo_Dato?: string;
  }

  // Interface opcional para TypeScript
interface ContenedorState {
  no_consecutivo: number;
  numero_contenedor: string;
  tapa_valvula: boolean;
  rejilla_danada: boolean;
  base_danada: boolean;
  derrame: boolean;
  observaciones: string;
}

type FormulaGrafito =
  | 'HUMEDAD_INICIAL'
  | 'HUMEDAD_FINAL'
  | 'BROOKFIELD_INICIAL'
  | 'GRAFITO_INICIAL'
  | 'BROOKFIELD_FINAL'
  | 'GRAVEDAD_ESPECIFICA';

const normalizarCalidad = (valor: unknown) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

function resolverFormulaGrafito(
  nombre: string,
  categoria: string,
  esGrafito: boolean,
): FormulaGrafito | null {
  if (!esGrafito) return null;
  const parametro = normalizarCalidad(nombre);
  if (parametro.includes('GRAVEDAD ESPECIFICA')) return 'GRAVEDAD_ESPECIFICA';
  if (parametro.includes('HUMEDAD') && categoria === 'MUESTRA_INICIAL')
    return 'HUMEDAD_INICIAL';
  if (parametro.includes('HUMEDAD') && categoria === 'MUESTRA_EVAPOR_DESMETAL')
    return 'HUMEDAD_FINAL';
  if (parametro.includes('BROOKFIELD') && parametro.includes('SPIN 4') && categoria === 'MUESTRA_POR_AJUSTE')
    return 'BROOKFIELD_INICIAL';
  if (parametro.includes('BROOKFIELD') && parametro.includes('SPIN 4') && categoria === 'MUESTRA_AJUSTADO')
    return 'BROOKFIELD_FINAL';
  if (parametro.includes('GRAFITO') && categoria === 'MUESTRA_POR_AJUSTE')
    return 'GRAFITO_INICIAL';
  return null;
}

const camposFormulaGrafito: Record<FormulaGrafito, Array<{ key: string; label: string }>> = {
  HUMEDAD_INICIAL: [{ key: 'medicion', label: 'Lectura del medidor' }],
  HUMEDAD_FINAL: [{ key: 'medicion', label: 'Lectura del medidor' }],
  BROOKFIELD_INICIAL: [{ key: 'medicion', label: 'Lectura del viscosímetro' }],
  BROOKFIELD_FINAL: [{ key: 'medicion', label: 'Lectura del viscosímetro' }],
  GRAFITO_INICIAL: [
    { key: 'pesoFinal', label: 'Peso final' },
    { key: 'pesoPapel', label: 'Peso del papel' },
    { key: 'pesoMuestra', label: 'Peso de la muestra' },
  ],
  GRAVEDAD_ESPECIFICA: [
    { key: 'masaMuestra', label: 'Peso de la muestra' },
    { key: 'picometroVacio', label: 'Peso del picnómetro vacío' },
  ],
};

const descripcionFormulaGrafito: Record<FormulaGrafito, string> = {
  HUMEDAD_INICIAL: 'Resultado = lectura × 4',
  HUMEDAD_FINAL: 'Resultado = lectura × 10',
  BROOKFIELD_INICIAL: 'Viscosidad inicial = lectura Brookfield × 99',
  BROOKFIELD_FINAL: 'Viscosidad final = lectura Brookfield × 99',
  GRAFITO_INICIAL: '% grafito = ((peso final − peso papel) / peso muestra) × 100',
  GRAVEDAD_ESPECIFICA:
    'G.E. = (picnómetro lleno − picnómetro vacío) / 97.4729; lleno = muestra + picnómetro vacío',
};

function previsualizarFormulaGrafito(
  formula: FormulaGrafito,
  entradas: Record<string, string>,
): string | null {
  const numero = (key: string) => {
    const texto = entradas[key]?.trim();
    if (!texto) return null;
    const valor = Number(texto);
    return Number.isFinite(valor) ? valor : null;
  };
  let resultado: number | null = null;
  if (formula === 'HUMEDAD_INICIAL') {
    const lectura = numero('medicion');
    if (lectura !== null) resultado = lectura * 4;
  } else if (formula === 'HUMEDAD_FINAL') {
    const lectura = numero('medicion');
    if (lectura !== null) resultado = lectura * 10;
  } else if (formula === 'BROOKFIELD_INICIAL' || formula === 'BROOKFIELD_FINAL') {
    const lectura = numero('medicion');
    if (lectura !== null) resultado = lectura * 99;
  } else if (formula === 'GRAFITO_INICIAL') {
    const final = numero('pesoFinal');
    const papel = numero('pesoPapel');
    const muestra = numero('pesoMuestra');
    if (final !== null && papel !== null && muestra !== null && muestra > 0)
      resultado = ((final - papel) / muestra) * 100;
  } else if (formula === 'GRAVEDAD_ESPECIFICA') {
    const muestra = numero('masaMuestra');
    const vacio = numero('picometroVacio');
    if (muestra !== null && vacio !== null) {
      const lleno = muestra + vacio;
      resultado = (lleno - vacio) / 97.4729;
    }
  }
  return resultado !== null && Number.isFinite(resultado) ? resultado.toFixed(4) : null;
}


const CalidadMuestrasScreen: React.FC = () => {
  const socket = useSocket();
  const router = useRouter();
  const [sesionLista, setSesionLista] = useState(false);
  const [erroresCarga, setErroresCarga] = useState<Record<string, string>>({});
  useEffect(() => {
    const comprobar = () => {
      const sesion = sesionActual();
      const valida = Boolean(sesion?.token && sesion.area === 'calidad');
      setSesionLista(valida);
      if (!valida) router.replace(sesion?.area === 'produccion' ? '/tanques' : '/');
    };
    comprobar();
    window.addEventListener('sesion-cambiada', comprobar);
    window.addEventListener('storage', comprobar);
    return () => {
      window.removeEventListener('sesion-cambiada', comprobar);
      window.removeEventListener('storage', comprobar);
    };
  }, [router]);
  const [muestras, setMuestras] = useState<any[]>([]);
  const [loadingMuestras, setLoadingMuestras] = useState<boolean>(true);
  const [loadingMuestrasDictaminadas, setLoadingMuestrasDictaminadas] = useState<boolean>(true);
  const [muestrasDictaminadas, setMuestrasDictaminadas] = useState<any[]>([]);
  const [muestrasCertificadoPendiente, setMuestrasCertificadoPendiente] = useState<any[]>([]);
  const [loadingCertificados, setLoadingCertificados] = useState(false);
  const [subiendoCertificado, setSubiendoCertificado] = useState<number | null>(null);
  const [muestraCertificadoActiva, setMuestraCertificadoActiva] = useState<any>(null);
  const [errorCertificado, setErrorCertificado] = useState('');
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
  // Estados para datos recibidos del backend
  const [lotesLlegada, setLotesLlegada] = useState<any[]>([]);
  const [cargandoLotes, setCargandoLotes] = useState<boolean>(false);
  
  // Estados para el Modal de Checklist
  const [loteSeleccionado, setLoteSeleccionado] = useState<any | null>(null);
  const [revisoNombre, setRevisoNombre] = useState<string>('');
  const [guardandoChecklist, setGuardandoChecklist] = useState<boolean>(false);

  const [contenedores, setContenedores] = useState<ContenedorState[]>([]);
  const [contenedoresGrafito, setContenedoresGrafito] = useState<any[]>([]);
  const [resumenContenedores, setResumenContenedores] = useState<Record<string, number>>({});
  const [cargandoContenedoresGrafito, setCargandoContenedoresGrafito] = useState(false);
  const [contenedorRevisionActivo, setContenedorRevisionActivo] = useState<any | null>(null);
  const [confirmacionRevisionContenedor, setConfirmacionRevisionContenedor] = useState(false);
  const [guardandoAccionContenedor, setGuardandoAccionContenedor] = useState(false);
  const [formRevisionContenedor, setFormRevisionContenedor] = useState({
    tapa_valvula: false, rejilla_danada: false, base_danada: false, derrame: false, observaciones: '',
  });

// Pestañas de muestras, certificados y checklist de recepción.
  const [vistaActiva, setVistaActiva] = useState<'MUESTRAS' | 'CERTIFICADOS' | 'CHECKLIST' | 'CONTENEDORES'>('MUESTRAS');

  // Estado del Modal de Captura
  const [muestraSeleccionada, setMuestraSeleccionada] = useState<any | null>(null);
  const [parametros, setParametros] = useState<ParametroLaboratorio[]>([]);
  const [loadingParametros, setLoadingParametros] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediciones, setMediciones] = useState<{ [paramId: number]: string }>({});
  const [entradasCalculo, setEntradasCalculo] = useState<Record<number, Record<string, string>>>({});
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
    esGrafito: muestra.esGrafito ?? (
      normalizarCalidad(muestra.productos_materiales?.nombre_Producto).includes('GRAFITO') ||
      normalizarCalidad(muestra.lotes_produccion?.ordenes_produccion?.linea_Produccion).includes('GRAFITO')
    ),
  };
};

const cargarContenedoresGrafito = useCallback(async () => {
    setCargandoContenedoresGrafito(true);
    try {
      const response = await fetch(`${API_URL}/api/calidad/contenedores-grafito`);
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.message || data.error || 'No se pudieron cargar los contenedores de grafito');
      setErroresCarga((prev) => ({ ...prev, Contenedores: '' }));
      setContenedoresGrafito(Array.isArray(data.result) ? data.result : []);
      setResumenContenedores(data.resumen ?? {});
    } catch (error) {
      setErroresCarga((prev) => ({
        ...prev,
        Contenedores: error instanceof Error ? error.message : 'Error al cargar los contenedores',
      }));
    } finally {
      setCargandoContenedoresGrafito(false);
    }
  }, []);

  const cargarLotesLlegada = async () => {
    setCargandoLotes(true);
    try {
      const response = await fetch(
        `${API_URL}/api/calidad/obtenerOrdenesPendientesDeLlegada`
      );
      const res = await response.json();

      if (!response.ok || !res.success) {
        throw new Error(res.error || 'Error al obtener órdenes pendientes');
      }

      setLotesLlegada(res.result || []);
    } catch (error) {
      console.error('Error cargando órdenes pendientes de llegada:', error);
    } finally {
      setCargandoLotes(false);
    }
  };

  useEffect(() => {
    if (sesionLista && vistaActiva === 'CHECKLIST') void cargarLotesLlegada();
    if (sesionLista && vistaActiva === 'CONTENEDORES') void cargarContenedoresGrafito();
  }, [vistaActiva, sesionLista, cargarContenedoresGrafito]);

  useEffect(() => {
    if (!socket) return;
    const actualizarContenedores = () => {
      if (vistaActiva === 'CONTENEDORES') void cargarContenedoresGrafito();
    };
    socket.on('INVENTARIO_CONTENEDORES_ACTUALIZADO', actualizarContenedores);
    return () => socket.off('INVENTARIO_CONTENEDORES_ACTUALIZADO', actualizarContenedores);
  }, [socket, vistaActiva, cargarContenedoresGrafito]);

// ============================================================
  // MANEJO DEL MODAL Y EXTRACCIÓN DINÁMICA DE CONTENEDORES
  // ============================================================
  const abrirModalChecklist = (orden: any) => {
    setLoteSeleccionado(orden);
    setRevisoNombre('');

    // El detalle pertenece a la recepción, no al texto libre de la venta.
    const detalle = (orden.materiales ?? []).flatMap((m: any) =>
      (m.especificaciones?.contenedores ?? []).map((c: any) => ({...c, prensa: m.especificaciones?.atributos?.tipo_prensa ?? ''})));
    const contenedoresGenerados: ContenedorState[] = detalle.map((c: any, index: number) => ({
      no_consecutivo: index + 1, numero_contenedor: c.codigo,
      observaciones: c.prensa ? `Prensa: ${c.prensa}` : '', tapa_valvula: false, rejilla_danada: false,
      base_danada: false, derrame: false,
    }));
    setContenedores(contenedoresGenerados);
  };

  const handleContenedorChange = (index: number, field: keyof ContenedorState, value: any) => {
    const nuevos = [...contenedores];
    nuevos[index] = { ...nuevos[index], [field]: value };
    setContenedores(nuevos);
  };

  const agregarFilaContenedor = () => {
    setContenedores([
      ...contenedores,
      {
        no_consecutivo: contenedores.length + 1,
        numero_contenedor: 'S/R',
        tapa_valvula: false,
        rejilla_danada: false,
        base_danada: false,
        derrame: false,
        observaciones: '',
      },
    ]);
  };

  const eliminarFilaContenedor = (index: number) => {
    if (contenedores.length === 1) return;
    const filtrados = contenedores.filter((_, i) => i !== index);
    const reindexados = filtrados.map((item, idx) => ({ ...item, no_consecutivo: idx + 1 }));
    setContenedores(reindexados);
  };

// ============================================================
  // GUARDAR CHECKLIST (POST)
  // ============================================================
  const marcarLimpiezaContenedor = async (contenedor: any) => {
    if (guardandoAccionContenedor) return;
    setGuardandoAccionContenedor(true);
    try {
      const response = await fetch(`${API_URL}/api/calidad/contenedores-grafito/${contenedor.lote_inventario_id}/limpieza`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: contenedor.codigo }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.message || data.error || 'No se pudo registrar la limpieza');
      await cargarContenedoresGrafito();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo registrar la limpieza');
    } finally {
      setGuardandoAccionContenedor(false);
    }
  };

  const abrirRevisionContenedor = (contenedor: any) => {
    setContenedorRevisionActivo(contenedor);
    setConfirmacionRevisionContenedor(false);
    setFormRevisionContenedor({ tapa_valvula: false, rejilla_danada: false, base_danada: false, derrame: false, observaciones: '' });
  };

  const guardarRevisionContenedor = async () => {
    if (!contenedorRevisionActivo || !confirmacionRevisionContenedor || guardandoAccionContenedor) return;
    setGuardandoAccionContenedor(true);
    try {
      const response = await fetch(`${API_URL}/api/calidad/contenedores-grafito/${contenedorRevisionActivo.lote_inventario_id}/inspeccion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: contenedorRevisionActivo.codigo, ...formRevisionContenedor }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.message || data.error || 'No se pudo guardar la inspección');
      setContenedorRevisionActivo(null);
      await cargarContenedoresGrafito();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar la inspección');
    } finally {
      setGuardandoAccionContenedor(false);
    }
  };

const handleGuardarChecklist = async () => {
    if (!revisoNombre.trim()) {
      alert('Por favor ingresa el nombre de quien revisó.');
      return;
    }

    if (!loteSeleccionado) return;

    const tieneIncidencias = contenedores.some(
      (c) => c.tapa_valvula || c.rejilla_danada || c.base_danada || c.derrame
    );

    const payload = {
      no_lote: loteSeleccionado.no_lote ? String(loteSeleccionado.no_lote) : `ORD-${loteSeleccionado.id}`,
      recepcion_id: loteSeleccionado.id,
      reviso_nombre: revisoNombre.trim(),
      estado_checklist: tieneIncidencias ? 'CON_INCIDENCIAS' : 'COMPLETADO',
      fecha_llegada: loteSeleccionado.fecha_llegada,
      fecha_Revision: new Date().toISOString(),
      observaciones: {
        observaciones_orden: loteSeleccionado.observaciones || null,

      },
      contenedores: contenedores,
    };

    setGuardandoChecklist(true);

    try {
      const response = await fetch(`${API_URL}/api/calidad/crearLoteConChecklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        throw new Error(res.error || 'Error al guardar el checklist');
      }

      alert('¡Checklist guardado correctamente!');
      setLoteSeleccionado(null);
      setContenedores([]); // Limpiar la lista al cerrar
      cargarLotesLlegada();
    } catch (error: any) {
      console.error('Error al guardar checklist:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setGuardandoChecklist(false);
    }
  };

  // 1. Cargar Muestras desde la API
  const versionMuestras = useRef(0);
  const versionDictaminadas = useRef(0);
const versionCertificados = useRef(0);
  const fetchMuestras = useCallback(async () => {
    const version = ++versionMuestras.current;
    setLoadingMuestras(true);
    try {
      setErroresCarga(prev => ({ ...prev, 'Muestras': '' }));
      const res = await fetch(`${API_URL}/api/calidad/obtenerMuestras`);
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        const mensaje = detalle?.message || detalle?.error || res.statusText;
        throw new Error(`HTTP ${res.status}: ${Array.isArray(mensaje) ? mensaje.join(', ') : mensaje}`);
      }
      
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

      if (version === versionMuestras.current) setMuestras(lista);
    } catch (err) {
      setErroresCarga(prev => ({ ...prev, 'Muestras': err instanceof Error ? err.message : 'Error de conexión' }));
      console.error('Error al cargar muestras:', err);
    } finally {
      if (version === versionMuestras.current) setLoadingMuestras(false);
    }
  }, []);

const fetchMuestrasDictaminadas = useCallback(async () => {
  const version = ++versionDictaminadas.current;
  setLoadingMuestrasDictaminadas(true);
  try {
      setErroresCarga(prev => ({ ...prev, 'Muestras dictaminadas': '' }));
    const res = await fetch(`${API_URL}/api/calidad/obtenerMuestrasDictaminadas`);
    if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        const mensaje = detalle?.message || detalle?.error || res.statusText;
        throw new Error(`HTTP ${res.status}: ${Array.isArray(mensaje) ? mensaje.join(', ') : mensaje}`);
      }
    
    const data = await res.json();
    let lista = [];
    if (Array.isArray(data)) lista = data;
    else if (Array.isArray(data.result)) lista = data.result;
    else if (Array.isArray(data.data?.result)) lista = data.data.result;
    else if (Array.isArray(data.data)) lista = data.data;

    if (version === versionDictaminadas.current) setMuestrasDictaminadas(lista); // <--- Corrección aquí
  } catch (err) {
      setErroresCarga(prev => ({ ...prev, 'Muestras dictaminadas': err instanceof Error ? err.message : 'Error de conexión' }));
    console.error('Error al cargar muestras dictaminadas:', err);
  } finally {
    if (version === versionDictaminadas.current) setLoadingMuestrasDictaminadas(false);
  }
}, []);

const fetchCertificadosPendientes = useCallback(async () => {
  const version = ++versionCertificados.current;
  setLoadingCertificados(true);
  try {
    setErroresCarga(prev => ({ ...prev, 'Certificados pendientes': '' }));
    const res = await fetch(`${API_URL}/api/calidad/certificados/pendientes`);
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.message || data.error || 'No se pudieron cargar los certificados pendientes');
    if (version === versionCertificados.current)
      setMuestrasCertificadoPendiente(Array.isArray(data.result) ? data.result : []);
  } catch (error) {
    setErroresCarga(prev => ({
      ...prev,
      'Certificados pendientes': error instanceof Error ? error.message : 'Error de conexión',
    }));
  } finally {
    if (version === versionCertificados.current) setLoadingCertificados(false);
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

const parametrosPredeterminadosMuestra = (catalogo: ParametroLaboratorio[], muestra: any): number[] => {
  const datos = getMuestraData(muestra);
  const todos = catalogo.map((p) => Number(p.id_Parametro ?? p.id ?? 0)).filter((id) => id > 0);
  if (!datos.esGrafito) return todos;
  const tipo = String(datos.tipoMuestra ?? '').toUpperCase();
  const nombreParametro = (p: ParametroLaboratorio) => normalizarCalidad(p.nombre_Parametro ?? p.nombre ?? '');
  const elegir = (predicate: (nombre: string) => boolean) => {
    const candidato = catalogo.find((p) => predicate(nombreParametro(p)));
    const id = Number(candidato?.id_Parametro ?? candidato?.id ?? 0);
    return id > 0 ? id : null;
  };
  const esBrookfieldSpin4 = (nombre: string) =>
    nombre.includes('BROOKFIELD') && (nombre.includes('SPIN 4') || nombre.includes('SPIN4') || nombre.includes('SPINDLE 4') || nombre.includes('SPINDLE4'));
  const reglas: Record<string, Array<(nombre: string) => boolean>> = {
    MUESTRA_INICIAL: [(nombre) => nombre.includes('HUMEDAD')],
    MUESTRA_EVAPOR_DESMETAL: [(nombre) => nombre.includes('HUMEDAD'), (nombre) => nombre.includes('METAL')],
    MUESTRA_POR_AJUSTE: [esBrookfieldSpin4, (nombre) => nombre.includes('GRAFITO') && !nombre.includes('BROOKFIELD')],
    MUESTRA_AJUSTADO: [esBrookfieldSpin4, (nombre) => nombre.includes('GRAFITO') && !nombre.includes('BROOKFIELD'), (nombre) => nombre.includes('GRAVEDAD ESPECIFICA')],
  };
  const reglasTipo = reglas[tipo];
  if (!reglasTipo) return todos;
  return [...new Set(reglasTipo.map(elegir).filter((id): id is number => id !== null))];
};

  // 2. Cargar Parámetros de laboratorio desde la API
  const fetchParametros = useCallback(async () => {
    setLoadingParametros(true);
    try {
      setErroresCarga(prev => ({ ...prev, 'Parámetros': '' }));
      const res = await fetch(`${API_URL}/api/calidad/obtenerParametros`);
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        const mensaje = detalle?.message || detalle?.error || res.statusText;
        throw new Error(`HTTP ${res.status}: ${Array.isArray(mensaje) ? mensaje.join(', ') : mensaje}`);
      }
      
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
      return listaParametros;
    } catch (err) {
      setErroresCarga(prev => ({ ...prev, 'Parámetros': err instanceof Error ? err.message : 'Error de conexión' }));
      console.error('Error al cargar parámetros:', err);
      return [];
    } finally {
      setLoadingParametros(false);
    }
  }, []);

useEffect(() => {
    if (!sesionLista) return;
    const refrescar = () => {
      void fetchMuestras();
      void fetchMuestrasDictaminadas();
      void fetchCertificadosPendientes();
    };
    refrescar();
    fetchParametros();
    if (!socket) return;
    const eventos = ['connect', 'ESTATUS_TANQUE_CAMBIADO', 'MUESTRA_CREADA', 'MUESTRA_ACTUALIZADA'];
    eventos.forEach(evento => socket.on(evento, refrescar));
    return () => { eventos.forEach(evento => socket.off(evento, refrescar)); };
  }, [sesionLista, socket, fetchMuestras, fetchMuestrasDictaminadas, fetchCertificadosPendientes, fetchParametros]);

  const [accionTiempo, setAccionTiempo] = useState<number | null>(null);
  const [errorTiempo, setErrorTiempo] = useState('');
  const [muestraHistorial, setMuestraHistorial] = useState<number | null>(null);
  const ejecutarTiempo = async (id: number, accion: 'recibir' | 'iniciar' | 'reabrir') => {
    setAccionTiempo(id); setErrorTiempo('');
    try {
      const res = await fetch(`${API_URL}/api/calidad/${id}/${accion}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || 'No se pudo guardar');
      await Promise.all([fetchMuestras(), fetchMuestrasDictaminadas(), fetchCertificadosPendientes()]);
    } catch (error) { setErrorTiempo(error instanceof Error ? error.message : 'Error de conexión'); }
    finally { setAccionTiempo(null); }
  };

  const subirCertificado = async (muestraId: number, form: HTMLFormElement) => {
    setSubiendoCertificado(muestraId);
    setErrorCertificado('');
    try {
      const body = new FormData(form);
      const res = await fetch(`${API_URL}/api/calidad/muestras/${muestraId}/certificado`, {
        method: 'POST',
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.message || data.error || 'No se pudo guardar el certificado');
      form.reset();
      setMuestraCertificadoActiva(null);
      await Promise.all([fetchMuestras(), fetchMuestrasDictaminadas(), fetchCertificadosPendientes()]);
    } catch (error) {
      setErrorCertificado(error instanceof Error ? error.message : 'Error al cargar el certificado');
    } finally {
      setSubiendoCertificado(null);
    }
  };

  const descargarCertificado = async (muestraId: number, nombre: string) => {
    setErrorCertificado('');
    try {
      const res = await fetch(`${API_URL}/api/calidad/muestras/${muestraId}/certificado`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo descargar el certificado');
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = nombre || `certificado-muestra-${muestraId}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setErrorCertificado(error instanceof Error ? error.message : 'Error al descargar el certificado');
    }
  };

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
      const res = await fetch(`${API_URL}/api/calidad/${muestraData.id}/especificaciones`);
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
    setEntradasCalculo({});
    setObservaciones('');
    setDictamen('APROBADO');
    setAnalistaNombre('');
    setParametroAAgregar('');

    const catalogoParametros = parametros.length > 0 ? parametros : await fetchParametros();
    setParametrosSeleccionados(parametrosPredeterminadosMuestra(catalogoParametros, muestra));
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

  const handleEntradaCalculoChange = (paramId: number, campo: string, valor: string) => {
    setEntradasCalculo((prev) => ({
      ...prev,
      [paramId]: { ...(prev[paramId] ?? {}), [campo]: valor },
    }));
  };

const guardarResultados = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!muestraSeleccionada) return;

  const { id: idMuestra } = getMuestraData(muestraSeleccionada);

  setSubmitting(true);
  try {
    // El cliente envía lecturas crudas; el backend calcula y valida el resultado final.
    const datosMuestra = getMuestraData(muestraSeleccionada);
    const listaMediciones = parametrosSeleccionados.map((paramId) => {
      const parametro = parametros.find((p) => (p.id_Parametro ?? p.id ?? 0) === paramId);
      const nombre = parametro?.nombre_Parametro ?? parametro?.nombre ?? '';
      const formula = resolverFormulaGrafito(nombre, tipoMuestra, Boolean(datosMuestra.esGrafito));
      return {
        id_Parametro: paramId,
        valor: formula ? '' : String(mediciones[paramId] ?? ''),
        ...(formula ? { entradas: entradasCalculo[paramId] ?? {} } : {}),
      };
    });

    const respuesta = await fetch(`${API_URL}/api/calidad/finalizarAnalisis`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idMuestra: Number(idMuestra), mediciones: listaMediciones,
        dictamen, observaciones, analistaNombre: analistaNombre.trim() }),
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok || !resultado.success) throw new Error(resultado.message || resultado.error || 'No se pudo finalizar');
    await fetchMuestrasDictaminadas();
    cerrarModal();
    await fetchMuestras();
    const lotesLlegada = await cargarLotesLlegada()
    console.log("lotes llegada", lotesLlegada)
    
  } catch (err) {
    console.error('Error al registrar resultados de laboratorio:', err);
    setErrorTiempo(err instanceof Error ? err.message : 'No se pudo finalizar el análisis');
    alert(err instanceof Error ? err.message : 'No se pudo finalizar el análisis');
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
    const res = await fetch(`${API_URL}/api/calidad/buscarAnalistas?q=${encodeURIComponent(query)}`);
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

if (!sesionLista) return <p className="p-6">Verificando sesión…</p>;

return (
  <div className="p-6 bg-slate-950 min-h-screen text-slate-100 space-y-6">
      <div className="mb-4 flex flex-wrap gap-3"><a href="/trazabilidad" className="text-cyan-400 underline">Consultar y exportar tiempos</a></div>
      {Object.entries(erroresCarga).filter(([, mensaje]) => mensaje).map(([consulta, mensaje]) => (
        <p key={consulta} role="alert" className="rounded bg-red-900 p-3 text-white">{consulta}: {mensaje}</p>
      ))}
      {errorTiempo && <p role="alert" className="mb-4 rounded bg-red-900 p-3 text-white">{errorTiempo}</p>}
      {muestraHistorial && <HistorialTiempos entidad="MUESTRA" id={muestraHistorial} onClose={() => setMuestraHistorial(null)} />}

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
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex flex-wrap items-center">
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
            <button
              onClick={() => setVistaActiva('CONTENEDORES')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                vistaActiva === 'CONTENEDORES'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PackageCheck className="w-4 h-4" /> Contenedores
            </button>
            <button
              onClick={() => setVistaActiva('CERTIFICADOS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                vistaActiva === 'CERTIFICADOS'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PackageCheck className="w-4 h-4" /> Certificados pendientes
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px]">{muestrasCertificadoPendiente.length}</span>
            </button>
          </div>

      <button 
        onClick={() => void Promise.all([fetchMuestras(), fetchMuestrasDictaminadas(), fetchCertificadosPendientes(), cargarContenedoresGrafito()])}
        disabled={loadingMuestras || loadingCertificados || cargandoContenedoresGrafito}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loadingMuestras || loadingCertificados ? 'animate-spin' : ''}`} /> Actualizar Lista
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

                    {data.tipoMuestra === 'MUESTRA_AJUSTADO' && (
                      <div className="mb-3">
                        {muestra.certificado_calidad ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-700 bg-emerald-950/60 px-2 py-1 text-[11px] font-medium text-emerald-300">
                            Certificado cargado · {muestra.certificado_calidad.folio_Certificado}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-700 bg-amber-950/50 px-2 py-1 text-[11px] font-medium text-amber-200">
                            Sin certificado
                          </span>
                        )}
                      </div>
                    )}

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

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <p className="text-xs text-slate-300">Etapa: {muestra.tiempoActual?.fin ? 'FINALIZADA' : (muestra.tiempoActual?.etapa || 'SIN RECEPCIÓN REGISTRADA')} · Ciclo {muestra.tiempoActual?.ciclo || '—'}</p>
                    {!esFinalizada && (!muestra.tiempoActual || ['TRASLADO', 'REANALISIS_PENDIENTE'].includes(muestra.tiempoActual.etapa)) && (
                      <button type="button" disabled={accionTiempo !== null} onClick={() => ejecutarTiempo(Number(data.id), 'recibir')} className="w-full rounded bg-blue-700 p-2 text-white disabled:opacity-50">Recibir muestra</button>
                    )}
                    {!esFinalizada && muestra.tiempoActual?.etapa === 'ESPERA_ANALISIS' && !muestra.tiempoActual.fin && (
                      <button type="button" disabled={accionTiempo !== null} onClick={() => ejecutarTiempo(Number(data.id), 'iniciar')} className="w-full rounded bg-cyan-700 p-2 text-white disabled:opacity-50">Iniciar análisis</button>
                    )}
                    {esFinalizada && data.tipoMuestra !== 'MUESTRA_AJUSTADO' && <button type="button" disabled={accionTiempo !== null} onClick={() => ejecutarTiempo(Number(data.id), 'reabrir')} className="w-full rounded border border-amber-500 p-2 text-amber-300">Solicitar nuevo ciclo de análisis</button>}
                    {muestra.certificado_calidad && (
                      <button
                        type="button"
                        onClick={() => void descargarCertificado(Number(data.id), muestra.certificado_calidad.documento_nombre)}
                        className="w-full rounded border border-emerald-700 p-2 text-emerald-300"
                      >
                        Descargar certificado de calidad
                      </button>
                    )}
                    <button type="button" onClick={() => setMuestraHistorial(Number(data.id))} className="w-full rounded border p-2 text-slate-300">Ver tiempos e historial</button>
                    <button
                      onClick={() => abrirModalCaptura(muestra)}
                      disabled={!esFinalizada && (muestra.tiempoActual?.etapa !== 'ANALISIS' || Boolean(muestra.tiempoActual?.fin))}
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
    {vistaActiva === 'CERTIFICADOS' && (
      <section className="space-y-5">
        <div className="rounded-xl border border-cyan-900 bg-cyan-950/30 p-4">
          <h2 className="font-semibold text-cyan-100">Certificados de muestras Ajustado aprobadas</h2>
          <p className="mt-1 text-sm text-slate-300">Al guardar el PDF, el lote cambia de Aprobado a Liberado. Solo aparecen muestras aprobadas que aún no tienen certificado.</p>
        </div>
        {errorCertificado && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-200">{errorCertificado}</p>}
        {loadingCertificados ? (
          <p className="text-slate-400">Cargando muestras pendientes de certificado…</p>
        ) : muestrasCertificadoPendiente.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-300">No hay muestras Ajustado aprobadas pendientes de certificado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {muestrasCertificadoPendiente.map((muestra) => (
              <article key={muestra.id_Muestra} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <div>
                  <h3 className="font-semibold text-white">Muestra {muestra.no_Muestra} · Lote {muestra.lotes_produccion?.no_Lote}</h3>
                  <p className="mt-1 text-sm text-slate-400">{muestra.productos_materiales?.nombre_Producto} · {muestra.equipos_tanques?.nombre_Equipo ?? 'Sin tanque'} · {muestra.fecha_Toma ? new Date(muestra.fecha_Toma).toLocaleDateString('es-MX') : 'Sin fecha'}</p>
                  {muestra.observaciones && <p className="mt-2 text-sm text-slate-300">{muestra.observaciones}</p>}
                </div>
                <button type="button" onClick={() => setMuestraCertificadoActiva(muestra)} disabled={subiendoCertificado !== null} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Agregar certificado y liberar lote</button>
              </article>
            ))}
          </div>
        )}
      </section>
    )}
    {muestraCertificadoActiva && <FloatingModal
      title="Adjuntar certificado de calidad"
      description={`Muestra ${muestraCertificadoActiva.no_Muestra} · Lote ${muestraCertificadoActiva.lotes_produccion?.no_Lote ?? 'sin lote'}`}
      onClose={() => setMuestraCertificadoActiva(null)}
      closeDisabled={subiendoCertificado !== null}
      theme="dark"
    >
      {errorCertificado && <p role="alert" className="mb-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{errorCertificado}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void subirCertificado(muestraCertificadoActiva.id_Muestra, event.currentTarget); }} className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">Folio del certificado<input required name="folio_Certificado" maxLength={50} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">Número de certificado<input required name="no_Certificado" maxLength={50} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">Fecha de emisión<input required type="date" name="fecha_Emision" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">Documento PDF (máximo 10 MB)<input required type="file" name="documento" accept="application/pdf,.pdf" className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" /></label>
        <button type="submit" disabled={subiendoCertificado !== null} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
          {subiendoCertificado === muestraCertificadoActiva.id_Muestra ? 'Guardando certificado…' : 'Guardar certificado y liberar lote'}
        </button>
      </form>
    </FloatingModal>}
    {/* ==================================================================== */}
      {/* VISTA 2: CHECKLIST MANTENIMIENTO (LOTES DE GRAFITO SUCIO) */}
      {/* ==================================================================== */}
      {vistaActiva === 'CONTENEDORES' && (
        <section className="space-y-5">
          <div className="rounded-xl border border-cyan-900 bg-cyan-950/30 p-4">
            <h2 className="font-semibold text-cyan-100">Control de contenedores de grafito</h2>
            <p className="mt-1 text-sm text-slate-300">El contenido se calcula desde los movimientos de inventario. La reserva solo compromete kilos; no vacía el contenedor. La recepción y su checklist inicial se muestran desde el lote de llegada.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {([
              ['Llenos', resumenContenedores.LLENO ?? 0, 'text-cyan-300'],
              ['Checklist inicial pendiente', resumenContenedores.PENDIENTE_CHECKLIST ?? 0, 'text-amber-300'],
              ['Vacíos sucios', resumenContenedores.VACIO_SUCIOS ?? 0, 'text-rose-300'],
              ['Vacíos limpios', resumenContenedores.VACIO_LIMPIOS ?? 0, 'text-sky-300'],
              ['Listos para rellenar', resumenContenedores.LISTO_PARA_RELLENAR ?? 0, 'text-emerald-300'],
            ] as const).map(([label, value, color]) => (
              <article key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
              </article>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400">
                <tr><th className="p-3">Lote de inventario</th><th className="p-3">Contenedor</th><th className="p-3">Prensa</th><th className="p-3">Contenido</th><th className="p-3">Estado</th><th className="p-3">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cargandoContenedoresGrafito ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400">Cargando contenedores…</td></tr>
                ) : contenedoresGrafito.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No hay contenedores de grafito con especificaciones registradas.</td></tr>
                ) : contenedoresGrafito.map((item) => (
                  <tr key={`${item.lote_inventario_id}-${item.codigo}`}>
                    <td className="p-3"><span className="block font-semibold text-white">{item.folio}</span><span className="text-xs text-slate-500">{item.recepcion_folio ? `Recepción ${item.recepcion_folio}` : 'Inventario de apertura o producción'}</span></td>
                    <td className="p-3 font-medium text-cyan-200">{item.codigo}</td>
                    <td className="p-3">{item.prensa || 'Sin prensa'}</td>
                    <td className="p-3">{item.saldo_kg} / {item.peso_kg} kg</td>
                    <td className="p-3">
                      <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-semibold">{String(item.estado).replaceAll('_', ' ')}</span>
                      {item.pendiente_checklist_inicial && <span className="ml-1 inline-flex rounded-full border border-amber-700 bg-amber-950/50 px-2 py-1 text-[11px] font-semibold text-amber-200">Checklist inicial pendiente</span>}
                      {item.estado_revision === 'RECHAZADO' && <span className="ml-1 inline-flex rounded-full border border-rose-700 bg-rose-950/50 px-2 py-1 text-[11px] font-semibold text-rose-200">Requiere nueva limpieza</span>}
                    </td>
                    <td className="p-3">
                      {item.estado === 'VACIO_SUCIO' && <button type="button" disabled={guardandoAccionContenedor} onClick={() => void marcarLimpiezaContenedor(item)} className="rounded-lg border border-cyan-700 px-3 py-1.5 text-xs font-semibold text-cyan-200 disabled:opacity-50">Registrar limpieza</button>}
                      {item.estado === 'VACIO_LIMPIO' && <button type="button" disabled={guardandoAccionContenedor} onClick={() => abrirRevisionContenedor(item)} className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50">Inspeccionar para relleno</button>}
                      {item.estado === 'LISTO_PARA_RELLENAR' && <span className="text-xs font-semibold text-emerald-300">Disponible para rellenar</span>}
                      {['LLENO', 'PARCIAL'].includes(item.estado) && <span className="text-xs text-slate-500">En inventario</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {vistaActiva === 'CHECKLIST' && (
        <div className="space-y-6">
          {/* KPIs Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Pendientes de Checklist
                </p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{lotesLlegada.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/30" />
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Con Incidencias</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">0</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-rose-500/30" />
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Completados Hoy</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">0</p>
              </div>
              <PackageCheck className="w-8 h-8 text-emerald-500/30" />
            </div>
          </div>

          {/* Tabla de Lotes Llegados para Inspección */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                Recepciones de materiales pendientes de checklist
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Recepción</th>
                    <th className="p-3.5">Remitente / Observación</th>
                    <th className="p-3.5">Fecha Llegada</th>
                    <th className="p-3.5">Materiales</th>
                    <th className="p-3.5">Estatus Checklist</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cargandoLotes ? (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-slate-400">
                        Cargando órdenes pendientes...
                      </td>
                    </tr>
                  ) : lotesLlegada.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-slate-500">
                        No hay recepciones pendientes de revisión.
                      </td>
                    </tr>
                  ) : (
                    lotesLlegada.map((orden) => (
                      <tr key={orden.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-bold text-cyan-400">
                          {orden.no_lote || `ORD-${orden.id}`}
                        </td>
                        <td className="p-3.5 text-xs text-slate-300">
                          <span className="block font-semibold text-slate-200">{orden.remitente?.nombre}</span>
                          <span className="text-slate-400">{orden.observaciones || 'N/A'}</span>
                        </td>
                        <td className="p-3.5">
                          {orden.fecha_llegada
                            ? new Date(orden.fecha_llegada).toLocaleDateString('es-MX', { timeZone: 'UTC' })
                            : 'S/N'}
                        </td>
                        <td className="p-3.5 font-medium">{orden.materiales?.map((m: any) => m.producto.nombre_Producto).join(', ') || 'Sin materiales'}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            PENDIENTE
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => abrirModalChecklist(orden)}
                            className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Realizar Checklist
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
{/* ==================================================================== */}
      {contenedorRevisionActivo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold">Inspección del contenedor para relleno</h2>
              <p className="text-sm text-slate-400">{contenedorRevisionActivo.folio} · {contenedorRevisionActivo.codigo}</p>
            </div>
            <p className="text-xs text-slate-400">Marca los defectos observados. Si todos están desmarcados y confirmas la revisión, el envase quedará listo para rellenar.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['tapa_valvula', 'Tapa o válvula dañada'],
                ['rejilla_danada', 'Rejilla dañada'],
                ['base_danada', 'Base dañada'],
                ['derrame', 'Derrame o fuga'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
                  <input type="checkbox" checked={formRevisionContenedor[key]} onChange={(e) => setFormRevisionContenedor((prev) => ({ ...prev, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <label className="block text-sm text-slate-300">Observaciones<textarea value={formRevisionContenedor.observaciones} onChange={(e) => setFormRevisionContenedor((prev) => ({ ...prev, observaciones: e.target.value }))} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
            <label className="flex items-start gap-2 text-xs text-slate-300"><input type="checkbox" checked={confirmacionRevisionContenedor} onChange={(e) => setConfirmacionRevisionContenedor(e.target.checked)} />Confirmo que inspeccioné físicamente tapa/válvula, rejilla, base y fugas.</label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setContenedorRevisionActivo(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancelar</button>
              <button type="button" disabled={!confirmacionRevisionContenedor || guardandoAccionContenedor} onClick={() => void guardarRevisionContenedor()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold disabled:opacity-50">{guardandoAccionContenedor ? 'Guardando…' : 'Guardar inspección'}</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CHECKLIST CONTENEDORES */}
      {/* ==================================================================== */}
      {loteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-8 text-slate-100">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Checklist de recepción{' '}
                  <span className="text-cyan-400">
                    {loteSeleccionado.no_lote || `ORD-${loteSeleccionado.id}`}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Línea: {loteSeleccionado.remitente?.nombre} • Fecha Llegada:{' '}
                  {loteSeleccionado.fecha_llegada
                    ? new Date(loteSeleccionado.fecha_llegada).toLocaleDateString('es-MX', { timeZone: 'UTC' })
                    : 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setLoteSeleccionado(null)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Campo Inspector */}
              <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nombre de quien revisa <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={revisoNombre}
                    onChange={(e) => setRevisoNombre(e.target.value)}
                    placeholder="Ej. JUAN PÉREZ"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Observaciones de la Orden</label>
                  <p className="text-xs text-slate-300 pt-2">{loteSeleccionado.observaciones || 'Sin observaciones'}</p>
                </div>
              </div>

              {/* Tabla de Contenedores */}
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold uppercase text-slate-400">Inspección por Contenedor</h4>
                <button
                  type="button"
                  onClick={agregarFilaContenedor}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Fila
                </button>
              </div>

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
                      <th className="p-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {contenedores.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-800/20">
                        <td className="p-2.5 text-center font-bold">{item.no_consecutivo}</td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.numero_contenedor}
                            onChange={(e) => handleContenedorChange(index, 'numero_contenedor', e.target.value)}
                            className="bg-slate-950 border border-slate-700/80 rounded px-2 py-1 w-28 text-slate-200 text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.tapa_valvula}
                            onChange={(e) => handleContenedorChange(index, 'tapa_valvula', e.target.checked)}
                            className="w-4 h-4 accent-cyan-500 rounded"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.rejilla_danada}
                            onChange={(e) => handleContenedorChange(index, 'rejilla_danada', e.target.checked)}
                            className="w-4 h-4 accent-cyan-500 rounded"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.base_danada}
                            onChange={(e) => handleContenedorChange(index, 'base_danada', e.target.checked)}
                            className="w-4 h-4 accent-cyan-500 rounded"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.derrame}
                            onChange={(e) => handleContenedorChange(index, 'derrame', e.target.checked)}
                            className="w-4 h-4 accent-rose-500 rounded"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.observaciones}
                            onChange={(e) => handleContenedorChange(index, 'observaciones', e.target.value)}
                            placeholder="Ej. FAGOR 3RA VUELTA"
                            className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          {contenedores.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarFilaContenedor(index)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Acciones */}
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
                  disabled={guardandoChecklist}
                  onClick={handleGuardarChecklist}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {guardandoChecklist ? 'Guardando...' : 'Guardar Checklist Mantenimiento'}
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
                                    <span className="block text-xs text-slate-500">Ciclo {spec.ciclo_analisis ?? 'histórico sin ciclo'} · {spec.fecha_Resultado ? new Date(spec.fecha_Resultado).toLocaleString('es-MX') : ''}</span>
                                  </td>
                                  <td className="p-3 font-mono text-cyan-400">
                                     {spec.valor_Obtenido_Num ?? spec.valor_Obtenido_Texto ?? 'N/A'}
                                     {spec.calculo_aplicado?.formula && (
                                       <span className="block mt-1 max-w-md whitespace-normal font-sans text-[11px] leading-4 text-slate-500">
                                         {spec.calculo_aplicado.formula}
                                         {spec.calculo_aplicado.entradas && ' · ' + Object.entries(spec.calculo_aplicado.entradas)
                                           .map(([clave, valor]) => clave + ': ' + String(valor))
                                           .join(' · ')}
                                       </span>
                                     )}
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
                              const nombre = p.nombre_Parametro ?? p.nombre ?? ('Parámetro #' + idParam);
                              const unidad = p.unidad_Medida ?? p.unidad;
                              const tipoDato = String(p.tipo_Dato ?? '').toUpperCase();
                              const esTexto = tipoDato === 'TEXTO';
                              const esBooleano = tipoDato === 'BOOLEANO' || normalizarCalidad(nombre).includes('METALES');
                              const datosMuestra = getMuestraData(muestraSeleccionada);
                              const formula = resolverFormulaGrafito(nombre, tipoMuestra, Boolean(datosMuestra.esGrafito));
                              const entradas = entradasCalculo[idParam] ?? {};
                              const vistaPrevia = formula ? previsualizarFormulaGrafito(formula, entradas) : null;

                              return (
                                <div key={idParam} className="space-y-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
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

                                  {formula ? (
                                    <div className="space-y-2">
                                      <p className="text-[11px] text-cyan-300">{descripcionFormulaGrafito[formula]}</p>
                                      {camposFormulaGrafito[formula].map((campo) => (
                                        <label key={campo.key} className="block space-y-1">
                                          <span className="text-[11px] text-slate-400">{campo.label}</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            required
                                            placeholder="0.0000"
                                            value={entradas[campo.key] ?? ''}
                                            onChange={(e) => handleEntradaCalculoChange(idParam, campo.key, e.target.value)}
                                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                          />
                                        </label>
                                      ))}
                                      {formula === 'GRAVEDAD_ESPECIFICA' && (
                                        <p className="text-[10px] text-slate-500">El peso del picnómetro lleno se obtiene sumando el peso de la muestra y el peso vacío.</p>
                                      )}
                                      {vistaPrevia !== null && (
                                        <p className="text-xs font-medium text-emerald-300">Resultado calculado: {vistaPrevia}{unidad ? ' ' + unidad : ''}</p>
                                      )}
                                    </div>
                                  ) : esBooleano ? (
                                    <select
                                      required
                                      value={mediciones[idParam] || ''}
                                      onChange={(e) => handleMedicionChange(idParam, e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    >
                                      <option value="">Selecciona una respuesta</option>
                                      <option value="SI">Sí</option>
                                      <option value="NO">No</option>
                                    </select>
                                  ) : (
                                    <input
                                      type={esTexto ? 'text' : 'number'}
                                      step={esTexto ? undefined : 'any'}
                                      required
                                      placeholder={esTexto ? 'Ej. Cumple / Incoloro' : '0.00'}
                                      value={mediciones[idParam] || ''}
                                      onChange={(e) => handleMedicionChange(idParam, e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* El tipo está definido al crear la muestra; Calidad no puede cambiarlo al dictaminar. */}
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
