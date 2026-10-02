# CRM: cuentas, oportunidades, muestras y órdenes comerciales

La implementación utiliza el esquema CRM existente de `prisma/schema.prisma`.
No requiere ejecutar `db push`, reiniciar Supabase ni recrear tablas.

## Flujo operativo

1. Ventas registra el prospecto en **Prospectos y clientes** o selecciona la persona existente. El perfil conserva contacto, vendedor responsable y frecuencia acordada.
2. **Oportunidades → Agendar recolección** crea una necesidad de compra independiente, incluso sin producto definido ni muestra física.
3. Dentro de la oportunidad se registran una o varias muestras. Esto cambia la etapa comercial a **En análisis ID**, pero únicamente abre el tramo técnico de traslado. Recepción, espera y ejecución mantienen sus eventos separados.
4. ID termina todos los procesos y emite el dictamen de cada muestra. Después publica el **Reporte comercial de ID**, con resumen obligatorio y documento Word/PDF opcional. Todas las muestras asociadas son requeridas y deben terminarse. Un rechazo histórico puede resolverse con una muestra nueva aprobada; ID decide el resultado global.
5. Un reporte **Viable** habilita cotizaciones. **No viable** y **Requiere nueva muestra** mantienen la oportunidad en ID para decidir un cierre o registrar otra muestra. Un nuevo ciclo/muestra o la anulación del reporte invalida el reporte vigente y las cotizaciones activas.
6. Ventas guarda cotizaciones como versiones inmutables, registra el envío y luego la respuesta del cliente. Una revisión cancela la versión activa anterior sin borrar su contenido. Se valida importe, moneda y vigencia.
7. La aceptación por sí sola no convierte al prospecto. **Confirmar orden de venta** crea `crm_ordenes_venta`, cierra como ganada y convierte la cuenta en la misma transacción. Confirmar nuevamente la misma cotización devuelve la orden existente.
8. **Órdenes de venta → Enviar a producción** crea una OP vinculada. El esquema de producción admite cantidades enteras; las comerciales conservan cuatro decimales. Se muestran estado de planeación y etapa de flujo de las OP.
9. La siguiente necesidad de compra abre otra oportunidad para la misma persona. Repeticiones del análisis para la misma necesidad permanecen en su oportunidad original.

## Continuidad del trabajo de ID

El cierre comercial PERDIDA o CANCELADA no detiene recepción, planificación,
ejecución, dictamen ni reanálisis de muestras ya registradas. ID puede publicar o
anular el reporte pendiente; la oportunidad conserva su cierre y no habilita una
cotización. Abrir un nuevo ciclo invalida el reporte anterior y las cotizaciones,
sin borrar los tiempos ni los resultados de ciclos anteriores.

Una oportunidad GANADA conserva el reporte que respalda la venta. Para una nueva
necesidad se abre otra oportunidad con su muestra; no se modifica retroactivamente
el análisis de una venta confirmada. Las muestras históricas sin oportunidad
mantienen su flujo técnico completo y pueden vincularse durante el análisis.

Las citas y próximos contactos se envían con la zona horaria del navegador,
evitando interpretar la hora local del vendedor como UTC.

## Históricos

Las muestras y bitácoras anteriores no se eliminan ni se convierten automáticamente en ventas confirmadas. Desde una oportunidad, **Vincular muestra anterior** permite asociar una muestra sin oportunidad de la misma cuenta y vendedor. Su historial técnico queda intacto. Los eventos antiguos de CRM en `proceso_eventos` permanecen conservados.

Una persona que ya era CLIENTE al incorporarse al perfil comercial conserva esa condición. Sin evidencia histórica de órdenes comerciales no se inventa una fecha de primera conversión ni un intervalo de recompra. Su alta administrativa como perfil no cuenta como un nuevo prospecto ganado.

## Métricas

- Conversión: personas de la cohorte de alta de prospectos con una orden válida al corte / prospectos de esa cohorte. Los clientes históricos sin fecha de conversión se excluyen de esa cohorte.
- Efectividad: ganadas / (ganadas + perdidas), por fecha de cierre. Abiertas y canceladas se muestran separadas.
- Recompra: clientes con dos o más órdenes válidas acumuladas al corte. Órdenes BORRADOR y CANCELADA quedan fuera.
- Duración comercial: días de apertura a cierre por oportunidad. Duración técnica: muestra, ciclo y proceso, disponible en ID y su exportación CSV.
- Frecuencia: intervalo medio entre órdenes válidas; estimación y clasificación a partir de tres compras. Coeficiente de variación superior a 0.35 se considera irregular y no genera próxima fecha estimada. La frecuencia acordada se muestra aparte.

El periodo de oportunidades usa fecha de apertura; el de órdenes usa fecha de confirmación. Cartera muestra hasta 100 coincidencias y oportunidades se paginan de 50 en 50.

## Seguridad e integridad

Ventas sólo consulta y modifica sus oportunidades/órdenes; ID accede al análisis y publicación de reportes. Documentos requieren sesión. Cambios comerciales usan versión optimista y bloqueo transaccional de oportunidad. Confirmaciones de compra bloquean además la persona para impedir primeras compras simultáneas. La cancelación exige motivo y que no exista producción vigente; nunca degrada automáticamente a un cliente a prospecto.

`POST /api/ventas/crear` ahora requiere `oportunidad_id`, `cotizacion_id`, `version` y `orden_cliente`, y confirma una orden comercial. La OP se crea mediante `/api/ventas/crm/ordenes/:id/produccion`. No se mantiene el atajo antiguo que podía crear clientes y producción sin aceptación comercial.

## Validación y despliegue

Las pruebas incluyen oportunidades perdidas durante un reanálisis, canceladas
antes de recepción y muestras históricas vinculadas a mitad del segundo ciclo.
Comprueban que se puede terminar el trabajo, cerrar los tramos de tiempo y publicar
el reporte sin reabrir la venta ni alterar los tiempos anteriores.

Backend:

```sh
npm ci
npx prisma generate
npm run build
npm run test:crm
node tests/investigacion.cjs
```

`test:crm` usa Prisma y PostgreSQL en memoria (PGlite), genera el esquema desde cero únicamente en esa base temporal y no usa datos de Supabase. `CRM_TEST_SCHEMA` permite pasar la ruta a SQL generado con `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` en entornos que no permiten subprocesos desde Node.

Frontend: `npm ci && npm run build`. La exportación adicional inválida de la página de Calidad se eliminó para que pase el chequeo de páginas de Next.js.

Publicar `main` y luego sincronizar el subárbol `frontend` a la raíz de `frontend-deploy`, y `backend` a la raíz de `backend-deploy`. Conservar la configuración actual de Netlify/Railway y sus variables de entorno. Compilar el backend desde fuentes antes de iniciarlo; `dist` es salida de compilación.
