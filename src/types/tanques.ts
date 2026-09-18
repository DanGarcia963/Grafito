export type ProductoGrafito = 'Forgemaster' | 'Polymaster' | 'Fagor';
export type CategoriaGrafito = 'LIBERADO' | 'SUCIO' | 'REZAGADO' | 'FE' | 'NUEVO';
export type EstadoTanqueStatus = 
  | 'EVAPORANDO' 
  | 'POR_AJUSTAR' 
  | 'VACIO' 
  | 'EVAPORANDO_Y_DESMETALIZANDO' 
  | 'MUESTREO'
  | 'DESMETALIZANDO'
  | 'POR_DESCARGAR'
  | 'DESCARGANDO'
  | 'PROCESO'
  | 'AJUSTADO'
  | 'CARGANDO_TANQUE'
  | 'ESPERA_CALIDAD' // <-- NUEVO ESTADO AGREGADO
  | 'LIBERADO_CALIDAD'; // <-- NUEVO ESTADO AGREGADO

  export type statusTanque =
  | 'OPERATIVO' 
  | 'MANTENIMIENTO'
  | 'FUERA_DE_SERVICIO';

export interface ContenedorGrafito {
  id: string;
  lote: string;
  producto: ProductoGrafito;
  categoria: CategoriaGrafito;
  cantidadContenedores: number;
  numVuelta?: string; // Ej: "2DA", "5TA", "14va"
  idLoteProduccion?: number; // <-- AGREGA ESTA LÍNEA
}

export interface Tanque {
  id: number; // 1 al 6
  nombre: string; // "TQ 1", "TQ 2", etc.
  prensa: string; // "POLYMASTER 6TA", "FORGE 2DA", etc.
  cantidad: number;
  status: statusTanque; // "OPERATIVO", "MANTENIMIENTO", "FUERA_DE_SERVICIO"
  estatus_proceso: EstadoTanqueStatus; // "VACIO", "CARGANDO_TANQUE", etc.
  loteActual?: ContenedorGrafito | null;
}