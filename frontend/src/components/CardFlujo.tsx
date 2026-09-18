'use client';

import { VentaFlujo, Area, EstadoFlujo, ORDEN_AREAS } from '@/types/flujo';

interface CardFlujoProps {
  venta: VentaFlujo;
  areaUsuario?: Area;
  puedeEditar: boolean;
  onEditar: (venta: VentaFlujo) => void;
}

export function getAreaTurnoActivo(estadoActual: EstadoFlujo): Area {
  const indiceActual = ORDEN_AREAS.indexOf(estadoActual.area);
  if (indiceActual === -1) return estadoActual.area;

  if (estadoActual.esTermino) {
    const siguienteIndice = Math.min(indiceActual + 1, ORDEN_AREAS.length - 1);
    return ORDEN_AREAS[siguienteIndice];
  }
  if(estadoActual.area === 'calidad' && estadoActual.status === 'RECHAZADO_CALIDAD') 
  {
      const anteriorIndice = Math.max(indiceActual - 1, 0);
      return ORDEN_AREAS[anteriorIndice];
  }
  if(estadoActual.area === 'produccion' && estadoActual.status === 'LIBERADO_PRODUCCION') {
    const siguienteIndice = Math.min(indiceActual + 2, ORDEN_AREAS.length - 2);
    return ORDEN_AREAS[siguienteIndice];
  }

  return estadoActual.area;
}

export function CardFlujo({ venta, areaUsuario, puedeEditar, onEditar }: CardFlujoProps) {
  const { estadoActual } = venta;
  const areaTurnoActivo = estadoActual ? getAreaTurnoActivo(estadoActual) : null;
  const esMiTurno = areaUsuario && areaTurnoActivo === areaUsuario;
  const puedeEditarFlujo = puedeEditar && esMiTurno;

  return (
    <div
      onClick={() => puedeEditarFlujo && onEditar(venta)}
      className={`p-5 border-2 rounded-2xl shadow-sm transition bg-white relative ${
        puedeEditarFlujo
          ? 'border-slate-200 cursor-pointer hover:border-blue-500 hover:shadow-md'
          : 'border-slate-200 cursor-default opacity-95'
      }`}
    >
      {/* Encabezado Principal */}
      <div className="flex justify-between items-start mb-3 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
              ID Venta: {venta.idVenta}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold border border-slate-200">
              Urgencia: {venta.urgencia}
            </span>
            {esMiTurno && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300 animate-pulse">
                🔔 Turno de tu área
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-800 mt-1 inline-block">{venta.producto}</h3>
          <p className="text-sm text-slate-600">Cliente: <strong>{venta.cliente}</strong></p>
          <p className="text-sm text-slate-600">Observaciones: <strong>{venta.observacionesVentas}</strong></p>
        </div>

        <div className="flex flex-col items-end">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              estadoActual?.esTermino
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            [{estadoActual?.area.toUpperCase()}] - {estadoActual?.label}
          </span>
          {puedeEditarFlujo && (
            <span className="text-[11px] text-blue-600 font-semibold mt-1">
               Clic para capturar / actualizar estado
            </span>
          )}
        </div>
      </div>

      {/* Vista Detallada por Áreas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-700 mt-2">
        <div><strong>Vendedor:</strong> {venta.nombreVendedor}</div>
        <div><strong>Cantidad:</strong> {venta.cantidadVentas} {venta.unidadMedidaVentas}</div>
        <div><strong>Servicio:</strong> {venta.servicio}</div>
        <div><strong>F. Confirmación:</strong> {venta.fechaConfirmacion}</div>

        {(areaUsuario === 'plan_produccion' || venta.noOrdenProduccion) && (
          <div className="col-span-full bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">Plan de Producción:</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <p><strong>No. Orden:</strong> {venta.noOrdenProduccion || '-'}</p>
              <p><strong>Cant. Producir:</strong> {venta.cantidadAProducir || '-'}</p>
              <p><strong>F. Terminación:</strong> {venta.fechaTerminacionPlan || '-'}</p>
            </div>
          </div>
        )}

        {(areaUsuario === 'produccion' || venta.cantidadTotalProducida) && (
          <div className="col-span-full bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
            <span className="font-bold text-blue-900 block mb-1">Producción:</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <p><strong>Estatus:</strong> {venta.statusProduccion || '-'}</p>
              <p><strong>Cant. Producida:</strong> {venta.cantidadTotalProducida || '-'}</p>
              <p><strong>F. Término:</strong> {venta.fechaTerminoProduccion || '-'}</p>
            </div>
          </div>
        )}

        {(areaUsuario === 'calidad' || venta.liberacionCalidad) && (
          <div className="col-span-full bg-purple-50/50 p-2.5 rounded-lg border border-purple-100">
            <span className="font-bold text-purple-900 block mb-1">Control de Calidad:</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <p><strong>Liberación:</strong> {venta.liberacionCalidad || '-'}</p>
              <p><strong>Lote:</strong> {venta.loteCalidad || '-'}</p>
              <p><strong>Fecha Lib:</strong> {venta.fechaLiberacionCalidad || '-'}</p>
            </div>
          </div>
        )}

        {(areaUsuario === 'almacen' || venta.nombreQuienRecibio) && (
          <div className="col-span-full bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
            <span className="font-bold text-amber-900 block mb-1">Almacén:</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <p><strong>Recibió:</strong> {venta.nombreQuienRecibio || '-'}</p>
              <p><strong>Cant. Recibida:</strong> {venta.cantidadRecibidaAlmacen || '-'}</p>
              <p><strong>Llegada:</strong> {venta.fechaLlegadaAlmacen || '-'}</p>
            </div>
          </div>
        )}

        {(areaUsuario === 'logistica' || venta.nombreTransportista) && (
          <div className="col-span-full bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
            <span className="font-bold text-emerald-900 block mb-1">Logística:</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <p><strong>Transportista:</strong> {venta.nombreTransportista || '-'}</p>
              <p><strong>Cant. Entregada:</strong> {venta.cantidadEntregadaLogistica || '-'}</p>
              <p><strong>Salida:</strong> {venta.fechaSalidaLogistica || '-'}</p>
            </div>
          </div>
        )}

        {(areaUsuario === 'cliente' || venta.fechaEntregaCliente) && (
          <div className="col-span-full bg-green-100/60 p-2.5 rounded-lg border border-green-200">
            <span className="font-bold text-green-900 block mb-1">Cliente:</span>
            <p><strong>Fecha Entrega al Cliente:</strong> {venta.fechaEntregaCliente || '-'}</p>
          </div>
        )}
      </div>
    </div>
  );
}