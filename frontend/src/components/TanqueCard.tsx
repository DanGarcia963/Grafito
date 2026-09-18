'use client';

import { Tanque, EstadoTanqueStatus, statusTanque } from '@/types/tanques';

const BADGE_STATUS: Record<EstadoTanqueStatus, { style: string; label: string }> = {
  'VACIO': { style: 'bg-gray-100 text-gray-500 border-gray-200', label: 'VACÍO' },
  'CARGANDO_TANQUE': { style: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'CARGANDO_TANQUE' },
  'EVAPORANDO': { style: 'bg-blue-100 text-blue-800 border-blue-300', label: 'EVAPORANDO' },
  'POR_AJUSTAR': { style: 'bg-amber-100 text-amber-800 border-amber-300', label: 'POR_AJUSTAR' },
  'AJUSTADO': { style: 'bg-green-100 text-green-800 border-green-300', label: 'AJUSTADO' },
  'EVAPORANDO_Y_DESMETALIZANDO': { style: 'bg-purple-100 text-purple-800 border-purple-300', label: 'EVAPORANDO_Y_DESMETALIZANDO' },
  'DESMETALIZANDO': { style: 'bg-indigo-100 text-indigo-800 border-indigo-300', label: 'DESMETALIZANDO' },
  'POR_DESCARGAR': { style: 'bg-orange-100 text-orange-800 border-orange-300', label: 'POR_DESCARGAR' },
  'DESCARGANDO': { style: 'bg-teal-100 text-teal-800 border-teal-300', label: 'DESCARGANDO' },
  'PROCESO': { style: 'bg-sky-100 text-sky-800 border-sky-300', label: 'PROCESO' },
  'MUESTREO': { style: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'MUESTREO' },
  'ESPERA_CALIDAD': { style: 'bg-pink-100 text-pink-800 border-pink-300', label: 'ESPERA_CALIDAD' },
  'LIBERADO_CALIDAD': { style: 'bg-green-100 text-green-800 border-green-300', label: 'LIBERADO_CALIDAD' },
};

const STATUS_TANQUE: Record<statusTanque, { style: string; label: string }> = {
  'OPERATIVO': { style: 'bg-green-100 text-green-800 border-green-300', label: 'OPERATIVO' },
  'MANTENIMIENTO': { style: 'bg-amber-100 text-amber-800 border-amber-300', label: 'MANTENIMIENTO' },
  'FUERA_DE_SERVICIO': { style: 'bg-red-100 text-red-800 border-red-300', label: 'FUERA_DE_SERVICIO' },
};

const DEFAULT_BADGE = 'bg-gray-100 text-gray-600 border-gray-300';

export default function TanqueCard({
  tanque,
  onCambiarStatus,
  onVaciarTanque,
}: {
  tanque: Tanque;
  onCambiarStatus: (idTanque: number, nuevoStatus: EstadoTanqueStatus) => void;
  onVaciarTanque: (idTanque: number) => void;
}) {
  const { loteActual } = tanque;

  // Garantizamos normalización y fallback seguro
  const currentStatus = (tanque.estatus_proceso || 'VACIO') as EstadoTanqueStatus;
  const badgeConfig = BADGE_STATUS[currentStatus] || { style: DEFAULT_BADGE, label: currentStatus };
  const statusConfig = STATUS_TANQUE[tanque.status] || { style: DEFAULT_BADGE, label: tanque.status };

  return (
    <div className="bg-white border-2 rounded-xl p-4 shadow-sm flex flex-col justify-between h-full border-slate-200 hover:border-slate-300 transition">
      <div>
        {/* Cabecera del Tanque */}
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">{tanque.nombre}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusConfig.style}`}>
              {statusConfig.label}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeConfig.style}`}>
            {badgeConfig.label}
          </span>
        </div>

        {/* Detalle del Contenido */}
        {loteActual ? (
          <div className="space-y-1.5 text-xs">
            <p><span className="text-slate-500 font-medium">Lote:</span> <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-bold">{loteActual.lote}</code></p>
            <p><span className="text-slate-500 font-medium">Producto:</span> <strong className="text-blue-900">{loteActual.producto}</strong></p>
            <p><span className="text-slate-500 font-medium">Vuelta:</span> {loteActual.numVuelta || 'N/A'}</p>
            <p><span className="text-slate-500 font-medium">Contenedores:</span> {loteActual.cantidadContenedores}</p>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 italic text-xs">
            Tanque disponible / Vacío
          </div>
        )}
      </div>

      {/* Controles de Operación */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
        <select
          value={currentStatus}
          onChange={(e) => onCambiarStatus(tanque.id, e.target.value as EstadoTanqueStatus)}
          className="text-xs border rounded p-1 bg-slate-50 font-semibold text-slate-700 w-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {Object.entries(BADGE_STATUS).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>

        {loteActual && (
          <button
            onClick={() => onVaciarTanque(tanque.id)}
            className="text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-2 py-1 rounded font-semibold transition"
          >
            Vaciar
          </button>
        )}
      </div>
    </div>
  );
}