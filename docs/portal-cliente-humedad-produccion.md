# Humedad inicial por trazabilidad: recepción → inventario → producción

La muestra de producción no necesariamente guarda `muestras.lote_inventario_id`. La ruta normal del sistema al iniciar muestreo en el tanque guarda `muestras.lote_id` (identificador de `lotes_produccion`).

Para reconstruir el flujo:

1. `lotes_llegada.id = lotes_inventario.recepcion_id`, recepción confirmada con checklist terminado.
2. `lotes_inventario.id = movimientos_inventario.lote_inventario_id`, movimiento tipo `SALIDA_CONSUMO`.
3. `movimientos_inventario.lote_produccion_id = lotes_produccion.id_Lote_Produccion`.
4. `muestras.lote_id = lotes_produccion.id_Lote_Produccion`, categoría `MUESTRA_INICIAL` y muestra aprobada.
5. `resultado_analisis.muestra_id = muestras.id_Muestra`, parámetro 4 (% HUMEDAD). Las mediciones deben ser numéricas, entre 0 y 100.

**Prueba confirmada en Supabase:** llegada 8 `Lote_Prueba_09_11` → inventario 54 `MP-Lote_Prueba_09_11` → movimiento 244 (consumo 1,000 kg) → LP 60 `Prueba_121203` → muestra 34 `MUESTRA_INICIAL` → resultado 51, 20 % humedad.

## Reglas de interpretación

- Si una muestra inicial está asociada directamente al inventario, se puede reportar como humedad de recepción de ese lote.
- Si una muestra inicial está asociada al LP y **todas las fuentes de consumo vigentes del LP pertenecen a un único lote de inventario**, se puede atribuir al lote origen como **humedad inicial medida en producción**, no como medición al momento exacto de llegada.
- Un lote de inventario puede abastecer varios LP. Para un promedio, cada LP contribuye con la humedad medida y con su **masa consumida**, evitando aplicar el resultado a la totalidad del material recibido si una parte aún no se procesa.
- Si un LP mezcla varios lotes de inventario, o una fuente externa, no atribuir su humedad individualmente a uno de los lotes; se necesita medición independiente o cálculo de mezcla explícitamente justificado. Se evita exponer cifras potencialmente falsas.
- Movimientos revertidos se excluyen; se revisan todas las fuentes de un LP, **no solo las pertenecientes al cliente consultado**, para evitar atribución indebida.
- El tablero muestra `origenHumedad`, `masaConHumedad` y `lotesProduccion` para explicar los resultados.
- `humedadPonderada` es la humedad ponderada **de material con respaldo analítico**, no de la totalidad recibida cuando faltan muestras. `aguaEstimadaKg` estima agua contenida en masa muestreada, no cantidad efectivamente evaporada.

## Consultas de validación

```sql
SELECT ll.no_lote recepcion, li.folio lote_inventario,
       mov."id_Movi_Invent", mov.cantidad consumida_kg, lp."no_Lote" lote_produccion,
       mu."no_Muestra", mu."categoria_Muestra", mu.lote_inventario_id,
       ra."valor_Obtenido_Num" humedad_pct
FROM public.lotes_llegada ll
JOIN public.lotes_inventario li ON li.recepcion_id=ll.id
JOIN public.movimientos_inventario mov ON mov.lote_inventario_id=li.id AND mov.tipo='SALIDA_CONSUMO'
JOIN public.lotes_produccion lp ON lp."id_Lote_Produccion"=mov.lote_produccion_id
JOIN public.muestras mu ON mu.lote_id=lp."id_Lote_Produccion" AND mu."categoria_Muestra"='MUESTRA_INICIAL'
JOIN public.resultado_analisis ra ON ra.muestra_id=mu."id_Muestra" AND ra.parametro_id=4
WHERE ll.remitente_id=12
ORDER BY ll.fecha_llegada, lp."id_Lote_Produccion";
```

La consulta SQL sirve para diagnosticar vínculos; no debe emplearse directamente como agregación si un LP contiene múltiples insumos o varias mediciones, porque podría duplicar masas. Las reglas anti-duplicación y atribución conservadora están en el servicio NestJS.

No se modifica ninguna muestra, movimiento ni tabla operativa para corregir la visualización.
