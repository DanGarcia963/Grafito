# Dashboard de Haas — Gráficas y vueltas por prensa

## Datos y criterios

Las nuevas gráficas del portal usan kilogramos y exclusivamente lotes cuya propiedad corresponde al cliente autenticado. No se escriben datos en Supabase.

| Indicador | Fuente |
| --- | --- |
| Sucio actual | Saldos físicos positivos de lotes SUCIO, con movimientos reales de ubicaciones |
| Procesando | SALIDA_CONSUMO no revertidas hacia lotes de producción activos (EN_PROCESO/PENDIENTE) |
| Liberado actual | Saldos positivos de lotes REGENERADO/TERMINADO vinculados a LP FINALIZADO y Calidad LIBERADO |
| Entradas acumuladas | ENTRADA_RECEPCION no revertidas de lotes RECEPCION |
| Liberado acumulado | ENTRADA_PRODUCCION no revertidas, asociadas a LP finalizado y liberado |

Los filtros de fecha afectan solo los acumulados por fecha de movimiento. El estado actual y sus anillos son una fotografía de saldos y consumos vigentes, con independencia del filtro.

## Anillos concéntricos de vueltas

Se muestran tres visualizaciones: sucio, en proceso y liberado. Cada una tiene anillos Fagor (azul), Forgemaster (verde) y Polymaster (amarillo). Si la vuelta máxima registrada en un grupo supera 10, su anillo es rojo. Valores como 4TA, 5TA, 7MA, 8VA se interpretan como 4, 5, 7 y 8. Las vueltas numéricas también se admiten.

El anillo no expresa porcentaje de peso ni avance de la orden: es la vuelta máxima declarada entre los lotes con masa de esa prensa y etapa. Los demás valores observados figuran bajo el anillo. Kilos sin vuelta aparecen en las barras, pero no hacen avanzar el anillo. Kilos sin prensa se incluyen en los totales y se notifican.

## Distinciones importantes

- El acumulado liberado incluye producto posteriormente entregado, a diferencia de liberado actual en inventario.
- Procesando es cantidad consumida por lotes activos, no peso en tanque después de evaporación; no se infiere a partir de la carga declarada.
- Los ajustes de inventario afectan saldos, pero no crean entradas de recepción ni liberaciones acumuladas.
- Un lote sin dictamen Calidad LIBERADO no computa como producto liberado, aun si su condición dice REGENERADO.
- Las existencias históricas se incluyen en las barras actuales; no se inventan entradas para conciliarlas.
- La vuelta del producto descargado no se incrementa automáticamente y no se infiere de mezclas.
- Estas barras no son un balance contable único: inventario y producto procesando pertenecen a etapas y medidas distintas.

## Validación y archivos

- backend/src/portal-cliente/portal-cliente-graficas.logic.ts: cálculos sin efectos sobre la base.
- backend/src/portal-cliente/portal-cliente.service.ts: consultas autorizadas del cliente.
- frontend/src/components/PortalGraficasGrafito.tsx: barras, anillos y alertas.
- frontend/src/app/portal-cliente/page.tsx: integración del dashboard.
- backend/test/portal-graficas.test.cjs: pruebas de movimientos, reversas, filtros, límites de vuelta.

No se requieren migraciones ni alteraciones de registros existentes.