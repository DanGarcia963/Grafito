# Grafito — resumen semanal de entregas por prensa

## Objetivo

Complementar la gráfica **Acumulado de entradas y liberaciones** del portal privado con un bloque independiente de **entregas reales** de grafito regenerado, por semana ISO (lunes a domingo) y prensa.

### Indicadores

- **Año seleccionado:** semanas etiquetadas 1/52 a 52/52 o 1/53 a 53/53, según el calendario ISO. **2026 tiene 53 semanas** (su semana 1 comienza el 29/12/2025 y la 53 termina el 03/01/2027).
- **Resumen de la semana anterior a la fecha actual:** kilos por Fagor, Forgemaster, Polymaster, sin prensa y total. Si la consulta de año es histórica, este resumen sigue siendo relativo al día de hoy.
- **Acumulado anual:** suma de todas las entregas registradas durante el año ISO seleccionado, por prensa y total.
- **Gráfica desplazable:** barras por semana y prensa, con las semanas sin movimientos visibles en cero. Selector para consultar cada semana individualmente.

### Fuente y reglas de confianza

Endpoint autenticado: `GET /api/portal-cliente/entregas-semanales?anio=2026`.

- Usuario del área **cliente**: su `personaId` determina la propiedad y no puede consultar otros clientes.
- Usuario del área **produccion**: debe proporcionar `clienteId` válido.
- Fuente: `movimientos_inventario.tipo = SALIDA_ENTREGA`, vinculados con `lotes_inventario` del cliente, unidad Kilogramos, ORSA VFG, `origen = PRODUCCION`, condición `REGENERADO`/`TERMINADO`, y con LP `FINALIZADO` y dictamen Calidad `LIBERADO`.
- **Reversiones:** si una `REVERSION` referencia un movimiento de salida, esa salida se excluye completamente, incluso cuando la reversa ocurrió en una semana diferente.
- **Prensa:** `lotes_inventario.especificaciones.atributos.tipo_prensa`. Los registros sin prensa se informan por separado y también se suman al total.
- **Fecha:** `movimientos_inventario.fecha` convertida al calendario local de `America/Mexico_City`. Las semanas se organizan por **año ISO**, que no siempre coincide con el año calendario en los últimos días de diciembre.
- `ENTRADA_PRODUCCION` y `AJUSTE_SALIDA` **no se contabilizan como entregas**. Una liberación de calidad, una entrega programada o una simulación de tortón/tráiler tampoco equivalen a una salida acreditada.
- No hay cambios ni escrituras en Supabase; las cifras se consultan en el momento.

### Situación actual verificada en Supabase (24/11/2026)

El cliente con `personaId = 12` tiene **0 movimientos `SALIDA_ENTREGA`**. Las tablas `entregas_logistica` y `entrega_materiales` también están vacías. Por ello, el panel presentará inicialmente valores **0 kg** y un aviso explicando que **no significa que no se hayan realizado salidas físicas**, sino que no hay registros de entrega acreditados en el ERP. Los ajustes administrativos usados para compensar las entradas históricas de Haas no constituyen prueba de una entrega.

### Pruebas

`backend/test/portal-entregas-semanales.test.cjs` valida 52/53 semanas, límites de año, conversiones horarias, reversas, agrupación por prensa y distinción entre año seleccionado y semana anterior.

### Alcance

Esta funcionalidad es de **solo lectura**. No añade controles para inventar entregas, ni conecta la simulación visual de transportes a movimientos de inventario. Cuando se registren salidas reales, la gráfica se alimentará automáticamente desde ellas.
