# CRM de muestras de Ventas

`/ventas-muestras` presenta las muestras de I+D como oportunidades comerciales. Conserva el registro existente, la ficha técnica, la etiqueta y la consulta de tiempos/procesos de ID.

## Funcionamiento

- Una muestra equivale a una oportunidad. Cada vendedor solo consulta y gestiona las muestras asociadas a su `personaId`.
- Etapas: Recolección, En análisis, Cotización, Venta asegurada y Venta no asegurada.
- Sin seguimiento comercial previo, una muestra comienza en Recolección; si ID ya la recibió o registra un estado técnico posterior a Pendiente, se muestra En análisis. La recepción también avanza una oportunidad en Recolección que tenga notas previas.
- Ventas confirma cotización y cierre explícitamente. Una aprobación o rechazo de ID no determina el resultado comercial. Se permite cotizar antes de que termine el laboratorio.
- Cada seguimiento requiere una nota, registra autor y fecha del servidor y puede programar el próximo contacto. Cerrar la venta cancela ese contacto. Para reabrir, seleccionar una etapa abierta y escribir el motivo. No se puede volver a Recolección si ID ya recibió la muestra.
- El resultado comercial no genera automáticamente órdenes de producción ni facturas; el cierre registra la confirmación de Ventas.

## Métricas

Conversión = oportunidades actualmente en Venta asegurada / total de muestras de la búsqueda y periodo × 100. Cada muestra se cuenta una vez, incluso si se cierra y reabre. Las muestras históricas nunca se presumen vendidas por tener dictamen aprobado.

El periodo es una cohorte por fecha de recolección UTC (desde y hasta incluidos). La búsqueda por cliente, producto o folio y las fechas afectan las métricas. El filtro de etapa y la paginación afectan solo las tarjetas: el denominador conserva todas las etapas de la cohorte. No es una fotografía histórica del estado al final del periodo.

Las tarjetas se paginan de 50 en 50. Cada columna muestra su total en la cohorte, aunque algunas tarjetas estén en otra página. Se puede filtrar una etapa para revisar sus oportunidades.

## Persistencia y API

Se reutiliza la bitácora PostgreSQL existente `proceso_eventos`, con entidad `VENTA_MUESTRA`, acción `SEGUIMIENTO_COMERCIAL` y una instantánea comercial JSON en `detalle`. La última entrada por ID define el estado; las entradas anteriores se conservan. La vista inicial se deriva de la muestra si no hay eventos comerciales. No se agregan tablas ni columnas, ni se requiere ejecutar migraciones o cargar datos.

No se alteran `estado_Muestra`, `id_ejecuciones` ni `proceso_tramos`. El historial comercial se consulta separado del historial técnico de ID.

- `GET /api/ventas/crm/oportunidades?q=&desde=&hasta=&etapa=&pagina=`
- `GET /api/ventas/crm/oportunidades/:id` (hasta 200 entradas recientes)
- `POST /api/ventas/crm/oportunidades/:id/seguimiento`, cuerpo `{ version, etapaActual, etapa, nota, proximoContacto }`

Todas las rutas requieren Bearer y área `ventas`, además de verificar el vendedor propietario. Los cambios bloquean la muestra dentro de una transacción, compartiendo el bloqueo que usa ID. La versión y la etapa esperada evitan sobrescribir otra edición o una recepción reciente (HTTP 409); el usuario debe recargar el detalle. La señal WebSocket `CRM_OPORTUNIDAD_ACTUALIZADA` solo notifica a Ventas, sin incluir datos comerciales.

## Despliegue y validación

Se conservan las variables de Railway/Netlify existentes (`DATABASE_URL`, `DIRECT_URL`, `UST_USUARIOS_JSON`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`). Construir backend con `npx prisma generate && npm run build`; frontend con `npm run build`.

Desde backend:

```sh
npm run build
node --test test/crm.integration.cjs
node tests/investigacion.cjs
```

Las pruebas CRM ejecutan consultas PostgreSQL con PGlite local y ejercitan las rutas Nest, la autorización por área/propietario, búsquedas parametrizadas, cohortes, paginación, conversión, cierres/reapertura y conflictos concurrentes. No conectan a Supabase ni modifican datos reales. Las pruebas existentes de ID cubren procesos, estándares y tiempos.
