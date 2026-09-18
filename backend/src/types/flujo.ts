export type Area = 
  | 'ventas' 
  | 'plan_produccion' 
  | 'produccion' 
  | 'calidad' 
  | 'almacen' 
  | 'logistica' 
  | 'cliente';

export type Rol = 'visualizacion' | 'editor';

export interface EstadoFlujo {
  area: Area;
  status: string;
  esTermino: boolean;
  label: string;
}

// Catálogo de estados disponibles por área
export const ESTADOS_FLUJO: EstadoFlujo[] = [
  // VENTAS
  { area: 'ventas', status: 'VENTA_REGISTRADA', esTermino: false, label: 'Venta Registrada' },
  { area: 'ventas', status: 'VENTA_CONFIRMADA', esTermino: true, label: 'Venta Confirmada (Pasa a Planificación)' },

  // PLAN DE PRODUCCIÓN
  { area: 'plan_produccion', status: 'PLAN_EN_REVISION', esTermino: false, label: 'Plan en Revisión' },
  { area: 'plan_produccion', status: 'PLAN_PROGRAMADO', esTermino: true, label: 'Plan Programado (Pasa a Producción)' },

  // PRODUCCIÓN
  { area: 'produccion', status: 'EN_PROCESO_FABRICACION', esTermino: false, label: 'En Proceso de Fabricación' },
  { area: 'produccion', status: 'PRODUCCION_TERMINADA', esTermino: true, label: 'Producción Terminada (Pasa a Calidad)' },

  // CONTROL DE CALIDAD
  { area: 'calidad', status: 'EN_ANALISIS_CALIDAD', esTermino: false, label: 'En Análisis de Calidad' },
  { area: 'calidad', status: 'RECHAZADO_CALIDAD', esTermino: false, label: 'Rechazado en Calidad' },
  { area: 'calidad', status: 'LIBERADO_CALIDAD', esTermino: true, label: 'Liberado por Calidad (Pasa a Almacén)' },

  // ALMACÉN
  { area: 'almacen', status: 'EN_RECEPCION_ALMACEN', esTermino: false, label: 'En Recepción Almacén' },
  { area: 'almacen', status: 'ALMACENADO', esTermino: true, label: 'Almacenado (Pasa a Logística)' },

  // LOGÍSTICA
  { area: 'logistica', status: 'EN_TRANSITO', esTermino: false, label: 'En Tránsito' },
  { area: 'logistica', status: 'ENTREGADO_A_CLIENTE', esTermino: true, label: 'Entregado (Pasa a Confirmación Cliente)' },

  // CLIENTE
  { area: 'cliente', status: 'RECIBIDO_CONFORME', esTermino: true, label: 'Recibido Conforme por Cliente (Finalizado)' },
];

export interface VentaFlujo {
  id: number;
  // Estado actual del flujo
  estadoActual: EstadoFlujo;

  // 1. Datos Ventas
  idVenta: string;
  nombreVendedor: string;
  cliente: string;
  lineaProduccion: string;
  producto: string;
  servicio: string;
  presentacion: string;
  cantidadVentas: number;
  unidadMedidaVentas: string;
  fechaConfirmacion: string;
  fechaCompromisoPago: string;
  horaCompromisoPago: string;
  confirmacion: string;
  urgencia: string;
  observacionesVentas: string;

  // 2. Datos Plan de Producción
  cantidadAProducir?: number;
  unidadMedidaPlan?: string;
  fechaTerminacionPlan?: string;
  horaTerminacionPlan?: string;
  noOrdenProduccion?: string;
  inconformidadPlaneacion?: string;
  observacionesPlan?: string;

  // 3. Datos Producción
  statusProduccion?: string;
  fechaInicioProduccion?: string;
  fechaTerminoProduccion?: string;
  horaTerminoProduccion?: string;
  cantidadTotalProducida?: number;
  unidadMedidaProduccion?: string;
  observacionesProduccion?: string;

  // 4. Datos Control de Calidad
  liberacionCalidad?: string;
  fechaLiberacionCalidad?: string;
  horaLiberacionCalidad?: string;
  loteCalidad?: string;
  cantidadCalidad?: number;
  observacionesCalidad?: string;

  // 5. Datos Almacén
  cantidadRecibidaAlmacen?: number;
  unidadMedidaAlmacen?: string;
  fechaLlegadaAlmacen?: string;
  horaLlegadaAlmacen?: string;
  nombreQuienRecibio?: string;
  observacionesAlmacen?: string;

  // 6. Datos Logística
  nombreTransportista?: string;
  cantidadEntregadaLogistica?: number;
  fechaSalidaLogistica?: string;
  horaSalidaLogistica?: string;
  observacionesLogistica?: string;

  // 7. Datos Cliente
  fechaEntregaCliente?: string;
}