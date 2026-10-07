# Grafito: consultas y operación con el modelo separado

La pantalla `/tanques` consulta órdenes cuya `linea_Produccion` es GRAFITO, incluidos todos sus lotes. Muestra la OP, referencia comercial opcional, cliente, responsable, cantidad planificada y unidad; cada tanque muestra su capacidad y la carga efectivamente consumida.

## Operación

1. En **Existencias**, crear las ubicaciones físicas necesarias y registrar la recepción. La recepción es independiente de la OP, conserva al propietario y crea un movimiento de entrada y una muestra de Calidad. No se inventan cantidades a partir de observaciones ni se guarda inventario en JSON del navegador.
2. Calidad recibe la muestra, registra sus procesos/mediciones y dictamina. El material permanece en cuarentena hasta su aprobación. El checklist se registra sobre la recepción existente.
3. Desde CRM, crear una OP sobre la venta confirmada; desde Grafito se puede crear una OP independiente con material propio. Seleccionar todos los materiales requeridos y confirmar su integridad. No existe una receta/BOM automática: el responsable declara esa selección. Se reservan cantidades con bloqueo transaccional; otras órdenes no pueden reservarlas de nuevo.
4. En **Órdenes y lotes**, iniciar un lote con parte de las reservas y seleccionar un tanque libre. Se comprueba capacidad y unidad. No se convierten litros en kilogramos sin una conversión definida. Cada ejecución consume su parte; la reserva restante permite otros lotes.
5. Cambiar el proceso del tanque, solicitar muestreo, trasladar el lote completo y consultar tiempos. La muestra obtiene el producto de la OP y el cliente de la OV. Producción no puede liberar un lote: Calidad debe aprobar la muestra más reciente y liberar el lote.
6. Registrar la descarga con la cantidad realmente obtenida y ubicación de destino. Esto genera un lote de inventario, vacía el tanque y conserva su dictamen: descargar no equivale a liberar. Las repeticiones de la misma descarga no generan otro movimiento.
7. Cerrar la OP cuando no tenga lotes abiertos. Se cancelan las reservas restantes sin borrar consumos ni existencias producidas.

No se mezclan lotes diferentes dentro de un tanque. La carga parcial se representa con ejecuciones independientes, no con divisiones únicamente visuales del mismo lote. Las cantidades se muestran en su unidad física; no se suman kilos, litros y piezas como si fueran contenedores equivalentes.

## Contratos afectados

- `GET /api/produccion/test`: OP + OV opcional, producto, responsable, reservas con pendiente y todos los lotes; cantidades derivadas de movimientos, bitácora de `proceso_eventos`.
- `GET /api/produccion/tanques`: incluye capacidad y unidad.
- `POST /api/produccion/lotes`: OP, folio, tanque y consumos por reserva.
- `POST /api/produccion/lotes/:id/descargar`: cantidad obtenida y ubicación.
- `PUT /api/produccion/actualizar`: traslado de lote completo; no se usa para descargar.
- `GET /api/calidad/obtenerOrdenesPendientesDeLlegada`: conserva la ruta por compatibilidad; devuelve **recepciones**, no OP pendientes.
- `POST /api/calidad/crearLoteConChecklist`: recibe `recepcion_id` y revisa esa recepción.
- Cotizaciones: producto, servicio, tipo de venta, cantidad, unidad, subtotal/impuestos y reporte técnico asociado son obligatorios. Confirmar copia las condiciones aceptadas a la OV.
- Crear OP desde CRM: folio, responsable, operación, línea, cantidad y materiales; permite varias OP por venta sin exceder la cantidad planificada.
- `GET /api/ventas/test`: devuelve órdenes **de venta** con sus OP; aplica alcance por vendedor.

El seguimiento de ID, sus ejecuciones, tiempos e historial se mantiene. Matriz legal e indicadores KPI no se modifican. Facturación, pagos y entregas conservan su modelo; esta adaptación no añade sus pantallas operativas.

## Base de datos y despliegue

El esquema separado ya estaba aplicado en `siu` antes de esta publicación. Se verificaron sus columnas y restricciones. El único cambio adicional aplicado por esta implementación es `resultado_analisis.valor_Obtenido_Texto`, para conservar resultados cualitativos: `supabase/migrations/20261007154600_conservar_resultados_texto.sql`.

`prisma/restricciones_modelo.sql` documenta las restricciones del modelo y se usa en las pruebas con una base vacía. **No volver a ejecutarlo sobre siu**: sus restricciones ya existen. No ejecutar `db push --accept-data-loss`, reset ni migraciones antiguas para desplegar este cambio.

Construcción backend: `npx prisma generate && npm run build`. Inicio: `npm run start:prod`. Frontend: `npm run build`, publicando `.next` mediante el runtime de Next de Netlify. Se mantienen las variables de conexión y `NEXT_PUBLIC_API_URL` existentes.

La base revisada no tenía ubicaciones ni material cargado. Crearlos desde Existencias con datos reales antes de iniciar producción. Los tanques existentes tienen capacidad y unidad configuradas.

## Verificación

- Compilación de backend y frontend.
- `node --test test/crm.integration.cjs tests/investigacion.cjs`: PostgreSQL en memoria con Prisma y restricciones reales; CRM/ID, material, cuarentena, reservas, capacidad, dos lotes, Calidad, descarga repetida, OP propia y liberación de reservas al cancelar.
- `npm test -- --runInBand src/config/migration.spec.ts`: compatibilidad PostgreSQL, resultados numéricos/texto y checklist sobre recepción.

Estas pruebas no insertan datos de ejemplo en Supabase ni validan el despliegue de Railway/Netlify. El navegador conserva la sesión existente; solo se enviarán cambios al guardar los formularios.
