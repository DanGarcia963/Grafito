// Tipos para las muestras de calidad
export type EstadoMuestra = 'PENDIENTE' | 'EN_ANALISIS' | 'APROBADO' | 'RECHAZADO';
export type EtapaMuestra = 'MATERIA_PRIMA' | 'EN_PROCESO' | 'PRODUCTO_TERMINADO' | 'RETENIDO';

export interface MuestraCalidad {
  id_Muestra: number;
  no_Muestra: string;
  fecha_Toma: string;
  estado_muestra: EstadoMuestra;
  etapa_muestra: EtapaMuestra;

  tanque: {
    id: number;
    nombre: string;
  };
  lote: {
    id: number;
    no_Lote: string;
  };
  producto: {
    id: number;
    nombre: string;
  };
  cliente?: {
    id: number;
    nombre: string;
  };
  observaciones?: string;

}