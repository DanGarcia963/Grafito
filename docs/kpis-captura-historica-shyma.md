# KPIs SHyMA — Captura histórica desde el calendario

## Comportamiento

- La matriz-calendario de resultados permite abrir el formulario desde cada celda sin registro, PENDIENTE o BORRADOR, siempre que el periodo esté cerrado, sea válido y tenga exactamente una versión de configuración aplicable.
- El botón de registro solo está disponible fuera del modo presentación. Al entrar en presentación cualquier diálogo de captura se cierra y la interfaz queda de solo lectura.
- Se respeta la periodicidad definida por el indicador: mensual, trimestral, semestral o anual. No se crean meses artificiales para los KPIs con periodicidad distinta.
- Los resultados se guardan como BORRADOR o EN_REVISION. Ninguno altera la estadística oficial hasta que otro usuario de Seguridad revise y apruebe.
- Cada captura tiene tipo y unidad definidos por la configuración, meta, versión, periodo, fecha límite original, fuente histórica, fecha del documento, datos base de cálculo si corresponde, observaciones, análisis, acciones, motivo y autor/fecha real.
- Las desviaciones requieren análisis y acciones antes del envío a revisión.
- Si requiere evidencia, el envío a revisión exige un archivo válido PDF/PNG/JPG/XLSX hasta 8 MB; se almacena en kpi_evidencias y se enlaza a la revisión de kpi_resultado_historial.
- Captura nueva crea revisión 1 con CREACION; corrección de un borrador crea revisión sucesiva CORRECCION, conservando historial previo y sin borrar evidencias.
- La aprobación requiere un usuario Seguridad distinto al capturista, motivo documentado y evidencia actual si está configurada como requerida. Genera APROBACION con nueva revisión y referencia a los documentos validados; solo después el dato cuenta como oficial.

## Protección de integridad

- Sesión y permisos verificados en backend con AuthGuard + KpisAccessGuard.
- Bloqueo del registro de indicador en transacción para impedir dos inserciones simultáneas y constraint único de resultado por indicador y periodo.
- Rechazo de periodos futuros, fuera de vigencia, fraccionados o con configuración ambigua.
- Control de versión/revisión esperado para prevenir sobrescribir cambios concurrentes.
- Nunca sobrescribe resultados APROBADOS, EN_REVISION o NO_APLICA ni permite cambiar la versión ligada a un resultado existente.
- Sin migración SQL: utiliza kpi_resultados, kpi_resultado_historial, kpi_evidencias, kpi_configuraciones y kpi_indicadores existentes.
- No afecta Matriz Legal ni tablas ajenas al módulo KPIs.

## Endpoints

- POST /api/kpis/capturas-historicas — multipart con campos de resultado, configuración, periodo, metadatos y evidencia.
- POST /api/kpis/resultados/:id/aprobar — JSON con motivo y revisión esperada, solo un revisor distinto al capturista.
- GET /api/kpis/configuraciones/:id/captura — metadatos de configuración para formulario.

## Despliegue

- Requiere que el nuevo Supabase tenga las tablas KPI del esquema Prisma actual; no es necesario un ALTER TABLE nuevo.
- Deploy backend antes de frontend. Verificar en la base conectada a Railway que se crea una captura histórica de prueba, aparece en vista preliminar y no se cuenta en las tarjetas oficiales hasta aprobación.
- Verificar que el usuario SHyMA no puede guardar en modo presentación y que una cuenta externa al área Seguridad recibe 403 en las rutas de escritura.

## Pruebas

- Backend test/kpis-captura-historica.test.cjs cubre fechas bisiestas, periodicidad, vigencia, precisión, fórmulas, metas, opciones, booleanos y estados.
- La CI compila ambos proyectos con sus dependencias existentes.