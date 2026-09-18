import { TramiteLegal } from '@/types/tramites';

export interface ComparativaPago {
  tramiteId: string;
  areaRelacionada: string;
  nombreTramite: string;
  anioActual: number;
  costoActual: number;
  anioAnterior?: number;
  costoAnterior?: number;
  diferenciaNominal?: number; // ej. +$1,500 o -$500
  porcentajeVariacion?: number; // ej. +10% o -5%
  tendencia: 'AUMENTO' | 'DISMINUCION' | 'SIN_CAMBIO' | 'SIN_HISTORIAL';
}

export function analizarVariacionPagos(tramites: TramiteLegal[]): Map<string, ComparativaPago> {
  const comparativasMap = new Map<string, ComparativaPago>();

  // 1. Agrupar trámites por "Área + Nombre del Trámite"
  const grupos = new Map<string, TramiteLegal[]>();

  tramites.forEach((t) => {
    // Normalizamos clave ignorando espacios/mayúsculas
    const clave = `${t.areaRelacionada.trim().toLowerCase()}_${t.nombreTramite.trim().toLowerCase()}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, []);
    }
    grupos.get(clave)!.push(t);
  });

  // 2. Para cada grupo, ordenar por fecha de expedición / vencimiento asc
  grupos.forEach((items) => {
    const itemsOrdenados = [...items].sort((a, b) => {
      const fechaA = new Date(a.fechaExpedicion || a.fechaVencimiento).getTime();
      const fechaB = new Date(b.fechaExpedicion || b.fechaVencimiento).getTime();
      return fechaA - fechaB;
    });

    // Analizamos de par en par
    itemsOrdenados.forEach((actual, index) => {
      const anioActual = new Date(actual.fechaExpedicion || actual.fechaVencimiento).getFullYear();
      const costoActual = actual.costoVigencia;

      if (index === 0) {
        // Es el registro más antiguo registrado de este trámite
        comparativasMap.set(actual.id, {
          tramiteId: actual.id,
          areaRelacionada: actual.areaRelacionada,
          nombreTramite: actual.nombreTramite,
          anioActual,
          costoActual,
          tendencia: 'SIN_HISTORIAL',
        });
      } else {
        const anterior = itemsOrdenados[index - 1];
        const anioAnterior = new Date(anterior.fechaExpedicion || anterior.fechaVencimiento).getFullYear();
        const costoAnterior = anterior.costoVigencia;

        const diferenciaNominal = costoActual - costoAnterior;
        const porcentajeVariacion = costoAnterior > 0 
          ? (diferenciaNominal / costoAnterior) * 100 
          : 0;

        let tendencia: ComparativaPago['tendencia'] = 'SIN_CAMBIO';
        if (diferenciaNominal > 0) tendencia = 'AUMENTO';
        else if (diferenciaNominal < 0) tendencia = 'DISMINUCION';

        comparativasMap.set(actual.id, {
          tramiteId: actual.id,
          areaRelacionada: actual.areaRelacionada,
          nombreTramite: actual.nombreTramite,
          anioActual,
          costoActual,
          anioAnterior,
          costoAnterior,
          diferenciaNominal,
          porcentajeVariacion: Number(porcentajeVariacion.toFixed(1)),
          tendencia,
        });
      }
    });
  });

  return comparativasMap;
}