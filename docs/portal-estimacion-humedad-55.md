# Escenario de 55 % de agua para material sucio — Portal Haas

## Propósito

La tarjeta **Estado actual por prensa** mantiene las barras físicas de Fagor, Forgemaster y Polymaster y añade una proyección ilustrativa, exclusivamente para la fila **Inventario sucio**.

Para las tres prensas se aplica **55 % de humedad asumida en masa**:

- Agua estimada (kg) = kilogramos sucios × 0.55
- Equivalente teórico sin agua (kg) = kilogramos sucios × 0.45

La gráfica muestra el equivalente aproximado en el tooltip de las barras sucias y un panel inferior con el desglose y total. Los lotes sin prensa no se asignan a una prensa inexistente: se incluyen únicamente en el total general, con aviso.

Esta regla es un **supuesto fijo de planeación, no un resultado analítico**. El remanente de 45 % **no debe presentarse como kilos de producto terminado/liberado garantizado**: la regeneración puede tener pérdidas adicionales (sedimentos, impurezas, filtración y otros ajustes). Tampoco es un saldo adicional ni se suma al volumen liberado.

Fuente de masa: `graficas.estadoActualPorPrensa`, que ya incorpora el saldo físico actual por prensa de lotes con condición `SUCIO`. Si el inventario cambia, la estimación se recalcula al consultar el dashboard.

## Ejemplo

Si el inventario sucio es Fagor 12,000 kg, Forgemaster 40,000 kg y Polymaster 35,000 kg:

| Prensa | Masa sucia kg | Agua teórica kg | Equivalente sin agua kg |
|---|---:|---:|---:|
| Fagor | 12,000 | 6,600 | 5,400 |
| Forgemaster | 40,000 | 22,000 | 18,000 |
| Polymaster | 35,000 | 19,250 | 15,750 |
| **Total** | **87,000** | **47,850** | **39,150** |

## Alcance de la implementación

- Sólo cambia el frontend Next.js y se calcula sobre datos ya autorizados por cliente desde NestJS.
- No se alteran muestras, humedad medida de laboratorio, producto realmente liberado, saldos, movimientos ni registros de Supabase.
- No afecta las gráficas de acumulados o anillos.
