'use client';

import { useState, useEffect } from 'react';
import { Tanque, ContenedorGrafito, EstadoTanqueStatus, statusTanque, ProductoGrafito } from '@/types/tanques';
import { Area, Rol, EstadoFlujo, ESTADOS_FLUJO, VentaFlujo } from '@/types/flujo';
import TanqueCard from '@/components/TanqueCard';
import { useSocket } from '@/context/SocketContext';

let data: any;

export interface RegistroBitacora {
  id: string;
  fechaHora: string;

  tipoAccion:
    | 'LLENADO'
    | 'RELLENADO'
    | 'CAMBIO_TANQUE'
    | 'VACIADO'
    | 'CAMBIO_PROCESO';

  tanqueOrigen?: string;
  tanqueDestino?: string;

  lote: string;
  producto: string;
  cantidad: number;

  estadoAnterior?: string;
  estadoNuevo?: string;

  observaciones?: string;
}

export default function InventarioTanquesPage() {
  const socket = useSocket(); // 2. Obtener la instancia del socket activa
  const [tanques, setTanques] = useState<Tanque[]>([]);
  const [inventario, setInventario] = useState<ContenedorGrafito[]>([]);
  const [bitacora, setBitacora] = useState<RegistroBitacora[]>([]);
  const [cargando, setCargando] = useState(true);

const [muestrasDictaminadas, setMuestrasDictaminadas] = useState<any[]>([]);

  // Modales
  const [itemACargar, setItemACargar] = useState<ContenedorGrafito | null>(null);
  const [cantidadACargar, setCantidadACargar] = useState<number>(1);
  const [tanqueSeleccionado, setTanqueSeleccionado] = useState<number | null>(null);
  const [mostrarModalNuevoSucio, setMostrarModalNuevoSucio] = useState(false);

  // Modal Trasvase / Mover de Tanque
  const [tanqueAMover, setTanqueAMover] = useState<Tanque | null>(null);
  const [tanqueDestinoId, setTanqueDestinoId] = useState<number | null>(null);

  // Formulario nuevo grafito

  const [flujos, setFlujos] = useState<VentaFlujo[]>([]);
  const [flujoSeleccionado, setFlujoSeleccionado] = useState<VentaFlujo | null>(null);

  const [nuevoProducto, setNuevoProducto] = useState<ProductoGrafito>('Forgemaster');
  const [nuevoLote, setNuevoLote] = useState('');
  const [nuevaCantidad, setNuevaCantidad] = useState<number>(1);
  const [nuevaVuelta, setNuevaVuelta] = useState('');

  // 1. CARGA INICIAL (Carga Tanques de GRAFITO + Ordenes)
useEffect(() => {
    fetchDataDB();
  }, []);

// 3. Listener de Sockets en tiempo real (Sincronización con Calidad y otras pantallas)
  useEffect(() => {
    if (!socket) return;

    // Escuchar cuando Calidad u otro usuario cambia el estatus o asigna un tanque
    socket.on('TANQUE_ACTUALIZADO', () => {
      fetchDataDB(); // O actualizar el estado local dinámicamente
    });

    socket.on('ESTATUS_TANQUE_CAMBIADO', (data: { tanqueId: number; estatus: EstadoTanqueStatus }) => {
      setTanques((prevTanques) =>
        prevTanques.map((t) =>
          t.id === data.tanqueId ? { ...t, estatus_proceso: data.estatus } : t
        )
      );
    });

    return () => {
      socket.off('TANQUE_ACTUALIZADO');
      socket.off('ESTATUS_TANQUE_CAMBIADO');
    };
  }, [socket]);

const fetchDataDB = async () => {
    try {
      setCargando(true);

      const resTanques = await fetch('http://localhost:4002/api/produccion/tanques?tipo=GRAFITO');
      const dataTanques = await resTanques.json();

      const mapaTanques: { [key: number]: Tanque } = {};

      if (dataTanques.success && Array.isArray(dataTanques.result)) {
        dataTanques.result.forEach((t: any) => {
          const idNum = Number(t.id_Equipos_Tanques);
          const rawStatus = t.estatus_proceso || 'VACIO';

          mapaTanques[idNum] = {
            id: idNum,
            nombre: t.nombre_Equipo || t.codigo_Equipo,
            prensa: '-',
            cantidad: 0,
            estatus_proceso: rawStatus as EstadoTanqueStatus,
            status: t.status as statusTanque,
            loteActual: null,
          };
        });
      }

      const res = await fetch('http://localhost:4002/api/produccion/test');
      data = await res.json();

      const regexObservaciones = /PRENSA\s+([A-Z0-9_-]+)\s*-\s*(\d+)\s+CONTENEDORES/i;
      const grafitosExtraidos: ContenedorGrafito[] = [];

      if (Array.isArray(data?.result)) {
        data.result.forEach((orden: any, index: number) => {
          if (!orden.observaciones) return;

          const subObservaciones = orden.observaciones.split(';');

          subObservaciones.forEach((subObs: string) => {
            const match = subObs.trim().match(regexObservaciones);

            if (match) {
              const rawProducto = match[1].trim();
              const cantidad = parseInt(match[2], 10);

              let producto: ProductoGrafito = 'Forgemaster';
              if (/polymaster/i.test(rawProducto)) producto = 'Polymaster';
              else if (/fagor/i.test(rawProducto)) producto = 'Fagor';

              const loteObj = orden.lotes_produccion?.[0];
              const loteNo = loteObj?.no_Lote || `LT-${Math.floor(1000 + Math.random() * 9000)}`;
              
              const tanqueIdAsignado = loteObj?.tanque_id !== null && loteObj?.tanque_id !== undefined 
                ? Number(loteObj.tanque_id) 
                : null;

              const idVentaOrigenVal = orden.id_Venta_Origen !== undefined && orden.id_Venta_Origen !== null
                ? Number(orden.id_Venta_Origen)
                : null;

              const contenedorObj: ContenedorGrafito & { idVentaOrigen?: number | null } = {
                id: `api-obs-${orden.id_Orden_Produc || index}-${Math.random().toString(36).substring(2, 7)}`,
                producto,
                lote: loteNo,
                idLoteProduccion: loteObj?.id_Lote_Produccion,
                idVentaOrigen: idVentaOrigenVal,
                cantidadContenedores: cantidad,
                categoria: 'SUCIO',
              };

              if (tanqueIdAsignado !== null && mapaTanques[tanqueIdAsignado]) {
                mapaTanques[tanqueIdAsignado].loteActual = contenedorObj;
              } else {
                grafitosExtraidos.push(contenedorObj);
              }
            }
          });
        });
      }

      const inventarioExistente = Array.isArray(data.inventario) ? data.inventario : [];
      
      setTanques(Object.values(mapaTanques));
      setInventario([...inventarioExistente, ...grafitosExtraidos]);
      if (Array.isArray(data.bitacora)) setBitacora(data.bitacora);

    } catch (e) {
      console.error('Error al cargar datos iniciales:', e);
    } finally {
      setCargando(false);
    }
  };

  // Helper para actualizar tanque_id en Lotes
const ejecutarActualizarTanqueBD = async (idLoteProduccion: number, tanqueId: number | null) => {
    try {
      await fetch('http://localhost:4002/api/produccion/actualizar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idLoteProduccion, tanqueId }),
      });
    } catch (error) {
      console.error('Error al actualizar tanque_id en la BD:', error);
    }
  };

  // Helper para actualizar estatus de proceso del Tanque con idVentaOrigen
const ejecutarActualizarEstatusTanqueBD = async (
    tanqueId: number, 
    estatus_proceso: string, 
    idVentaOrigen: number | null = null
  ) => {
    try {
      const estatusBD = estatus_proceso.replace(/\s+/g, '_');
      const res = await fetch('http://localhost:4002/api/produccion/actualizarEstatusTanque', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tanqueId: Number(tanqueId), 
          estatus_proceso: estatusBD, 
          idVentaOrigen: idVentaOrigen ? Number(idVentaOrigen) : null 
        }),
      });

      // 4. Si la base de datos se actualiza correctamente, emitimos el socket
      if (res.ok && socket) {
        socket.emit('actualizar_estatus_tanque', {
          tanqueId: Number(tanqueId),
          estatus_proceso: estatusBD,
          idVentaOrigen,
        });
      }
    } catch (error) {
      console.error('Error al actualizar estatus de proceso en la BD:', error);
    }
  };

  // Helper para actualizar el estado de calidad en los Lotes de Producción
const ejecutarActualizarEstatusCalidadBD = async (idLoteProduccion: number) => {
  try {
    const res = await fetch('http://localhost:4002/api/produccion/actualizarEstatusCalidad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idLoteProduccion: Number(idLoteProduccion),
        estadoCalidad: 'LIBERADO',
      }),
    });

    if (!res.ok) {
      console.error('Error al actualizar el estatus de calidad en el servidor.');
    }
  } catch (error) {
    console.error('Error de red al actualizar estatus de calidad:', error);
  }
};

const guardarRegistroBitacora = async (
  idLoteProduccion: number,
  registro: RegistroBitacora
) => {
  try {
    const response = await fetch(
      'http://localhost:4002/api/produccion/guardarBitacora',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idLoteProduccion,
          registro,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || 'No se pudo guardar la bitácora'
      );
    }

    // Actualizamos la UI con el registro que acabamos de guardar
    setBitacora(data.data.bitacora);

    return data.data.bitacora;
  } catch (error) {
    console.error(
      'Error al guardar registro de bitácora:',
      error
    );

    return null;
  }
};

const persistirEnDB = async (
  nuevosTanques: Tanque[],
  nuevoInventario: ContenedorGrafito[]
) => {
  setTanques(nuevosTanques);
  setInventario(nuevoInventario);

  try {
    await fetch('/api/grafito', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tanques: nuevosTanques,
        inventario: nuevoInventario,
      }),
    });
  } catch (e) {
    console.error(
      'Error al guardar estado en el JSON:',
      e
    );
  }
};

  const cargarMuestrasDictaminadas = async () => {
  try {
    const response = await fetch('http://localhost:4002/api/calidad/obtenerMuestrasDictaminadas');
    const res = await response.json();
    console.log(res)
    
    if (res.success && res.data?.result) {
      setMuestrasDictaminadas(res.data.result);
    }
  } catch (error) {
    console.error("Error cargando muestras dictaminadas:", error);
  }
};

// 3. Ejecutar al cargar la página (junto con tus otras peticiones)
useEffect(() => {
  cargarMuestrasDictaminadas();
}, []);

// 4. Muestras filtradas / Contadores calculados
const muestrasAprobadas = muestrasDictaminadas.filter(m => m.estado_Muestra === 'APROBADO');
const muestrasRechazadas = muestrasDictaminadas.filter(m => m.estado_Muestra === 'RECHAZADO');

  // Totales
  const totalLiberados = inventario.filter(i => i.categoria === 'LIBERADO').reduce((a, b) => a + b.cantidadContenedores, 0);
  const totalRezagados = inventario.filter(i => i.categoria === 'REZAGADO').reduce((a, b) => a + b.cantidadContenedores, 0);
  const totalFE = inventario.filter(i => i.categoria === 'FE').reduce((a, b) => a + b.cantidadContenedores, 0);
  const totalNuevos = inventario.filter(i => i.categoria === 'NUEVO').reduce((a, b) => a + b.cantidadContenedores, 0);
  const totalSucios = inventario.filter(i => i.categoria === 'SUCIO').reduce((a, b) => a + b.cantidadContenedores, 0);

  const totalEnProceso = tanques
    .filter(t => t.loteActual !== null)
    .reduce((a, b) => a + (b.loteActual?.cantidadContenedores || 0), 0);

  const totalGlobal = totalLiberados + totalRezagados + totalFE + totalNuevos + totalSucios + totalEnProceso;

  // Acciones
const handleCambiarStatus = async (idTanque: number, nuevoStatus: EstadoTanqueStatus) => {
  if (idTanque === 2) return;

  const tanque = tanques.find(
    t => t.id === idTanque
  );

  if (
    !tanque ||
    tanque.estatus_proceso === 'VACIO' ||
    !tanque.loteActual
  ) {
    return;
  }

  const estadoAnterior = tanque.estatus_proceso;

  const idVentaOrigen =
    (tanque.loteActual as any)?.idVentaOrigen || null;

  // 1. Actualizar estado del tanque en BD
  await ejecutarActualizarEstatusTanqueBD(
    idTanque,
    nuevoStatus,
    idVentaOrigen
  );

  // 2. Actualizar estado local
  const nuevosTanques = tanques.map(t =>
    t.id === idTanque
      ? {
          ...t,
          estatus_proceso: nuevoStatus
        }
      : t
  );

  setTanques(nuevosTanques);

  // 3. Crear registro de bitácora
  const nuevoRegistro: RegistroBitacora = {
    id: crypto.randomUUID(),
    fechaHora: new Date().toLocaleString('es-MX'),
    tipoAccion: 'CAMBIO_PROCESO',
    tanqueDestino: tanque.nombre,
    lote: tanque.loteActual.lote,
    producto: tanque.loteActual.producto,
    cantidad: tanque.loteActual.cantidadContenedores,
    estadoAnterior,
    estadoNuevo: nuevoStatus,
    observaciones:
      `Cambio de proceso: ${estadoAnterior} → ${nuevoStatus}`,
  };

  // 4. Guardarlo en BD
  const idLoteProduccion = tanque.loteActual.idLoteProduccion;
  if (idLoteProduccion === undefined) return;

  await guardarRegistroBitacora(
    idLoteProduccion,
    nuevoRegistro
  );
};

// Vaciar Tanque
const handleVaciarTanque = async (idTanque: number) => {
  const tanque = tanques.find(t => t.id === idTanque);
  if (!tanque || !tanque.loteActual) return;

  if (!confirm(`¿Vaciar el ${tanque.nombre} y mover ${tanque.loteActual.cantidadContenedores} contenedores del lote ${tanque.loteActual.lote} a Grafito Liberado?`)) return;

  const idLote = (tanque.loteActual as any).idLoteProduccion;
  if (idLote === undefined) {
  console.error('El lote no tiene idLoteProduccion');
  return;
}
  const idVentaOrigen = (tanque.loteActual as any)?.idVentaOrigen || null;

  // 1. Actualizar estado de Calidad a LIBERADO en la BD (Usando el helper)
  if (idLote) {
    await ejecutarActualizarEstatusCalidadBD(idLote);
    await ejecutarActualizarTanqueBD(idLote, null);
  }

  // 2. Liberar/Vaciar el tanque en la BD (y emitir socket)
  await ejecutarActualizarEstatusTanqueBD(idTanque, 'VACIO', idVentaOrigen);

  // 3. Actualizar el estado local
  const loteLiberado: ContenedorGrafito = {
    ...tanque.loteActual,
    id: Date.now().toString(),
    categoria: 'LIBERADO',
  };

  const nuevoInventario = [...inventario, loteLiberado];
  const nuevosTanques = tanques.map(t => (t.id === idTanque ? { ...t, loteActual: null, estatus_proceso: 'VACIO' as EstadoTanqueStatus } : t));

const nuevoRegistroBitacora: RegistroBitacora = {
  id: crypto.randomUUID(),
  fechaHora: new Date().toLocaleString('es-MX'),
  tipoAccion: 'VACIADO',
  tanqueOrigen: tanque.nombre,
  lote: tanque.loteActual.lote,
  producto: tanque.loteActual.producto,
  cantidad: tanque.loteActual.cantidadContenedores,
  observaciones: `Lote ${tanque.loteActual.lote} vaciado del tanque ${tanque.nombre} y enviado a Grafito Liberado`,
};

persistirEnDB(
  nuevosTanques,
  nuevoInventario
);

await guardarRegistroBitacora(
  idLote,
  nuevoRegistroBitacora
);
};

  // Asignar / Rellenar Tanque
const handleAsignarORellenarTanque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemACargar || tanqueSeleccionado === null) return;

    const tanqueTarget = tanques.find(t => t.id === tanqueSeleccionado);
    if (!tanqueTarget) return;

    const idVentaOrigen = (itemACargar as any)?.idVentaOrigen || null;

    if ((itemACargar as any).idLoteProduccion) {
      await ejecutarActualizarTanqueBD((itemACargar as any).idLoteProduccion, tanqueSeleccionado);
    }

    await ejecutarActualizarEstatusTanqueBD(tanqueSeleccionado, 'CARGANDO_TANQUE', idVentaOrigen);

    const esRellenado = tanqueTarget.loteActual !== null;
    let nuevosTanques = [...tanques];
    let nuevoInventario = [...inventario];

    if (cantidadACargar >= itemACargar.cantidadContenedores) {
      nuevoInventario = nuevoInventario.filter(i => i.id !== itemACargar.id);
    } else {
      nuevoInventario = nuevoInventario.map(i =>
        i.id === itemACargar.id ? { ...i, cantidadContenedores: i.cantidadContenedores - cantidadACargar } : i
      );
    }

    nuevosTanques = nuevosTanques.map(t => {
      if (t.id === tanqueSeleccionado) {
        if (esRellenado && t.loteActual) {
          return {
            ...t,
            loteActual: {
              ...t.loteActual,
              cantidadContenedores: t.loteActual.cantidadContenedores + cantidadACargar,
            },
          };
        } else {
          return {
            ...t,
            estatus_proceso: 'CARGANDO_TANQUE' as EstadoTanqueStatus,
            loteActual: {
              ...itemACargar,
              cantidadContenedores: cantidadACargar,
            },
          };
        }
      }
      return t;
    });

    const nuevoRegistroBitacora: RegistroBitacora = {
      id: Date.now().toString(),
      fechaHora: new Date().toLocaleString('es-MX'),
      tipoAccion: esRellenado ? 'RELLENADO' : 'LLENADO',
      tanqueDestino: tanqueTarget.nombre,
      lote: itemACargar.lote,
      producto: itemACargar.producto,
      cantidad: cantidadACargar,
      observaciones: `Prensa: ${tanqueTarget.prensa} | Contenedores: ${cantidadACargar}`,
    };

    const idLote = (itemACargar as any).idLoteProduccion;

    if (idLote === undefined) {
      console.error('El lote no tiene idLoteProduccion');
      return;
    }

    persistirEnDB(
  nuevosTanques,
  inventario
);

await guardarRegistroBitacora(
  idLote,
  nuevoRegistroBitacora
);
    setItemACargar(null);
    setTanqueSeleccionado(null);
  };

  // Mover de Tanque (Trasvasar)
const handleMoverDeTanque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanqueAMover || !tanqueAMover.loteActual || tanqueDestinoId === null) return;

    const tanqueDestino = tanques.find(t => t.id === tanqueDestinoId);
    if (!tanqueDestino) return;

    const idLote = (tanqueAMover.loteActual as any).idLoteProduccion;
    const idVentaOrigen = (tanqueAMover.loteActual as any)?.idVentaOrigen || null;

    if (idLote) {
      await ejecutarActualizarTanqueBD(idLote, tanqueDestinoId);
    }

    await ejecutarActualizarEstatusTanqueBD(tanqueAMover.id, 'VACIO', idVentaOrigen);
    await ejecutarActualizarEstatusTanqueBD(tanqueDestinoId, 'CARGANDO_TANQUE', idVentaOrigen);

    const nuevosTanques = tanques.map(t => {
      if (t.id === tanqueAMover.id) {
        return { ...t, loteActual: null, estatus_proceso: 'VACIO' as EstadoTanqueStatus };
      }
      if (t.id === tanqueDestinoId) {
        return {
          ...t,
          estatus_proceso: 'CARGANDO_TANQUE' as EstadoTanqueStatus,
          loteActual: tanqueAMover.loteActual,
        };
      }
      return t;
    });

    const nuevoRegistroBitacora: RegistroBitacora = {
      id: Date.now().toString(),
      fechaHora: new Date().toLocaleString('es-MX'),
      tipoAccion: 'CAMBIO_TANQUE',
      tanqueOrigen: tanqueAMover.nombre,
      tanqueDestino: tanqueDestino.nombre,
      lote: tanqueAMover.loteActual.lote,
      producto: tanqueAMover.loteActual.producto,
      cantidad: tanqueAMover.loteActual.cantidadContenedores,
      observaciones: `Origen: ${tanqueAMover.nombre} -> Destino: ${tanqueDestino.nombre}`,
    };

    persistirEnDB(
  nuevosTanques,
  inventario
);

await guardarRegistroBitacora(
  idLote,
  nuevoRegistroBitacora
);
    setTanqueAMover(null);
    setTanqueDestinoId(null);
  };

const handleAgregarGrafitoSucio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoLote.trim()) return;

    const nuevoRegistro: ContenedorGrafito = {
      id: Date.now().toString(),
      lote: nuevoLote.trim(),
      producto: nuevoProducto,
      categoria: 'SUCIO',
      cantidadContenedores: nuevaCantidad,
      numVuelta: nuevaVuelta.trim() || undefined,
    };

    const nuevoInventario = [...inventario, nuevoRegistro];
    persistirEnDB(tanques, nuevoInventario);

    setNuevoLote('');
    setNuevaCantidad(1);
    setNuevaVuelta('');
    setMostrarModalNuevoSucio(false);
  };

const obtenerTanquesAptosParaCarga = (item: ContenedorGrafito) => {
    return tanques.filter(t => {
      if (t.status === 'FUERA_DE_SERVICIO' || t.status === 'MANTENIMIENTO') {
        return false;
      }
      if (!t.loteActual || t.estatus_proceso === 'VACIO') return true;
      return t.loteActual.lote === item.lote && t.loteActual.producto === item.producto;
    });
  };

  return (
    <main className="p-6 max-w-[98vw] mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Resumen KPI */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Control de Grafito y Tanques</h1>
          <p className="text-xs text-slate-500">
            {cargando ? 'Cargando datos...' : 'Sincronizado correctamente'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded">
            EN PROCESO: {totalEnProceso}
          </div>
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded">
            LIBERADOS: {totalLiberados}
          </div>
          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded">
            REZAGADOS: {totalRezagados}
          </div>
          <div className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded">
            F.E.: {totalFE}
          </div>
          <div className="bg-sky-50 text-sky-800 border border-sky-200 px-3 py-1.5 rounded">
            NUEVOS: {totalNuevos}
          </div>
          <div className="bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1.5 rounded">
            SUCIOS: {totalSucios}
          </div>
          <div className="bg-blue-600 text-white px-3 py-1.5 rounded font-bold shadow-sm">
            TOTAL: {totalGlobal}
          </div>
        </div>
      </div>

      {/* SECCIÓN DE MUESTRAS DICTAMINADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MUESTRAS ACEPTADAS / APROBADAS */}
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 
              Muestras Aprobadas
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
              {muestrasAprobadas.length} Muestras
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2">Lote</th>
                  <th className="p-2">Tanque</th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {muestrasAprobadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      No hay muestras aprobadas registradas.
                    </td>
                  </tr>
                ) : (
                  muestrasAprobadas.map((item) => (
                    <tr key={item.id_Muestra || item.id} className="hover:bg-slate-50">
                      <td className="p-2 font-medium">
                        {item.productos_materiales?.nombre_Producto || '-'}
                      </td>
                      <td className="p-2 font-mono text-slate-600">
                        {item.lotes_produccion?.no_Lote || '-'}
                      </td>
                      <td className="p-2 text-slate-700">
                        {item.equipos_tanques?.nombre_Equipo || item.lotes_produccion?.equipos_tanques?.nombre_Equipo || '-'}
                      </td>
                      <td className="p-2 text-slate-500">
                        {item.personas_muestras_cliente_idTopersonas?.nombre || 'Sin registrar'}
                      </td>
                      <td className="p-2 text-center">
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">
                          APROBADO
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MUESTRAS RECHAZADAS */}
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-rose-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> 
              Muestras Rechazadas
            </h3>
            <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
              {muestrasRechazadas.length} Muestras
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-rose-50 text-rose-800">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2">Lote</th>
                  <th className="p-2">Tanque</th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {muestrasRechazadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      No hay muestras rechazadas registradas.
                    </td>
                  </tr>
                ) : (
                  muestrasRechazadas.map((item) => (
                    <tr key={item.id_Muestra || item.id} className="hover:bg-slate-50">
                      <td className="p-2 font-medium">
                        {item.productos_materiales?.nombre_Producto || '-'}
                      </td>
                      <td className="p-2 font-mono text-slate-600">
                        {item.lotes_produccion?.no_Lote || '-'}
                      </td>
                      <td className="p-2 text-slate-700">
                        {item.equipos_tanques?.nombre_Equipo || item.lotes_produccion?.equipos_tanques?.nombre_Equipo || '-'}
                      </td>
                      <td className="p-2 text-slate-500">
                        {item.personas?.nombre || 'Sin registrar'}
                      </td>
                      <td className="p-2 text-center">
                        <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[10px]">
                          RECHAZADO
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid de Tanques */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Tanques de Proceso
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tanques.map(tanque => (
            <div key={tanque.id} className="relative group">
              <TanqueCard
                tanque={tanque}
                onCambiarStatus={handleCambiarStatus}
                onVaciarTanque={handleVaciarTanque}
              />
              {tanque.loteActual && (
                <button
                  onClick={() => setTanqueAMover(tanque)}
                  className="mt-2 w-full text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border font-medium py-1 rounded transition"
                >
                  ⇄ Mover a otro Tanque
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tablas de Inventario */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRAFITO SUCIO */}
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Grafito Sucio
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold">{totalSucios} Contenedores</span>
              <button
                onClick={() => setMostrarModalNuevoSucio(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded shadow-sm transition"
              >
                + Ingresar Grafito
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2">Prensa</th>
                  <th className="p-2">Lote</th>
                  <th className="p-2">Cant.</th>
                  <th className="p-2">Tipo / Vuelta</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventario.filter(i => i.categoria === 'SUCIO').length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      No hay registros de grafito sucio.
                    </td>
                  </tr>
                ) : (
                  inventario.filter(i => i.categoria === 'SUCIO').map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2 font-medium">{item.producto}</td>
                      <td className="p-2 font-mono text-slate-600">{item.lote}</td>
                      <td className="p-2 font-bold">{item.cantidadContenedores}</td>
                      <td className="p-2">
                        {item.numVuelta ? (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-semibold">
                            Regenerado ({item.numVuelta})
                          </span>
                        ) : (
                          <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 font-semibold">
                            Nuevo (0 vueltas)
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right space-x-1">
                        <button
                          onClick={() => {
                            setItemACargar(item);
                            setCantidadACargar(item.cantidadContenedores);
                          }}
                          className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 px-2 py-1 rounded text-[11px] font-semibold"
                        >
                          Cargar / Rellenar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRAFITO LIBERADO */}
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Grafito Liberado
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">{totalLiberados} Contenedores</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="p-2">Prensa</th>
                  <th className="p-2">Lote</th>
                  <th className="p-2">Cant.</th>
                  <th className="p-2">Tipo / Vuelta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventario.filter(i => i.categoria === 'LIBERADO').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      No hay lotes liberados.
                    </td>
                  </tr>
                ) : (
                  inventario.filter(i => i.categoria === 'LIBERADO').map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2 font-medium">{item.producto}</td>
                      <td className="p-2 font-mono text-slate-600">{item.lote}</td>
                      <td className="p-2 font-bold">{item.cantidadContenedores}</td>
                      <td className="p-2">
                        {item.numVuelta ? (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-semibold">
                            Regenerado ({item.numVuelta})
                          </span>
                        ) : (
                          <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 font-semibold">
                            Nuevo (0 vueltas)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BITÁCORA */}
      <section className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <span>📋</span> Bitácora de Movimientos
        </h3>
        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 sticky top-0">
              <tr>
                <th className="p-2">Fecha/Hora</th>
                <th className="p-2">Acción</th>
                <th className="p-2">Prensa</th>
                <th className="p-2">Lote</th>
                <th className="p-2">Cant. Contenedores</th>
                <th className="p-2">Origen / Destino</th>
                <th className="p-2">Observaciones (Prensa / Contenedores)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bitacora.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-slate-400 italic">
                    No hay registros en la bitácora aún.
                  </td>
                </tr>
              ) : (
                bitacora.map(reg => (
                  <tr key={reg.id} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-500">{reg.fechaHora}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        reg.tipoAccion === 'LLENADO' ? 'bg-blue-100 text-blue-800' :
                        reg.tipoAccion === 'RELLENADO' ? 'bg-indigo-100 text-indigo-800' :
                        reg.tipoAccion === 'CAMBIO_TANQUE' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {reg.tipoAccion}
                      </span>
                    </td>
                    <td className="p-2 font-medium">{reg.producto}</td>
                    <td className="p-2 font-mono text-slate-600">{reg.lote}</td>
                    <td className="p-2 font-bold">{reg.cantidad}</td>
                    <td className="p-2">
                      {reg.tanqueOrigen ? `${reg.tanqueOrigen} ➔ ${reg.tanqueDestino}` : reg.tanqueDestino}
                    </td>
                    <td className="p-2 text-slate-600 font-mono text-[11px]">{reg.observaciones || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modales manteniéndose funcionales */}
      {mostrarModalNuevoSucio && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-xl max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">
              Ingresar Grafito Sucio
            </h3>

            <form onSubmit={handleAgregarGrafitoSucio} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Prensa:</label>
                <select
                  value={nuevoProducto}
                  onChange={(e) => setNuevoProducto(e.target.value as ProductoGrafito)}
                  className="w-full border p-2 rounded bg-white font-medium"
                >
                  <option value="Forgemaster">Forgemaster</option>
                  <option value="Polymaster">Polymaster</option>
                  <option value="Fagor">Fagor</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Lote:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1234"
                  value={nuevoLote}
                  onChange={(e) => setNuevoLote(e.target.value)}
                  className="w-full border p-2 rounded font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Cantidad:</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={nuevaCantidad}
                    onChange={(e) => setNuevaCantidad(Number(e.target.value))}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Nº Vuelta (Opcional):</label>
                  <input
                    type="text"
                    placeholder="Vacio = Nuevo"
                    value={nuevaVuelta}
                    onChange={(e) => setNuevaVuelta(e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevoSucio(false)}
                  className="px-3 py-1.5 border rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-800 text-white rounded font-semibold hover:bg-slate-900"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemACargar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-xl max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">
              Asignar / Rellenar Tanque con Lote {itemACargar.lote}
            </h3>

            <form onSubmit={handleAsignarORellenarTanque} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">
                  Cantidad de Contenedores a subir (Máx. {itemACargar.cantidadContenedores}):
                </label>
                <input
                  type="number"
                  min={1}
                  max={itemACargar.cantidadContenedores}
                  value={cantidadACargar}
                  onChange={(e) => setCantidadACargar(Number(e.target.value))}
                  className="w-full border p-2 rounded font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Tanques Válidos:</label>
                <select
                  required
                  onChange={(e) => setTanqueSeleccionado(Number(e.target.value))}
                  className="w-full border p-2 rounded bg-white font-medium"
                >
                  <option value="">-- Selecciona Tanque --</option>
                  {obtenerTanquesAptosParaCarga(itemACargar).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} {t.loteActual ? `(RELLENAR - Lote ${t.loteActual.lote})` : '(VACÍO)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setItemACargar(null)}
                  className="px-3 py-1.5 border rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={tanqueSeleccionado === null}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirmar Carga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tanqueAMover && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-xl max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">
              Trasvasar {tanqueAMover.nombre} a otro Tanque
            </h3>

            <form onSubmit={handleMoverDeTanque} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Seleccionar Tanque Destino (Vacío):</label>
                <select
                  required
                  onChange={(e) => setTanqueDestinoId(Number(e.target.value))}
                  className="w-full border p-2 rounded bg-white font-medium"
                >
                  <option value="">-- Selecciona Tanque Destino --</option>
                  {tanques
                    .filter(t => t.id !== tanqueAMover.id && !t.loteActual)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} (Disponible)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setTanqueAMover(null)}
                  className="px-3 py-1.5 border rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={tanqueDestinoId === null}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  Confirmar Trasvase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
} 