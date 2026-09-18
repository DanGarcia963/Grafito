export type SemaforoTramite = 'verde' | 'amarillo' | 'naranja' | 'rojo';
export interface TramiteLegal {
    id: string;
    areaRelacionada: string;
    nombreTramite: string;
    duracionAnios: number;
    costoVigencia: number;
    costoPorAnio: number;
    responsable: string;
    proveedor: string;
    estatus: 'VIGENTE' | 'EN_TRAMITE' | 'EN_RENOVACION' | 'VENCIDO';
    fechaExpedicion: string;
    fechaVencimiento: string;
    semaforo?: SemaforoTramite;
    observaciones?: string;
    nombreArchivo?: string;
}
