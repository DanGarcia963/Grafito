export type EtapaProspeccion = 'REGISTRADA' | 'CONTACTADO' | 'CITA';

const etapasConCita = new Set([
  'RECOLECCION_AGENDADA',
  'MUESTRA_RECOLECTADA',
  'EN_ANALISIS_ID',
  'COTIZACION',
  'SEGUIMIENTO_COTIZACION',
  'GANADA',
]);

type OportunidadProspeccion = {
  etapa: string;
  fecha_recoleccion_agendada?: Date | string | null;
  historial?: Array<{
    accion: string;
    etapa_nueva?: string | null;
    fecha_contacto?: Date | string | null;
  }>;
};

/** Clasifica cada cuenta por la etapa más avanzada alcanzada en sus oportunidades. */
export function etapaProspeccion(
  oportunidades: OportunidadProspeccion[],
): EtapaProspeccion {
  const tuvoCita = oportunidades.some(
    (oportunidad) =>
      oportunidad.fecha_recoleccion_agendada != null ||
      etapasConCita.has(oportunidad.etapa) ||
      oportunidad.historial?.some(
        (evento) =>
          evento.etapa_nueva != null && etapasConCita.has(evento.etapa_nueva),
      ),
  );
  if (tuvoCita) return 'CITA';

  const tuvoContacto = oportunidades.some((oportunidad) =>
    oportunidad.historial?.some(
      (evento) => evento.accion === 'SEGUIMIENTO' || evento.fecha_contacto != null,
    ),
  );
  return tuvoContacto ? 'CONTACTADO' : 'REGISTRADA';
}

export function etiquetaOrigenProspecto(
  tipo: string | null | undefined,
  detalle: string | null | undefined,
  legado: string | null | undefined,
): string {
  const textoDetalle = detalle?.trim();
  switch (tipo) {
    case 'MARKETING_DIGITAL':
      return 'Marketing Digital';
    case 'EXPOSICION':
      return textoDetalle ? `Exposición · ${textoDetalle}` : 'Exposición';
    case 'REFERENCIA':
      return textoDetalle ? `Referencia · ${textoDetalle}` : 'Referencia';
    default:
      return legado?.trim() || 'Sin clasificar';
  }
}
