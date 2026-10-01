'use client';

import { API_URL, apiFetch as fetch } from '@/utils/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { useSocket } from '@/context/SocketContext';

import {
  TramiteLegal,
  SemaforoTramite,
  EstatusTramite,
} from '@/types/tramites';

import { calcularSemaforo } from '@/utils/semaforo';

import {
  analizarVariacionPagos,
  ComparativaPago,
} from '@/utils/analisisPagos';

/* =========================================================
   CONSTANTES
========================================================= */

const API_BASE_URL = `${API_URL}/api/seguridad`;

// RUTA PROPUESTA: confirmar con el controlador del backend.
// Debe devolver los bytes del PDF con Content-Type: application/pdf.
// Cambiar solo esta función si tu endpoint utiliza otra ruta o identificador.
const obtenerUrlDocumento = (idTramite: string) =>
  `${API_BASE_URL}/tramites/${encodeURIComponent(idTramite)}/documento`;

/* =========================================================
   TIPOS
========================================================= */

type CatalogoTramite = {
  id_Tramite_Catalogo: number;
  id_Area: number;
  nombre_Tramite: string;
  nombre_Area: string;
};

type AreaLegal = {
  id_Area: number;
  nombre_Area: string;
};

type FormTramite = {
  idArea: number;
  idTramiteCatalogo: number;

  nombreTramite: string;
  areaRelacionada: string;

  duracion: number;

  costoVigencia: number;

  responsable: string;
  proveedor: string;

  estatus: EstatusTramite;

  fechaExpedicion: string;
  fechaVencimiento: string;

  observaciones: string;

  unidadDuracion: 'anios' | 'meses';
};

/* =========================================================
   FECHA DE VENCIMIENTO
========================================================= */

const calcularFechaVencimiento = (
  fechaExp: string,
  duracion: number,
  unidad: 'anios' | 'meses',
): string => {
  if (
    !fechaExp ||
    isNaN(duracion) ||
    duracion <= 0
  ) {
    return '';
  }

  const [
    yearStr,
    monthStr,
    dayStr,
  ] = fechaExp.split('-');

  const year = parseInt(
    yearStr,
    10,
  );

  const month =
    parseInt(
      monthStr,
      10,
    ) - 1;

  const day = parseInt(
    dayStr,
    10,
  );

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day)
  ) {
    return '';
  }

  const fecha = new Date(
    year,
    month,
    day,
  );

  if (unidad === 'anios') {
    fecha.setFullYear(
      fecha.getFullYear() +
        duracion,
    );
  } else {
    fecha.setMonth(
      fecha.getMonth() +
        duracion,
    );
  }

  const yyyy =
    fecha.getFullYear();

  const mm = String(
    fecha.getMonth() + 1,
  ).padStart(2, '0');

  const dd = String(
    fecha.getDate(),
  ).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
};

/* =========================================================
   FORMATO FECHA API → INPUT DATE
========================================================= */

const formatearFecha = (
  fecha?: string | null,
): string => {
  if (!fecha) {
    return '';
  }

  return String(
    fecha,
  ).split('T')[0];
};

/* =========================================================
   BADGE VARIACIÓN
========================================================= */

function BadgeVariacion({
  comparativa,
}: {
  comparativa?: ComparativaPago;
}) {
  if (
    !comparativa ||
    comparativa.tendencia ===
      'SIN_HISTORIAL'
  ) {
    return (
      <span className="text-[10px] text-slate-400 italic">
        Primer registro
      </span>
    );
  }

  const {
    diferenciaNominal = 0,
    porcentajeVariacion = 0,
    tendencia,
  } = comparativa;

  if (tendencia === 'AUMENTO') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded"
        title={`Subió $${diferenciaNominal.toLocaleString()} respecto al periodo anterior`}
      >
        ▲ +{porcentajeVariacion}% ($
        {diferenciaNominal.toLocaleString()})
      </span>
    );
  }

  if (
    tendencia ===
    'DISMINUCION'
  ) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
        title={`Bajó $${Math.abs(
          diferenciaNominal,
        ).toLocaleString()} respecto al periodo anterior`}
      >
        ▼ {porcentajeVariacion}% ($
        {diferenciaNominal.toLocaleString()})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
      = Sin cambio
    </span>
  );
}

/* =========================================================
   BADGE SEMÁFORO
========================================================= */

function getSemaforoBadge(
  semaforo?: SemaforoTramite,
) {
  switch (semaforo) {
    case 'rojo':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
          🔴 Crítico
        </span>
      );

    case 'naranja':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
          🟠 Urgente
        </span>
      );

    case 'amarillo':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
          🟡 Próximo
        </span>
      );

    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          🟢 Vigente
        </span>
      );
  }
}

/* =========================================================
   COMPONENTE
========================================================= */


/* Gasto registrado por año de expedición; no representa flujo de pagos.
 * Se suma costoVigencia una sola vez por registro, sin prorratear costoPorAnio.
 * Los importes se agregan en centavos para evitar errores de coma flotante.
 */
const SIN_FECHA = 'Sin fecha válida';
const formatoImporte = (valor: number) =>
  `$${valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function anioExpedicion(fecha?: string | null): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(fecha ?? '');
  if (!coincidencia) return SIN_FECHA;
  const [, anio, mes, dia] = coincidencia;
  const fechaValidada = new Date(`${anio}-${mes}-${dia}T12:00:00Z`);
  if (!Number.isFinite(fechaValidada.getTime()) ||
      fechaValidada.toISOString().slice(0, 10) !== `${anio}-${mes}-${dia}`) return SIN_FECHA;
  return anio;
}

const centavos = (valor: number) => Number.isFinite(valor) ? Math.round(valor * 100) : 0;
const nombreArea = (tramite: TramiteLegal) => tramite.areaRelacionada.trim() || 'Sin área';

function agruparGastoPorAnio(registros: TramiteLegal[]) {
  const grupos = new Map<string, { anio: string; registros: TramiteLegal[]; centavos: number }>();
  for (const tramite of registros) {
    const anio = anioExpedicion(tramite.fechaExpedicion);
    const grupo = grupos.get(anio) ?? { anio, registros: [], centavos: 0 };
    grupo.registros.push(tramite);
    grupo.centavos += centavos(tramite.costoVigencia);
    grupos.set(anio, grupo);
  }
  return Array.from(grupos.values()).sort((a, b) => {
    if (a.anio === SIN_FECHA) return 1;
    if (b.anio === SIN_FECHA) return -1;
    return Number(b.anio) - Number(a.anio);
  }).map(grupo => ({
    ...grupo,
    gasto: grupo.centavos / 100,
    registros: [...grupo.registros].sort((a, b) =>
      b.fechaExpedicion.localeCompare(a.fechaExpedicion) || a.nombreTramite.localeCompare(b.nombreTramite)),
  }));
}

export default function MatrizLegalPage() {
  const [revision, setRevision] = useState(0);
  const socket = useSocket();
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');
  const solicitudPdf = useRef<AbortController | null>(null);

  useEffect(() => () => solicitudPdf.current?.abort(), []);

  /* =======================================================
     ESTADOS
  ======================================================= */

  const [
    catalogoTramites,
    setCatalogoTramites,
  ] = useState<CatalogoTramite[]>([]);

  const [
    tramites,
    setTramites,
  ] = useState<TramiteLegal[]>([]);

  const [
    mostrarModal,
    setMostrarModal,
  ] = useState(false);

  const [
    cargandoCatalogo,
    setCargandoCatalogo,
  ] = useState(true);

  const [
    cargandoTramites,
    setCargandoTramites,
  ] = useState(true);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    archivoSeleccionado,
    setArchivoSeleccionado,
  ] = useState<File | null>(null);

  const [
    previewPdfUrl,
    setPreviewPdfUrl,
  ] = useState<string | null>(null);

  const [
    previewPdfNombre,
    setPreviewPdfNombre,
  ] = useState<string>('');

  /* =======================================================
     FORMULARIO
  ======================================================= */

  const [
    form,
    setForm,
  ] = useState<FormTramite>({
    idArea: 0,
    idTramiteCatalogo: 0,

    nombreTramite: '',
    areaRelacionada: '',

    duracion: 1,

    costoVigencia: 0,

    responsable: '',
    proveedor: '',

    estatus: 'VIGENTE',

    fechaExpedicion:
      new Date()
        .toISOString()
        .split('T')[0],

    fechaVencimiento: '',

    observaciones: '',

    unidadDuracion:
      'anios',
  });

  /* =======================================================
     ÁREAS OBTENIDAS DEL CATÁLOGO
  ======================================================= */

  const areasDisponibles =
    useMemo<AreaLegal[]>(() => {
      const mapa =
        new Map<number, AreaLegal>();

      catalogoTramites.forEach(
        (tramite) => {
          if (
            !mapa.has(
              tramite.id_Area,
            )
          ) {
            mapa.set(
              tramite.id_Area,
              {
                id_Area:
                  tramite.id_Area,

                nombre_Area:
                  tramite.nombre_Area,
              },
            );
          }
        },
      );

      return Array.from(
        mapa.values(),
      ).sort(
        (a, b) =>
          a.nombre_Area.localeCompare(
            b.nombre_Area,
          ),
      );
    }, [
      catalogoTramites,
    ]);

  /* =======================================================
     TRÁMITES DEL ÁREA SELECCIONADA
  ======================================================= */

  const tramitesDisponibles =
    useMemo(() => {
      if (!form.idArea) {
        return [];
      }

      return catalogoTramites
        .filter(
          (tramite) =>
            tramite.id_Area ===
            form.idArea,
        )
        .sort((a, b) =>
          a.nombre_Tramite.localeCompare(
            b.nombre_Tramite,
          ),
        );
    }, [
      catalogoTramites,
      form.idArea,
    ]);

  /* =======================================================
     ANÁLISIS DE COSTOS
  ======================================================= */

  const analisisCostos =
    useMemo(
      () =>
        analizarVariacionPagos(
          tramites,
        ),
      [tramites],
    );

  // Un arreglo vacío de años significa todos, incluidos los que lleguen por socket.
  const [aniosSeleccionados, setAniosSeleccionados] = useState<string[]>([]);
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroTramite, setFiltroTramite] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [aniosCerrados, setAniosCerrados] = useState<string[]>([]);

  const aniosDisponibles = useMemo(() =>
    agruparGastoPorAnio(tramites).map(grupo => grupo.anio), [tramites]);

  // Incluye áreas históricas que ya no aparezcan en el catálogo actual.
  const areasFiltro = useMemo(() => Array.from(new Set(tramites.map(nombreArea)))
    .sort((a, b) => a.localeCompare(b)), [tramites]);

  const opcionesTramite = useMemo(() => {
    const opciones = new Map<string, string>();
    tramites.filter(t => !filtroArea || nombreArea(t) === filtroArea).forEach(t => {
      opciones.set(String(t.idTramiteCatalogo), `${t.nombreTramite} — ${nombreArea(t)}`);
    });
    return Array.from(opciones, ([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [tramites, filtroArea]);

  const tramitesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es-MX');
    return tramites.filter(t =>
      (!filtroArea || nombreArea(t) === filtroArea) &&
      (!filtroTramite || String(t.idTramiteCatalogo) === filtroTramite) &&
      (aniosSeleccionados.length === 0 || aniosSeleccionados.includes(anioExpedicion(t.fechaExpedicion))) &&
      (!texto || [t.nombreTramite, t.responsable, t.proveedor, t.observaciones ?? '']
        .join(' ').toLocaleLowerCase('es-MX').includes(texto))
    );
  }, [tramites, filtroArea, filtroTramite, aniosSeleccionados, busqueda]);

  const gruposAnuales = useMemo(() => agruparGastoPorAnio(tramitesFiltrados), [tramitesFiltrados]);
  const totalGasto = gruposAnuales.reduce((suma, grupo) => suma + grupo.centavos, 0) / 100;
  const datosAnuales = [...gruposAnuales].reverse().map(g => ({ anio: g.anio, gasto: g.gasto }));
  const resumenAreas = useMemo(() => {
    const areas = new Map<string, { area: string; centavos: number; cantidad: number }>();
    for (const tramite of tramitesFiltrados) {
      const area = nombreArea(tramite);
      const dato = areas.get(area) ?? { area, centavos: 0, cantidad: 0 };
      dato.centavos += centavos(tramite.costoVigencia);
      dato.cantidad += 1;
      areas.set(area, dato);
    }
    return Array.from(areas.values()).map(a => ({ ...a, gasto: a.centavos / 100 }))
      .sort((a, b) => b.centavos - a.centavos || a.area.localeCompare(b.area));
  }, [tramitesFiltrados]);

  const alternarAnio = (anio: string) => setAniosSeleccionados(prev =>
    prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]);
  const limpiarFiltros = () => {
    setAniosSeleccionados([]);
    setFiltroArea('');
    setFiltroTramite('');
    setBusqueda('');
  };

  /* =======================================================
     FECHA VENCIMIENTO
  ======================================================= */

  useEffect(() => {
    if (
      form.fechaExpedicion &&
      form.duracion > 0
    ) {
      const fechaCalculada =
        calcularFechaVencimiento(
          form.fechaExpedicion,
          Number(
            form.duracion,
          ),
          form.unidadDuracion,
        );

      setForm(
        (prev) => ({
          ...prev,
          fechaVencimiento:
            fechaCalculada,
        }),
      );
    }
  }, [
    form.fechaExpedicion,
    form.duracion,
    form.unidadDuracion,
  ]);

  /* =======================================================
     CARGAR CATÁLOGO
  ======================================================= */

  useEffect(() => {
    const cargarCatalogo =
      async () => {
        try {
          setCargandoCatalogo(
            true,
          );

          const response =
            await fetch(
              `${API_BASE_URL}/catalogo-tramites`,
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Error HTTP ${response.status}`,
            );
          }

          const data =
            await response.json();

          if (
            !Array.isArray(
              data,
            )
          ) {
            throw new Error(
              'La respuesta del catálogo no es un arreglo.',
            );
          }

          const catalogo:
            CatalogoTramite[] =
            data.map(
              (item) => ({
                id_Tramite_Catalogo:
                  Number(
                    item.id_Tramite_Catalogo,
                  ),

                id_Area:
                  Number(
                    item.id_Area,
                  ),

                nombre_Tramite:
                  String(
                    item.nombre_Tramite ??
                      '',
                  ),

                nombre_Area:
                  String(
                    item.nombre_Area ??
                      '',
                  ),
              }),
            );

          setCatalogoTramites(
            catalogo,
          );
        } catch (error) {
          console.error(
            'Error cargando catálogo:',
            error,
          );

          alert(
            'No fue posible cargar el catálogo de trámites.',
          );
        } finally {
          setCargandoCatalogo(
            false,
          );
        }
      };

    cargarCatalogo();
  }, []);

  /* =======================================================
     CARGAR MATRIZ LEGAL
  ======================================================= */

  useEffect(() => {
    const cargarTramites =
      async () => {
        try {
          setCargandoTramites(
            true,
          );

          const response =
            await fetch(
              `${API_BASE_URL}/tramites`,
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Error HTTP ${response.status}`,
            );
          }

          const data =
            await response.json();

          if (
            !Array.isArray(
              data,
            )
          ) {
            throw new Error(
              'La respuesta de trámites no es un arreglo.',
            );
          }

          const tramitesNormalizados:
            TramiteLegal[] =
            data.map(
              (item) => ({
                id: String(
                  item.id,
                ),

                idTramiteCatalogo:
                  Number(
                    item.id_tramite_catalogo,
                  ),

                areaRelacionada:
                  String(
                    item.area_relacionada ??
                      '',
                  ),

                nombreTramite:
                  String(
                    item.nombre_tramite ??
                      '',
                  ),

                duracionAnios:
                  Number(
                    item.duracion_anios ??
                      0,
                  ),

                costoVigencia:
                  Number(
                    item.costo_vigencia ??
                      0,
                  ),

                costoPorAnio:
                  Number(
                    item.costo_por_anio ??
                      0,
                  ),

                responsable:
                  String(
                    item.responsable ??
                      '',
                  ),

                proveedor:
                  String(
                    item.proveedor ??
                      '',
                  ),

                estatus:
                  item.estatus_tramite as EstatusTramite,

                fechaExpedicion:
                  formatearFecha(
                    item.fecha_expedicion,
                  ),

                fechaVencimiento:
                  formatearFecha(
                    item.fecha_vencimiento,
                  ),

                semaforo:
                  calcularSemaforo(
                    formatearFecha(
                      item.fecha_vencimiento,
                    ),
                  ),

                observaciones:
                  String(
                    item.observaciones ??
                      '',
                  ),

                nombreArchivo:
                  item.documentos?.[0]
                    ?.nombre_original ??
                  undefined,
              }),
            );

          setTramites(
            tramitesNormalizados,
          );
        } catch (error) {
          console.error(
            'Error cargando matriz legal:',
            error,
          );

          alert(
            'No fue posible cargar la matriz legal.',
          );
        } finally {
          setCargandoTramites(
            false,
          );
        }
      };

    cargarTramites();
  }, [revision]);

  /* =======================================================
     WEBSOCKETS
  ======================================================= */

  useEffect(() => {
    if (!socket) {
      return;
    }

    const refrescar = () => setRevision(value => value + 1);
    const onTramiteCreado = refrescar;
    const onTramiteActualizado = refrescar;
    const onTramiteEliminado = refrescar;

    socket.on(
      'TRAMITE_CREADO',
      onTramiteCreado,
    );

    socket.on(
      'TRAMITE_ACTUALIZADO',
      onTramiteActualizado,
    );

    socket.on(
      'TRAMITE_ELIMINADO',
      onTramiteEliminado,
    );

    return () => {
      socket.off(
        'TRAMITE_CREADO',
        onTramiteCreado,
      );

      socket.off(
        'TRAMITE_ACTUALIZADO',
        onTramiteActualizado,
      );

      socket.off(
        'TRAMITE_ELIMINADO',
        onTramiteEliminado,
      );
    };
  }, [socket]);

  /* =======================================================
     NUEVO TRÁMITE
  ======================================================= */

  const abrirNuevoTramite =
    () => {
      const hoy =
        new Date()
          .toISOString()
          .split('T')[0];

      setArchivoSeleccionado(
        null,
      );

      setForm({
        idArea: 0,

        idTramiteCatalogo: 0,

        nombreTramite: '',

        areaRelacionada: '',

        duracion: 1,

        costoVigencia: 0,

        responsable: '',
        proveedor: '',

        estatus: 'VIGENTE',

        fechaExpedicion:
          hoy,

        fechaVencimiento:
          calcularFechaVencimiento(
            hoy,
            1,
            'anios',
          ),

        observaciones: '',

        unidadDuracion:
          'anios',
      });

      setMostrarModal(
        true,
      );
    };

  /* =======================================================
     CAMBIAR ÁREA
  ======================================================= */

  const handleCambiarArea =
    (
      idArea: number,
    ) => {
      const area =
        areasDisponibles.find(
          (item) =>
            item.id_Area ===
            idArea,
        );

      setForm(
        (prev) => ({
          ...prev,

          idArea,

          idTramiteCatalogo:
            0,

          nombreTramite:
            '',

          areaRelacionada:
            area?.nombre_Area ??
            '',
        }),
      );
    };

  /* =======================================================
     CAMBIAR TRÁMITE
  ======================================================= */

  const handleCambiarTramite =
    (
      idTramiteCatalogo: number,
    ) => {
      const tramite =
        catalogoTramites.find(
          (item) =>
            item.id_Tramite_Catalogo ===
            idTramiteCatalogo,
        );

      if (!tramite) {
        setForm(
          (prev) => ({
            ...prev,

            idTramiteCatalogo:
              0,

            nombreTramite:
              '',
          }),
        );

        return;
      }

      setForm(
        (prev) => ({
          ...prev,

          idArea:
            tramite.id_Area,

          idTramiteCatalogo:
            tramite.id_Tramite_Catalogo,

          nombreTramite:
            tramite.nombre_Tramite,

          areaRelacionada:
            tramite.nombre_Area,
        }),
      );
    };

  /* =======================================================
     GUARDAR TRÁMITE
  ======================================================= */

  const handleGuardar =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      if (
        !form.idArea
      ) {
        alert(
          'Selecciona un área.',
        );
        return;
      }

      if (
        !form.idTramiteCatalogo
      ) {
        alert(
          'Selecciona un trámite.',
        );
        return;
      }

      if (
        !archivoSeleccionado
      ) {
        alert(
          'Debes adjuntar el PDF del trámite.',
        );
        return;
      }

      if (
        !form.fechaExpedicion
      ) {
        alert(
          'La fecha de expedición es obligatoria.',
        );
        return;
      }

      if (
        !form.fechaVencimiento
      ) {
        alert(
          'No fue posible calcular la fecha de vencimiento.',
        );
        return;
      }

      const tramiteCatalogo =
        catalogoTramites.find(
          (item) =>
            item.id_Tramite_Catalogo ===
            form.idTramiteCatalogo,
        );

      if (!tramiteCatalogo) {
        alert(
          'El trámite seleccionado no existe en el catálogo.',
        );
        return;
      }

      /*
       * La BD guarda duracion_Tramite como Decimal.
       *
       * Si se capturan meses:
       *
       * 6 meses → 0.5 años
       *
       * Si se capturan años:
       *
       * 2 años → 2
       */

      const duracionIngresada =
        Number(
          form.duracion,
        );

      const duracionEnAnios =
        form.unidadDuracion ===
        'meses'
          ? duracionIngresada /
            12
          : duracionIngresada;

      if (
        !Number.isFinite(
          duracionEnAnios,
        ) ||
        duracionEnAnios <= 0
      ) {
        alert(
          'La duración debe ser mayor a cero.',
        );
        return;
      }

      const costoVigencia =
        Number(
          form.costoVigencia,
        ) || 0;

      const costoPorAnio =
        costoVigencia /
        duracionEnAnios;

      const formData =
        new FormData();

      /*
       * RELACIÓN CON EL CATÁLOGO
       */
      formData.append(
        'id_tramite_catalogo',
        String(
          tramiteCatalogo.id_Tramite_Catalogo,
        ),
      );

      /*
       * DATOS DEL TRÁMITE
       */
      formData.append(
        'duracion_anios',
        String(
          duracionEnAnios,
        ),
      );

      formData.append(
        'costo_vigencia',
        String(
          costoVigencia,
        ),
      );

      formData.append(
        'costo_por_anio',
        String(
          costoPorAnio.toFixed(
            4,
          ),
        ),
      );

      formData.append(
        'responsable',
        form.responsable.trim(),
      );

      formData.append(
        'proveedor',
        form.proveedor.trim(),
      );

      formData.append(
        'estatus_tramite',
        form.estatus,
      );

      formData.append(
        'fecha_expedicion',
        form.fechaExpedicion,
      );

      formData.append(
        'fecha_vencimiento',
        form.fechaVencimiento,
      );

      formData.append(
        'observaciones',
        form.observaciones.trim(),
      );

      /*
       * PDF
       */
      formData.append(
        'archivo',
        archivoSeleccionado,
      );

      try {
        setGuardando(
          true,
        );

        const response =
          await fetch(
            `${API_BASE_URL}/tramites`,
            {
              method: 'POST',
              body: formData,
            },
          );

        if (
          !response.ok
        ) {
          const errorData =
            await response
              .json()
              .catch(
                () => null,
              );

          const mensaje =
            errorData?.message
              ? Array.isArray(
                  errorData.message,
                )
                ? errorData.message.join(
                    ', ',
                  )
                : errorData.message
              : `Error HTTP ${response.status}`;

          throw new Error(
            mensaje,
          );
        }

        const dataBackend =
          await response.json();

        /*
         * NORMALIZAR RESPUESTA
         */

        const nuevoTramite:
          TramiteLegal = {
          id: String(
            dataBackend.id,
          ),

          idTramiteCatalogo:
            Number(
              dataBackend.id_tramite_catalogo,
            ),

          areaRelacionada:
            dataBackend.area_relacionada ??
            tramiteCatalogo.nombre_Area,

          nombreTramite:
            dataBackend.nombre_tramite ??
            tramiteCatalogo.nombre_Tramite,

          duracionAnios:
            Number(
              dataBackend.duracion_anios ??
                duracionEnAnios,
            ),

          costoVigencia:
            Number(
              dataBackend.costo_vigencia ??
                costoVigencia,
            ),

          costoPorAnio:
            Number(
              dataBackend.costo_por_anio ??
                costoPorAnio,
            ),

          responsable:
            dataBackend.responsable ??
            form.responsable,

          proveedor:
            dataBackend.proveedor ??
            form.proveedor,

          estatus:
            dataBackend.estatus_tramite ??
            form.estatus,

          fechaExpedicion:
            formatearFecha(
              dataBackend.fecha_expedicion ??
                form.fechaExpedicion,
            ),

          fechaVencimiento:
            formatearFecha(
              dataBackend.fecha_vencimiento ??
                form.fechaVencimiento,
            ),

          semaforo:
            calcularSemaforo(
              formatearFecha(
                dataBackend.fecha_vencimiento ??
                  form.fechaVencimiento,
              ),
            ),

          observaciones:
            dataBackend.observaciones ??
            form.observaciones,

          nombreArchivo:
            dataBackend
              .documentos?.[0]
              ?.nombre_original ??
            archivoSeleccionado.name,
        };

        /*
         * AGREGAR A LA TABLA
         */

        setTramites(
          (prev) => [
            nuevoTramite,
            ...prev.filter(t => String(t.id) !== String(nuevoTramite.id)),
          ],
        );

        /*
         * SOCKET
         */



        /*
         * CERRAR MODAL
         */

        setMostrarModal(
          false,
        );

        setArchivoSeleccionado(
          null,
        );

        alert(
          'Trámite registrado correctamente.',
        );
      } catch (error) {
        console.error(
          'Error guardando trámite:',
          error,
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Ocurrió un error al guardar el trámite.',
        );
      } finally {
        setGuardando(
          false,
        );
      }
    };

  /* =======================================================
     PREVISUALIZAR PDF SELECCIONADO
  ======================================================= */

  useEffect(() => {
    return () => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); };
  }, [previewPdfUrl]);

  const abrirPreviewArchivo = () => {
    if (!archivoSeleccionado) return;
    solicitudPdf.current?.abort();
    solicitudPdf.current = null;
    setErrorPdf('');
    setCargandoPdf(false);
    setPreviewPdfNombre(archivoSeleccionado.name);
    setPreviewPdfUrl(URL.createObjectURL(archivoSeleccionado));
    setVisorAbierto(true);
  };

  const abrirDocumentoGuardado = async (tramite: TramiteLegal) => {
    solicitudPdf.current?.abort();
    const controlador = new AbortController();
    solicitudPdf.current = controlador;
    setPreviewPdfUrl(null);
    setPreviewPdfNombre(tramite.nombreArchivo || `${tramite.nombreTramite}.pdf`);
    setErrorPdf('');
    setCargandoPdf(true);
    setVisorAbierto(true);
    try {
      // Si la API requiere un token, usar aquí el cliente autenticado del proyecto.
      const respuesta = await fetch(obtenerUrlDocumento(String(tramite.id)), {
        signal: controlador.signal, headers: { Accept: 'application/pdf' },
      });
      if (!respuesta.ok) {
        if (respuesta.status === 404) throw new Error('No se encontró el documento. Verifica el archivo y la ruta del endpoint PDF.');
        if (respuesta.status === 401 || respuesta.status === 403) throw new Error('No tienes acceso al documento. Verifica tu sesión y la autenticación de la solicitud.');
        throw new Error(`No fue posible cargar el documento (HTTP ${respuesta.status}).`);
      }
      const archivo = await respuesta.blob();
      const cabecera = await archivo.slice(0, 5).text();
      if (cabecera !== '%PDF-') throw new Error('El servidor no devolvió un PDF válido. El endpoint debe devolver el contenido del PDF, no JSON.');
      if (controlador.signal.aborted || solicitudPdf.current !== controlador) return;
      setPreviewPdfUrl(URL.createObjectURL(new Blob([archivo], { type: 'application/pdf' })));
    } catch (error) {
      if (controlador.signal.aborted || solicitudPdf.current !== controlador) return;
      setErrorPdf(error instanceof Error ? error.message : 'No fue posible cargar el documento.');
    } finally {
      if (!controlador.signal.aborted && solicitudPdf.current === controlador) {
        setCargandoPdf(false);
        solicitudPdf.current = null;
      }
    }
  };

  const cerrarPreview = () => {
    solicitudPdf.current?.abort();
    solicitudPdf.current = null;
    setVisorAbierto(false);
    setCargandoPdf(false);
    setErrorPdf('');
    setPreviewPdfUrl(null);
    setPreviewPdfNombre('');
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="mx-auto max-w-[95vw] p-3 font-sans sm:p-6 lg:p-8">

      {/* ===================================================
          ENCABEZADO
      =================================================== */}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">

        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Matriz Legal
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Administración de trámites,
            vencimientos y documentación legal.
          </p>
        </div>

        <button
          onClick={
            abrirNuevoTramite
          }
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          + Registrar Nuevo Trámite
        </button>

      </div>

      <section aria-label="Filtros de la matriz legal" className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Área
            <select value={filtroArea} onChange={e => { setFiltroArea(e.target.value); setFiltroTramite(''); }}
              className="mt-1 w-full rounded border bg-white p-2 font-normal">
              <option value="">Todas las áreas</option>
              {areasFiltro.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Trámite
            <select value={filtroTramite} onChange={e => setFiltroTramite(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 font-normal">
              <option value="">Todos los trámites</option>
              {opcionesTramite.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Buscar
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Trámite, responsable, proveedor o notas"
              className="mt-1 w-full rounded border p-2 font-normal" />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-slate-700">Año de expedición · selección múltiple</legend>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={aniosSeleccionados.length === 0} onClick={() => setAniosSeleccionados([])}
              className={`rounded-full border px-3 py-1.5 text-sm ${aniosSeleccionados.length === 0 ? 'bg-blue-700 text-white' : 'bg-white text-slate-700'}`}>
              Todos los años
            </button>
            {aniosDisponibles.map(anio => (
              <button key={anio} type="button" aria-pressed={aniosSeleccionados.includes(anio)} onClick={() => alternarAnio(anio)}
                className={`rounded-full border px-3 py-1.5 text-sm ${aniosSeleccionados.includes(anio) ? 'bg-blue-700 text-white' : 'bg-white text-slate-700'}`}>
                {anio}
              </button>
            ))}
            <button type="button" onClick={limpiarFiltros} className="ml-auto rounded px-3 py-1.5 text-sm font-semibold text-blue-700 underline">
              Limpiar filtros
            </button>
          </div>
        </fieldset>
        <p className="mt-3 text-xs text-slate-500">Los filtros se aplican al resumen, las gráficas y las tablas. Sin años seleccionados se muestran todos.</p>
      </section>

      {cargandoTramites ? (
        <p role="status" className="rounded-xl border bg-white p-8 text-center text-slate-500">Cargando matriz legal...</p>
      ) : (
        <>
          <section aria-label="Resumen del gasto filtrado" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { titulo: 'Gasto registrado', valor: formatoImporte(totalGasto) },
              { titulo: 'Registros', valor: String(tramitesFiltrados.length) },
              { titulo: 'Áreas con registros', valor: String(resumenAreas.length) },
              { titulo: 'Años con registros', valor: String(gruposAnuales.filter(g => g.anio !== SIN_FECHA).length) },
            ].map(tarjeta => (
              <div key={tarjeta.titulo} className="min-w-0 rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{tarjeta.titulo}</p>
                <p className="mt-2 break-words text-2xl font-bold text-slate-900">{tarjeta.valor}</p>
              </div>
            ))}
          </section>
          <p className="mb-5 text-xs text-slate-600">
            Base: costo total por vigencia asignado al año de expedición, sin prorrateo. No representa pagos realizados.
            Los años en curso pueden tener información parcial. Todos los importes deben estar en la misma moneda.
          </p>

          {tramitesFiltrados.length === 0 ? (
            <p className="rounded-xl border bg-white p-8 text-center text-slate-500">
              {tramites.length === 0 ? 'No hay trámites registrados.' : 'No hay registros que coincidan con los filtros.'}
            </p>
          ) : (
            <>
              <section aria-label="Gráficas del gasto registrado" className="mb-6 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="min-w-0 rounded-xl border bg-white p-4">
                  <h2 className="mb-4 font-bold text-slate-800">Gasto por año de expedición</h2>
                  <div className="w-full overflow-x-auto">
                    <div style={{ minWidth: Math.max(320, datosAnuales.length * 90), height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosAnuales} margin={{ top: 12, right: 20, bottom: 20, left: 12 }} accessibilityLayer>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="anio" />
                          <YAxis width={85} tickFormatter={v => `$${Number(v).toLocaleString('es-MX')}`} />
                          <Tooltip formatter={v => [formatoImporte(Number(v)), 'Gasto registrado']} />
                          <Bar dataKey="gasto" name="Gasto registrado" fill="#2563eb" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border bg-white p-4">
                  <h2 className="mb-1 font-bold text-slate-800">Gasto por área</h2>
                  <p className="mb-3 text-xs text-slate-500">Suma de los años seleccionados; no es una calificación de desempeño.</p>
                  <div className="max-h-[420px] overflow-auto">
                    <div style={{ minWidth: 360, height: Math.max(280, resumenAreas.length * 55) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenAreas} layout="vertical" margin={{ top: 5, right: 24, bottom: 20, left: 0 }} accessibilityLayer>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={v => `$${Number(v).toLocaleString('es-MX')}`} />
                          <YAxis type="category" dataKey="area" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={v => [formatoImporte(Number(v)), 'Gasto registrado']} />
                          <Bar dataKey="gasto" name="Gasto registrado" fill="#059669" radius={[0, 5, 5, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-6 overflow-hidden rounded-xl border bg-white">
                <h2 className="p-4 font-bold text-slate-800">Resumen por área · filtros actuales</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100"><tr>
                      <th scope="col" className="p-3">Área</th><th scope="col" className="p-3">Registros</th>
                      <th scope="col" className="p-3">Gasto registrado</th><th scope="col" className="p-3">% del gasto filtrado</th>
                      <th scope="col" className="p-3">Costo medio por registro</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {resumenAreas.map(area => <tr key={area.area}>
                        <td className="p-3 font-semibold">{area.area}</td><td className="p-3">{area.cantidad}</td>
                        <td className="whitespace-nowrap p-3">{formatoImporte(area.gasto)}</td>
                        <td className="p-3">{totalGasto > 0 ? `${(area.gasto / totalGasto * 100).toFixed(1)}%` : '—'}</td>
                        <td className="whitespace-nowrap p-3">{formatoImporte(area.gasto / area.cantidad)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-800">Detalle por año de expedición</h2>
                <div className="flex gap-3 text-sm text-blue-700">
                  <button type="button" onClick={() => setAniosCerrados([])}>Expandir todos</button>
                  <button type="button" onClick={() => setAniosCerrados(gruposAnuales.map(g => g.anio))}>Contraer todos</button>
                </div>
              </div>
              <div className="space-y-4">
                {gruposAnuales.map(grupo => {
                  const expandido = !aniosCerrados.includes(grupo.anio);
                  return <section key={grupo.anio} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    <h3>
                      <button type="button" aria-expanded={expandido}
                        onClick={() => setAniosCerrados(prev => prev.includes(grupo.anio) ? prev.filter(a => a !== grupo.anio) : [...prev, grupo.anio])}
                        className="flex w-full flex-wrap items-center justify-between gap-3 bg-slate-100 p-4 text-left">
                        <span className="font-bold text-slate-800">{expandido ? '▾' : '▸'} {grupo.anio} · {grupo.registros.length} registros</span>
                        <span className="font-bold text-blue-800">Total filtrado: {formatoImporte(grupo.gasto)}</span>
                      </button>
                    </h3>
                    {expandido && <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="border-b bg-slate-50"><tr>
                          {['Semáforo actual', 'Área', 'Trámite', 'Expedición', 'Vencimiento', 'Estatus', 'Costo vigencia', 'Variación histórica', 'Costo/año', 'Responsable', 'Proveedor', 'Documento'].map(columna =>
                            <th key={columna} scope="col" className="whitespace-nowrap p-3">{columna}</th>)}
                        </tr></thead>
                        <tbody className="divide-y">
                          {grupo.registros.map(tramite => <tr key={tramite.id} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap p-3">{getSemaforoBadge(tramite.semaforo ?? calcularSemaforo(tramite.fechaVencimiento))}</td>
                            <td className="p-3 font-semibold">{nombreArea(tramite)}</td>
                            <td className="min-w-[170px] p-3 font-bold text-blue-900">{tramite.nombreTramite}</td>
                            <td className="whitespace-nowrap p-3 font-mono">{tramite.fechaExpedicion || 'Sin fecha'}</td>
                            <td className="whitespace-nowrap p-3 font-mono">{tramite.fechaVencimiento}</td>
                            <td className="whitespace-nowrap p-3">{String(tramite.estatus).replace(/_/g, ' ')}</td>
                            <td className="whitespace-nowrap p-3">{formatoImporte(tramite.costoVigencia)}</td>
                            <td className="p-3"><BadgeVariacion comparativa={analisisCostos.get(tramite.id)} /></td>
                            <td className="whitespace-nowrap p-3">{formatoImporte(tramite.costoPorAnio)}</td>
                            <td className="p-3">{tramite.responsable}</td>
                            <td className="p-3">{tramite.proveedor}</td>
                            <td className="max-w-[220px] break-words p-3" title={tramite.nombreArchivo}>
                              {tramite.nombreArchivo ? (
                                <div className="flex min-w-0 flex-col items-start gap-2">
                                  <span className="break-all">📄 {tramite.nombreArchivo}</span>
                                  <button type="button" onClick={() => abrirDocumentoGuardado(tramite)}
                                    aria-label={`Ver PDF de ${tramite.nombreTramite}`}
                                    className="shrink-0 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-100">
                                    Ver PDF
                                  </button>
                                </div>
                              ) : 'Sin documento'}
                            </td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>}
                  </section>;
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">La variación histórica conserva la comparación original entre registros, aunque el periodo anterior quede fuera del filtro. Los documentos históricos vencidos pueden tener renovaciones posteriores.</p>
            </>
          )}
        </>
      )}

      {/* ===================================================
          MODAL
      =================================================== */}

      {mostrarModal && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">

          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4 border-b pb-2">

              <div>

                <h2 className="text-lg font-bold text-slate-800">
                  Nuevo Trámite Legal
                </h2>

                <p className="text-[11px] text-slate-500 mt-1">
                  El trámite se asociará automáticamente
                  con el catálogo seleccionado.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setMostrarModal(
                    false,
                  );

                  setArchivoSeleccionado(
                    null,
                  );
                }}
                className="text-slate-400 hover:text-red-600 text-xl"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleGuardar
              }
              className="grid grid-cols-2 gap-3 text-xs"
            >

              {/* =========================================
                  ÁREA
              ========================================= */}

              <div className="col-span-2">

                <label className="font-semibold block mb-1">
                  Área Relacionada
                </label>

                <select
                  value={
                    form.idArea || ''
                  }
                  onChange={(e) =>
                    handleCambiarArea(
                      Number(
                        e.target.value,
                      ),
                    )
                  }
                  disabled={
                    cargandoCatalogo ||
                    guardando
                  }
                  required
                  className="w-full border p-2 rounded bg-white"
                >

                  <option value="">
                    {cargandoCatalogo
                      ? 'Cargando áreas...'
                      : 'Seleccione un área'}
                  </option>

                  {areasDisponibles.map(
                    (area) => (

                      <option
                        key={
                          area.id_Area
                        }
                        value={
                          area.id_Area
                        }
                      >
                        {
                          area.nombre_Area
                        }
                      </option>

                    ),
                  )}

                </select>

              </div>

              {/* =========================================
                  TRÁMITE
              ========================================= */}

              <div className="col-span-2">

                <label className="font-semibold block mb-1">
                  Nombre del Trámite
                </label>

                <select
                  value={
                    form.idTramiteCatalogo ||
                    ''
                  }
                  onChange={(e) =>
                    handleCambiarTramite(
                      Number(
                        e.target.value,
                      ),
                    )
                  }
                  disabled={
                    !form.idArea ||
                    cargandoCatalogo ||
                    guardando
                  }
                  required
                  className="w-full border p-2 rounded bg-white"
                >

                  <option value="">
                    {!form.idArea
                      ? 'Primero seleccione un área'
                      : tramitesDisponibles.length === 0
                        ? 'No hay trámites disponibles'
                        : 'Seleccione un trámite'}
                  </option>

                  {tramitesDisponibles.map(
                    (tramite) => (

                      <option
                        key={
                          tramite.id_Tramite_Catalogo
                        }
                        value={
                          tramite.id_Tramite_Catalogo
                        }
                      >
                        {
                          tramite.nombre_Tramite
                        }
                      </option>

                    ),
                  )}

                </select>

                {form.idTramiteCatalogo >
                  0 && (

                  <div className="mt-1 text-[10px] text-slate-400">

                    ID del catálogo:{' '}

                    <span className="font-mono font-semibold">
                      {
                        form.idTramiteCatalogo
                      }
                    </span>

                  </div>

                )}

              </div>

              {/* =========================================
                  DURACIÓN
              ========================================= */}

              <div>

                <label className="font-semibold block mb-1">
                  Duración
                </label>

                <div className="flex gap-2">

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={
                      form.duracion
                    }
                    onChange={(e) =>
                      setForm(
                        (prev) => ({
                          ...prev,
                          duracion:
                            Number(
                              e.target.value,
                            ),
                        }),
                      )
                    }
                    disabled={
                      guardando
                    }
                    className="w-full border p-2 rounded"
                  />

                  <select
                    value={
                      form.unidadDuracion
                    }
                    onChange={(e) =>
                      setForm(
                        (prev) => ({
                          ...prev,
                          unidadDuracion:
                            e.target.value as
                              | 'anios'
                              | 'meses',
                        }),
                      )
                    }
                    disabled={
                      guardando
                    }
                    className="border p-2 rounded bg-slate-50 font-semibold"
                  >

                    <option value="anios">
                      Año(s)
                    </option>

                    <option value="meses">
                      Mes(es)
                    </option>

                  </select>

                </div>

                <p className="text-[10px] text-slate-400 mt-1">
                  Se almacena en años en la
                  base de datos.
                </p>

              </div>

              {/* =========================================
                  COSTO
              ========================================= */}

              <div>

                <label className="font-semibold block mb-1">
                  Costo por Vigencia ($)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={
                    form.costoVigencia
                  }
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        costoVigencia:
                          Number(
                            e.target.value,
                          ),
                      }),
                    )
                  }
                  disabled={
                    guardando
                  }
                  className="w-full border p-2 rounded"
                />

              </div>

              {/* =========================================
                  RESPONSABLE
              ========================================= */}

              <div>

                <label className="font-semibold block mb-1">
                  Responsable Interno
                </label>

                <input
                  type="text"
                  required
                  value={
                    form.responsable
                  }
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        responsable:
                          e.target.value,
                      }),
                    )
                  }
                  disabled={
                    guardando
                  }
                  className="w-full border p-2 rounded"
                />

              </div>

              {/* =========================================
                  PROVEEDOR
              ========================================= */}

              <div>

                <label className="font-semibold block mb-1">
                  Proveedor / Gestoría
                </label>

                <input
                  type="text"
                  required
                  value={
                    form.proveedor
                  }
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        proveedor:
                          e.target.value,
                      }),
                    )
                  }
                  disabled={
                    guardando
                  }
                  className="w-full border p-2 rounded"
                />

              </div>

              {/* =========================================
                  FECHA EXPEDICIÓN
              ========================================= */}

              <div>

                <label className="font-semibold block mb-1">
                  Fecha Expedición
                </label>

                <input
                  type="date"
                  required
                  value={
                    form.fechaExpedicion
                  }
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        fechaExpedicion:
                          e.target.value,
                      }),
                    )
                  }
                  disabled={
                    guardando
                  }
                  className="w-full border p-2 rounded"
                />

              </div>

              {/* =========================================
                  FECHA VENCIMIENTO
              ========================================= */}

              <div>

                <label className="font-semibold block mb-1 flex justify-between">

                  <span>
                    Fecha Vencimiento
                  </span>

                  <span className="text-[10px] text-blue-600 font-normal">
                    🔒 Calculada
                  </span>

                </label>

                <input
                  type="date"
                  readOnly
                  value={
                    form.fechaVencimiento
                  }
                  className="w-full border p-2 rounded bg-slate-100 text-slate-600 font-semibold"
                />

              </div>

              {/* =========================================
                  ESTATUS
              ========================================= */}

              <div className="col-span-2">

                <label className="font-semibold block mb-1">
                  Estatus del Trámite
                </label>

                <select
                  value={
                    form.estatus
                  }
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        estatus:
                          e.target
                            .value as EstatusTramite,
                      }),
                    )
                  }
                  disabled={
                    guardando
                  }
                  className="w-full border p-2 rounded bg-white"
                >

                  <option value="VIGENTE">
                    VIGENTE
                  </option>

                  <option value="EN_TRAMITE">
                    EN TRÁMITE
                  </option>

                  <option value="EN_RENOVACION">
                    EN RENOVACIÓN
                  </option>

                  <option value="VENCIDO">
                    VENCIDO
                  </option>

                </select>

              </div>

              {/* =========================================
                  PDF
              ========================================= */}

              <div className="col-span-2 bg-slate-50 p-3 rounded border border-slate-200">

                <div className="flex justify-between items-center mb-1">

                  <label className="font-semibold">
                    Documento PDF
                  </label>

                  <span className="text-[10px] text-red-600 font-semibold">
                    Obligatorio
                  </span>

                </div>

                <input
                  type="file"
                  accept="application/pdf"
                  required
                  disabled={
                    guardando
                  }
                  onChange={(e) =>
                    setArchivoSeleccionado(
                      e.target
                        .files?.[0] ??
                        null,
                    )
                  }
                  className="w-full border p-1 rounded text-xs bg-white"
                />

                {archivoSeleccionado && (

                  <div className="mt-2 flex items-center justify-between bg-white border rounded p-2">

                    <div className="min-w-0">

                      <p className="font-semibold text-emerald-700 truncate">
                        📄{' '}
                        {
                          archivoSeleccionado.name
                        }
                      </p>

                      <p className="text-[10px] text-slate-400">
                        {(
                          archivoSeleccionado.size /
                          1024 /
                          1024
                        ).toFixed(
                          2,
                        )}{' '}
                        MB
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={
                        abrirPreviewArchivo
                      }
                      className="ml-3 bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-1 rounded text-[11px] font-bold hover:bg-emerald-100"
                    >
                      👁️ Previsualizar
                    </button>

                  </div>

                )}

                <p className="text-[10px] text-slate-400 mt-2">
                  El PDF se almacenará directamente
                  en la base de datos.
                </p>

              </div>

              {/* =========================================
                  OBSERVACIONES
              ========================================= */}

              <div className="col-span-2">

                <label className="font-semibold block mb-1">
                  Observaciones / Notas
                </label>

                <textarea
                  rows={3}
                  maxLength={255}
                  value={
                    form.observaciones
                  }
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        observaciones:
                          e.target.value,
                      }),
                    )
                  }
                  disabled={
                    guardando
                  }
                  className="w-full border p-2 rounded"
                  placeholder="Observaciones del trámite..."
                />

                <p className="text-[10px] text-slate-400 text-right mt-1">
                  {
                    form.observaciones
                      .length
                  }
                  /255
                </p>

              </div>

              {/* =========================================
                  BOTONES
              ========================================= */}

              <div className="col-span-2 flex justify-end gap-2 mt-4 border-t pt-4">

                <button
                  type="button"
                  onClick={() => {
                    setMostrarModal(
                      false,
                    );

                    setArchivoSeleccionado(
                      null,
                    );
                  }}
                  disabled={
                    guardando
                  }
                  className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    guardando ||
                    !form.idArea ||
                    !form.idTramiteCatalogo ||
                    !archivoSeleccionado
                  }
                  className="px-4 py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {guardando
                    ? 'Guardando...'
                    : 'Guardar Trámite'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ===================================================
          VISOR PDF LOCAL Y GUARDADO
      =================================================== */}

      {visorAbierto && (

        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">

          <div role="dialog" aria-modal="true" aria-labelledby="titulo-visor-pdf" className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">

            <div className="flex justify-between items-center p-4 border-b bg-slate-100">

              <h3 id="titulo-visor-pdf" className="min-w-0 font-bold text-slate-800 text-sm truncate">
                {previewPdfNombre}
              </h3>

              <button
                onClick={
                  cerrarPreview
                }
                className="bg-red-600 text-white font-bold px-3 py-1 rounded hover:bg-red-700 text-xs"
              >
                Cerrar
              </button>

            </div>

            {cargandoPdf && <p role="status" className="p-8 text-center text-slate-500">Cargando documento...</p>}
            {errorPdf && <p role="alert" className="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorPdf}</p>}
            {previewPdfUrl && (
              <>
                <div className="flex flex-wrap gap-4 border-b px-4 py-2 text-xs text-blue-700">
                  <a href={previewPdfUrl} target="_blank" rel="noopener noreferrer" className="underline">Abrir en otra pestaña</a>
                  <a href={previewPdfUrl} download={previewPdfNombre} className="underline">Descargar PDF</a>
                </div>
                <iframe src={previewPdfUrl} className="min-h-0 w-full flex-1 border-0" title={`PDF: ${previewPdfNombre}`} />
              </>
            )}

          </div>

        </div>

      )}

    </main>
  );
}
