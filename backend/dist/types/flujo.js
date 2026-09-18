"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESTADOS_FLUJO = void 0;
exports.ESTADOS_FLUJO = [
    { area: 'ventas', status: 'VENTA_REGISTRADA', esTermino: false, label: 'Venta Registrada' },
    { area: 'ventas', status: 'VENTA_CONFIRMADA', esTermino: true, label: 'Venta Confirmada (Pasa a Planificación)' },
    { area: 'plan_produccion', status: 'PLAN_EN_REVISION', esTermino: false, label: 'Plan en Revisión' },
    { area: 'plan_produccion', status: 'PLAN_PROGRAMADO', esTermino: true, label: 'Plan Programado (Pasa a Producción)' },
    { area: 'produccion', status: 'EN_PROCESO_FABRICACION', esTermino: false, label: 'En Proceso de Fabricación' },
    { area: 'produccion', status: 'PRODUCCION_TERMINADA', esTermino: true, label: 'Producción Terminada (Pasa a Calidad)' },
    { area: 'calidad', status: 'EN_ANALISIS_CALIDAD', esTermino: false, label: 'En Análisis de Calidad' },
    { area: 'calidad', status: 'RECHAZADO_CALIDAD', esTermino: false, label: 'Rechazado en Calidad' },
    { area: 'calidad', status: 'LIBERADO_CALIDAD', esTermino: true, label: 'Liberado por Calidad (Pasa a Almacén)' },
    { area: 'almacen', status: 'EN_RECEPCION_ALMACEN', esTermino: false, label: 'En Recepción Almacén' },
    { area: 'almacen', status: 'ALMACENADO', esTermino: true, label: 'Almacenado (Pasa a Logística)' },
    { area: 'logistica', status: 'EN_TRANSITO', esTermino: false, label: 'En Tránsito' },
    { area: 'logistica', status: 'ENTREGADO_A_CLIENTE', esTermino: true, label: 'Entregado (Pasa a Confirmación Cliente)' },
    { area: 'cliente', status: 'RECIBIDO_CONFORME', esTermino: true, label: 'Recibido Conforme por Cliente (Finalizado)' },
];
//# sourceMappingURL=flujo.js.map