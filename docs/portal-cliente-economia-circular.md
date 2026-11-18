# Portal del cliente · Economía circular (GKN / INCORA)

## Alcance

Pantalla de acceso externo en **/acceso-cliente**, que utiliza exclusivamente POST /api/auth/cliente/login. Dashboard en **/portal-cliente** para un usuario externo con área cliente. La misma pantalla es accesible desde Producción, donde se puede seleccionar un cliente. El acceso interno `/` no permite iniciar sesión en el área cliente. El backend se encuentra en GET /api/portal-cliente/resumen y el catálogo de clientes, solo para Producción, en GET /api/portal-cliente/clientes.

No se crea ninguna tabla ni se altera el inventario o el historial operativo; este módulo es de **consulta**. El API incluye `inventarioActual`: fotografía del saldo vigente del cliente por condición/prensa/unidad, **incluidas las aperturas históricas**, sin atribuir esas existencias como recepciones nuevas.

## Origen de datos y criterios

| Indicador | Fuente y cálculo | Criterio |
| --- | --- | --- |
| Material recibido | lotes_llegada CONFIRMADA + checklist COMPLETADO, lotes_inventario con origen RECEPCION y movimientos_inventario ENTRADA_RECEPCION | Identidad de cliente por remitente_id y propietario_id. Unidades separadas. |
| Enviado a producción | SALIDA_CONSUMO de los lotes de recepción seleccionados | No confundir reserva ni orden planificada con movimiento físico. |
| Producto liberado | Entrada de producción de lotes REGENERADO/TERMINADO, cuyo lote_produccion.estado=FINALIZADO y estado_Calida=LIBERADO | Solo se atribuye cuando todos los consumos comprobados del LP proceden de la cohorte de recepción; sino se reporta "Sin vínculo" sin incorporarlo al rendimiento. |
| Producto entregado | SALIDA_ENTREGA de producto liberado con vínculo a esa misma cohorte | Sin salida física confirmada, no contabilizar como entrega. |
| Humedad inicial | muestras MUESTRA_INICIAL vinculadas a lote_inventario_id, resultado_analisis parametro_id=4 (% HUMEDAD) | Resultado más reciente válido por muestra, muestra más reciente válida por lote; promedio ponderado únicamente por lotes muestreados. Si no hay resultados mostrar "Sin análisis". |
| Agua contenida estimada | sumatorio de masa recibida en kg * humedad / 100 para lotes muestreados | **No** representa agua evaporada, ni debe calcularse sobre litros sin densidad acreditada. |
| Manifiestos | manifiestos.cliente_id, resguardado_en | Total histórico del cliente (no filtrado por cohorte); no convertir conteo de documentos en masa. |

**Crucial:** no equiparar masa con volumen: kg y litros se presentan por separado. No convertir 1 contenedor en 1000 kg o 850 kg sin pesaje registrado. El rendimiento solo tiene sentido si existe una relación auditable entre entrada del material, consumo a OP/LP, producción liberada y entrega. El estado de una OP no demuestra por sí solo el volumen transformado. La diferencia entre entrada y producto liberado puede incluir agua, filtración, residuos, rechazos, inventario pendiente o ajustes. No etiquetar la diferencia automáticamente como "merma" o "agua removida".

El filtro de fechas es una **cohorte por fecha de recepción**, no un informe de actividad de un período. Un lote recibido en la fecha seleccionada puede procesarse o entregarse después y se cuenta en ese mismo balance. Los inventarios previos de origen APERTURA y los lotes provisionales no se presentan falsamente como recepciones del período.

## Excel "DASHBOARD GKN 171126.xlsx"

La referencia incluye "CLOSE THE LOOP UST" y "ECONOMIA CIRCULAR", desgloses de FAGOR, POLY y F MASTER, y filas "ENTREGA INCORA", "SOLICITA PRODUCIR UST" y "SOBRANTE". También propone los conceptos ambientales (agua/laboratorio), certeza jurídica (manifiestos), eficiencia logística, entrega y confinamiento.

El libro contiene proyecciones por fechas y cantidades que no tienen folios de recepción, pesajes, cliente enlazado ni movimientos de producción auditables. **No se importaron** como transacciones ni se mostraron como cantidades verificadas. Una futura sección de planificación deberá usar una tabla propia de compromisos, fecha, prensa, cantidad y unidad, manteniendo separados comprometido, recibido y procesado. No es seguro atribuir esos planes a la cuenta existente "Haas TCM de México" sin validar si INCORA/GKN corresponde al mismo cliente.

## Configuración de acceso

La autenticación actual utiliza cuentas configuradas en UST_USUARIOS_JSON (backend / Railway). Crear una cuenta nueva únicamente con área cliente y con personaId del registro CLIENTE correcto. Ejemplo de **estructura**, no de credenciales reales:

    {"usuario":"portal_cliente_ejemplo","areas":["cliente"],"personaId":<id_del_cliente>,"salt":"<salt_aleatoria>","hash":"<scrypt_de_64_bytes_en_hex>"}

No incluir clienteId en el login del navegador: la API identifica al cliente por personaId de sesión. El rol cliente queda bloqueado para todos los endpoints que usan AuthGuard sin @Areas('cliente'), incluso si antes carecían de restricción por área. Nunca compartir cuentas de producción con terceros. Para regenerar una contraseña, usar el mecanismo de generación del proyecto, sin guardar contraseñas en texto plano.

**Limitación de despliegue:** AuthService conserva sesiones en memoria. Un reinicio de Railway invalida sesiones; con varias instancias el token no se comparte. Para acceso externo formal conviene migrar a un almacén central de sesiones / autenticación persistente, expiración y auditoría por cliente.

## Antes de publicarlo para GKN/INCORA

1. Confirmar el registro CLIENTE que corresponde a INCORA/GKN; no usar automaticamente personaId=12 ("Haas TCM de México").
2. Acreditar recepciones reales y checklists completos, con movimiento ENTRADA_RECEPCION (no solo apertura histórica o fecha de una orden).
3. Asegurar que MUESTRA_INICIAL y resultado de humedad tengan vínculo lote_inventario_id. Hoy en el proyecto Supabase consultado existen 0 muestras y 0 resultados; por lo tanto, no debe mostrarse humedad 0 %.
4. Asegurar que las SALIDA_CONSUMO de LP incluyan su origen real de recepción; hay lotes de conciliación de producción provisional que no califican para rendimiento por cliente.
5. Verificar manifiestos y documentos, pesos reales, unidad, propiedad y eventuales mezclas de lotes. Las mezclas requieren asignación explícita o regla de trazabilidad verificada.
6. Probar permisos por cliente (no acceso a personaId ajeno), filtrado de fechas, reversiones, muestras faltantes, lotes sin recepción y unidades mixtas.
7. Validar scripts npm run build tanto en backend como frontend antes de fusionar la rama o desplegar.

## Respuestas de la API

GET /api/portal-cliente/resumen?desde=2026-11-01&hasta=2026-11-30

- Para area cliente, el cliente es el de la sesión (incluso si se envía clienteId distinto: 403).
- Para area produccion, se exige clienteId.
- Cache-Control: private, no-store.
- El reporte se agrupa por unidad (Kilogramos/Litros), prensa, lote de recepción, humedad y manifiestos.

Se devuelve información de solo lectura; esta vista no sustituye certificados de calidad, pesajes o documentos oficiales.
