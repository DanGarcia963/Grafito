type EstadoPaso =
  'COMPLETADO' | 'EN_PROCESO' | 'PENDIENTE' | 'CON_INCIDENCIAS' | 'NO_APLICA';

const numero = (value: unknown) => Number(value ?? 0);
const suma = (values: unknown[]) =>
  values.reduce<number>((total, value) => total + numero(value), 0);

function paso(key: string, label: string, estado: EstadoPaso, detalle: string) {
  return { key, label, estado, detalle };
}

/** Deriva el cumplimiento comercial a partir de recepciones, OP, LP y entregas. */
export function calcularCumplimientoOV(orden: any) {
  const ordenesProduccion: any[] = orden.ordenes_produccion ?? [];
  const lotes = ordenesProduccion.flatMap((op) => op.lotes_produccion ?? []);
  const lotesActivos = lotes.filter((lote) => lote.estado !== 'CANCELADO');
  const ordenesActivas = ordenesProduccion.filter(
    (op) => op.estado_Plan !== 'CANCELADA',
  );

  const lotesEntrada = (orden.materiales_recibidos ?? []).filter(
    (lote: any) => lote.origen === 'RECEPCION' && lote.recepcion,
  );
  const recepciones = [
    ...new Map(
      lotesEntrada.map((lote: any) => [lote.recepcion.id, lote.recepcion]),
    ).values(),
  ].filter((recepcion: any) => recepcion.estado_recepcion !== 'CANCELADA');
  const requiereRecepcion =
    orden.tipo_venta === 'SERVICIO_REGENERACION' || recepciones.length > 0;

  const entregas = (orden.entregas ?? []).filter(
    (entrega: any) => entrega.estado_entrega !== 'CANCELADA',
  );
  const detallesEntrega = entregas.flatMap((entrega: any) =>
    (entrega.detalles ?? []).map((detalle: any) => ({
      ...detalle,
      estado_entrega: entrega.estado_entrega,
    })),
  );
  const cantidadSolicitada = numero(orden.cantidad);
  const cantidadDespachada = suma(
    detallesEntrega
      .filter((detalle: any) =>
        ['DESPACHADA', 'ENTREGADA'].includes(detalle.estado_entrega),
      )
      .map((detalle: any) => detalle.cantidad),
  );
  const cantidadEntregada = suma(
    detallesEntrega
      .filter((detalle: any) => detalle.estado_entrega === 'ENTREGADA')
      .map((detalle: any) => detalle.cantidad_recibida),
  );
  const porcentajeEntregado =
    cantidadSolicitada > 0
      ? Math.min(
          100,
          Math.round((cantidadEntregada / cantidadSolicitada) * 100),
        )
      : 0;

  const embarquesPorLote = new Map<
    number,
    { cantidad_despachada: number; cantidad_entregada: number }
  >();
  for (const detalle of detallesEntrega) {
    const loteId = detalle.lote?.lote_produccion_id;
    if (!loteId) continue;
    const actual = embarquesPorLote.get(loteId) ?? {
      cantidad_despachada: 0,
      cantidad_entregada: 0,
    };
    if (['DESPACHADA', 'ENTREGADA'].includes(detalle.estado_entrega))
      actual.cantidad_despachada += numero(detalle.cantidad);
    if (detalle.estado_entrega === 'ENTREGADA')
      actual.cantidad_entregada += numero(detalle.cantidad_recibida);
    embarquesPorLote.set(loteId, actual);
  }

  const ordenesConAvance = ordenesProduccion.map((op) => ({
    ...op,
    lotes_produccion: (op.lotes_produccion ?? []).map((lote: any) => ({
      ...lote,
      cumplimiento_entrega: embarquesPorLote.get(lote.id_Lote_Produccion) ?? {
        cantidad_despachada: 0,
        cantidad_entregada: 0,
      },
    })),
  }));

  const conteosChecklist = recepciones.map((recepcion: any) => {
    const contenedores = recepcion.checklist_contenedor ?? [];
    const incidencias = contenedores.filter(
      (contenedor: any) =>
        contenedor.tapa_valvula ||
        contenedor.rejilla_danada ||
        contenedor.base_danada ||
        contenedor.derrame,
    ).length;
    return { recepcion, contenedores, incidencias };
  });
  const checklistConIncidencias = conteosChecklist.some(
    ({ recepcion, incidencias }: any) =>
      recepcion.estado_checklist === 'CON_INCIDENCIAS' || incidencias > 0,
  );
  const checklistCompleto =
    conteosChecklist.length > 0 &&
    conteosChecklist.every(
      ({ recepcion }: any) => recepcion.estado_checklist === 'COMPLETADO',
    );
  const checklistEnRevision = conteosChecklist.some(
    ({ recepcion }: any) => recepcion.estado_checklist === 'EN_REVISION',
  );

  const lotesLiberados = lotesActivos.filter(
    (lote) => lote.estado_Calida === 'LIBERADO',
  ).length;
  const lotesRechazados = lotesActivos.filter((lote) =>
    ['RECHAZADO', 'FUERA_DE_ESPECIFICACION'].includes(lote.estado_Calida),
  ).length;
  const lotesEnCalidad = lotesActivos.filter((lote) =>
    ['ESPERANDO_MUESTRA', 'EN_ANALISIS', 'APROBADO'].includes(
      lote.estado_Calida,
    ),
  ).length;
  const produccionIniciada =
    ordenesActivas.some(
      (op) =>
        op.estado_Plan === 'EN_PROCESO' ||
        op.estado_Plan === 'PAUSADA' ||
        op.fecha_Inicio_Produccion,
    ) || lotesActivos.some((lote) => lote.estado === 'EN_PROCESO');
  const produccionCompleta =
    ordenesActivas.length > 0 &&
    lotesActivos.length > 0 &&
    ordenesActivas.every((op) => op.estado_Plan === 'FINALIZADA') &&
    lotesActivos.every((lote) => lote.estado === 'FINALIZADO');
  const calidadCompleta =
    lotesActivos.length > 0 && lotesLiberados === lotesActivos.length;
  const hayAvanceParcial =
    lotesLiberados > 0 &&
    (lotesLiberados < lotesActivos.length ||
      ordenesActivas.some(
        (op) =>
          op.estado_Plan !== 'FINALIZADA' ||
          !(op.lotes_produccion ?? []).some(
            (lote: any) => lote.estado !== 'CANCELADO',
          ),
      ));
  const entregaCompleta =
    cantidadSolicitada > 0 && cantidadEntregada >= cantidadSolicitada - 0.0001;
  const hayTransito = entregas.some(
    (entrega: any) => entrega.estado_entrega === 'DESPACHADA',
  );
  const hayEntregaRegistrada = entregas.some(
    (entrega: any) => entrega.estado_entrega === 'ENTREGADA',
  );

  let estadoProduccion: EstadoPaso = 'PENDIENTE';
  if (produccionCompleta) estadoProduccion = 'COMPLETADO';
  else if (produccionIniciada) estadoProduccion = 'EN_PROCESO';

  let estadoCalidad: EstadoPaso = 'PENDIENTE';
  if (lotesRechazados > 0) estadoCalidad = 'CON_INCIDENCIAS';
  else if (calidadCompleta) estadoCalidad = 'COMPLETADO';
  else if (lotesEnCalidad > 0) estadoCalidad = 'EN_PROCESO';

  let estadoRecepcion: EstadoPaso = 'NO_APLICA';
  let detalleRecepcion = 'No aplica para esta orden.';
  if (requiereRecepcion) {
    if (recepciones.length === 0) {
      estadoRecepcion = 'PENDIENTE';
      detalleRecepcion =
        'No hay una recepción de material vinculada a esta OV; no se registra como tránsito.';
    } else if (
      recepciones.every(
        (recepcion: any) => recepcion.estado_recepcion === 'CONFIRMADA',
      )
    ) {
      estadoRecepcion = 'COMPLETADO';
      detalleRecepcion = `${recepciones.length} recepción(es) confirmada(s) en planta.`;
    } else {
      estadoRecepcion = 'EN_PROCESO';
      detalleRecepcion = `${recepciones.length} recepción(es) registrada(s); hay registros por confirmar.`;
    }
  }

  let estadoChecklist: EstadoPaso = 'NO_APLICA';
  let detalleChecklist = 'No aplica para esta orden.';
  if (requiereRecepcion) {
    if (recepciones.length === 0) {
      estadoChecklist = 'PENDIENTE';
      detalleChecklist = 'Pendiente de recepción y revisión de contenedores.';
    } else if (checklistConIncidencias) {
      estadoChecklist = 'CON_INCIDENCIAS';
      detalleChecklist = 'Hay daños o incidencias registradas en contenedores.';
    } else if (checklistCompleto) {
      estadoChecklist = 'COMPLETADO';
      detalleChecklist =
        'Checklist completado para todas las recepciones vinculadas.';
    } else if (checklistEnRevision) {
      estadoChecklist = 'EN_PROCESO';
      detalleChecklist = 'Calidad está revisando los contenedores.';
    } else {
      estadoChecklist = 'PENDIENTE';
      detalleChecklist = 'Hay recepción registrada sin checklist completado.';
    }
  }

  let estadoEntrega: EstadoPaso = 'PENDIENTE';
  let detalleEntrega = 'Aún no hay entregas logísticas registradas.';
  if (entregaCompleta) {
    estadoEntrega = 'COMPLETADO';
    detalleEntrega = 'La cantidad confirmada de entrega cubre la OV.';
  } else if (hayTransito) {
    estadoEntrega = 'EN_PROCESO';
    detalleEntrega =
      'Hay material despachado que aún no se confirma como recibido.';
  } else if (hayEntregaRegistrada) {
    estadoEntrega = 'EN_PROCESO';
    detalleEntrega =
      'Entrega registrada parcialmente o pendiente de completar cantidades recibidas.';
  } else if (
    entregas.some((entrega: any) => entrega.estado_entrega === 'BORRADOR')
  ) {
    estadoEntrega = 'EN_PROCESO';
    detalleEntrega = 'Hay una entrega en preparación.';
  } else if (calidadCompleta && produccionCompleta) {
    detalleEntrega =
      'Producción y Calidad finalizaron; falta registrar el despacho.';
  } else {
    detalleEntrega = 'Pendiente de liberar la producción antes del despacho.';
  }

  const pasos = [
    paso('RECEPCION', 'Ingreso a planta', estadoRecepcion, detalleRecepcion),
    paso(
      'CHECKLIST',
      'Revisión de contenedores',
      estadoChecklist,
      detalleChecklist,
    ),
    paso(
      'PRODUCCION',
      'Producción',
      estadoProduccion,
      ordenesActivas.length
        ? `${ordenesActivas.length} OP activa(s); ${lotesActivos.length} lote(s) de producción.`
        : 'Aún no hay una OP activa vinculada.',
    ),
    paso(
      'CALIDAD',
      'Liberación de Calidad',
      estadoCalidad,
      `${lotesLiberados} de ${lotesActivos.length} LP liberados${lotesRechazados ? `; ${lotesRechazados} rechazado(s)` : ''}.`,
    ),
    paso('ENTREGA', 'Despacho y entrega', estadoEntrega, detalleEntrega),
  ];

  let estado = 'PENDIENTE_OP';
  if (orden.estado === 'CANCELADA') estado = 'CANCELADA';
  else if (entregaCompleta) estado = 'ENTREGADA';
  else if (hayTransito)
    estado = cantidadEntregada > 0 ? 'ENTREGA_PARCIAL' : 'EN_TRANSITO';
  else if (hayEntregaRegistrada || cantidadEntregada > 0)
    estado = 'ENTREGA_PARCIAL';
  else if (checklistConIncidencias || lotesRechazados > 0)
    estado = 'ATENCION_REQUERIDA';
  else if (hayAvanceParcial) estado = 'AVANCE_PARCIAL';
  else if (calidadCompleta && produccionCompleta) estado = 'LISTA_PARA_ENTREGA';
  else if (lotesEnCalidad > 0) estado = 'CONTROL_DE_CALIDAD';
  else if (produccionIniciada) estado = 'EN_PRODUCCION';
  else if (ordenesActivas.length > 0) estado = 'PRODUCCION_PROGRAMADA';
  else if (requiereRecepcion && recepciones.length === 0)
    estado = 'ESPERANDO_RECEPCION';
  else if (
    requiereRecepcion &&
    recepciones.length > 0 &&
    estadoChecklist !== 'COMPLETADO'
  )
    estado = 'REVISION_CONTENEDORES';

  const etiquetas: Record<string, string> = {
    CANCELADA: 'Cancelada',
    ENTREGADA: 'Entregada',
    ENTREGA_PARCIAL: 'Entrega parcial',
    EN_TRANSITO: 'En tránsito',
    ATENCION_REQUERIDA: 'Atención requerida',
    AVANCE_PARCIAL: 'Avance parcial',
    LISTA_PARA_ENTREGA: 'Lista para entrega',
    CONTROL_DE_CALIDAD: 'En control de Calidad',
    EN_PRODUCCION: 'En producción',
    PRODUCCION_PROGRAMADA: 'Producción programada',
    ESPERANDO_RECEPCION: 'Pendiente de ingreso a planta',
    REVISION_CONTENEDORES: 'Revisión de contenedores',
    PENDIENTE_OP: 'Pendiente de OP',
  };

  return {
    ordenes_produccion: ordenesConAvance,
    cumplimiento: {
      estado,
      etiqueta: etiquetas[estado] ?? estado,
      pasos,
      cantidad_solicitada: cantidadSolicitada,
      cantidad_despachada: cantidadDespachada,
      cantidad_entregada: cantidadEntregada,
      porcentaje_entregado: porcentajeEntregado,
      ordenes: {
        total: ordenesProduccion.length,
        activas: ordenesActivas.length,
      },
      lotes: {
        total: lotesActivos.length,
        liberados: lotesLiberados,
        en_calidad: lotesEnCalidad,
        rechazados: lotesRechazados,
        en_produccion: lotesActivos.filter(
          (lote) => lote.estado === 'EN_PROCESO',
        ).length,
      },
      recepciones: conteosChecklist.map(
        ({ recepcion, contenedores, incidencias }: any) => ({
          id: recepcion.id,
          folio: recepcion.no_lote,
          fecha_llegada: recepcion.fecha_llegada,
          fecha_revision: recepcion.fecha_Revision,
          estado_recepcion: recepcion.estado_recepcion,
          estado_checklist: recepcion.estado_checklist,
          reviso_nombre: recepcion.reviso_nombre,
          incidencias,
          contenedores,
        }),
      ),
    },
  };
}
