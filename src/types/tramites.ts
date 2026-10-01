export type SemaforoTramite =
  | 'rojo'
  | 'naranja'
  | 'amarillo'
  | 'verde';

export type EstatusTramite =
  | 'VIGENTE'
  | 'EN_TRAMITE'
  | 'EN_RENOVACION'
  | 'VENCIDO';

export interface TramiteLegal {
  id: string;

  // Relación real con catalogo_tramites
  idTramiteCatalogo: number;

  // Datos provenientes del catálogo
  areaRelacionada: string;
  nombreTramite: string;

  // La BD lo guarda como Decimal
  duracionAnios: number;

  costoVigencia: number;
  costoPorAnio: number;

  responsable: string;
  proveedor: string;

  estatus: EstatusTramite;

  fechaExpedicion: string;
  fechaVencimiento: string;

  semaforo?: SemaforoTramite;

  observaciones?: string;

  // Solo el nombre del archivo.
  // El contenido real está en la BD.
  nombreArchivo?: string;
}
