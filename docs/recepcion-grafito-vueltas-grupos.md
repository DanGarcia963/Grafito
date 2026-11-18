# Recepción de grafito: varias prensas y números de vuelta

## Objetivo

Una sola llegada puede contener cualquier combinación de **Fagor, Forgemaster y Polymaster**, cada grupo con su **vuelta registrada en la recepción**, contenedores identificados y peso real.

Ejemplo para una recepción **32631**:

- Grupo 1: **Fagor, vuelta 8**, 6 contenedores.
- Grupo 2: **Forgemaster, vuelta 6**, 8 contenedores.

La unidad de conteo sigue siendo el **peso real en kg**; nunca se calcula un peso supuesto a partir del número de contenedores.

## Estructura técnica

No es necesaria una tabla nueva: `lotes_llegada` tiene relación 1:N con `lotes_inventario` mediante `recepcion_id`.

- Se crea **una** recepción (folio 32631).
- Se crean **dos** lotes de inventario (por ejemplo, `MP-32631-G1`, `MP-32631-G2`).
- Cada lote guarda `especificaciones.atributos.tipo_prensa` y `especificaciones.atributos.numero_vuelta` como entero.
- Cada lote recibe una entrada `ENTRADA_RECEPCION` por la suma de pesos de sus propios contenedores, y una muestra independiente de Calidad.
- La recepción conserva un único checklist con los 14 contenedores. El checklist muestra prensa y vuelta por contenedor en sus observaciones iniciales; no se modifican los datos previos.
- La creación es **atómica**: si falla un grupo, no se registra parcialmente la recepción.
- El material permanece bajo la política de **cuarentena** y revisión del checklist original.
- Producción puede consumir independientemente cada lote; `movimientos_inventario.lote_inventario_id` mantiene el origen. Una OP puede seguir alimentando varios lotes de producción.

## Formato del endpoint

`POST /api/produccion/recepciones`:

```json
{
  "folio": "32631",
  "remitente_id": 12,
  "producto_id": 6,
  "propiedad": "DE_CLIENTE",
  "ubicacion_id": 1,
  "condicion": "SUCIO",
  "cantidad": 11900,
  "grupos_grafito": [
    {
      "tipo_prensa": "Fagor",
      "numero_vuelta": 8,
      "contenedores": [
        {"codigo":"32631-F01","peso_kg":"850"},
        {"codigo":"32631-F02","peso_kg":"850"},
        {"codigo":"32631-F03","peso_kg":"850"},
        {"codigo":"32631-F04","peso_kg":"850"},
        {"codigo":"32631-F05","peso_kg":"850"},
        {"codigo":"32631-F06","peso_kg":"850"}
      ]
    },
    {
      "tipo_prensa": "Forgemaster",
      "numero_vuelta": 6,
      "contenedores": [
        {"codigo":"32631-FM01","peso_kg":"850"},
        {"codigo":"32631-FM02","peso_kg":"850"},
        {"codigo":"32631-FM03","peso_kg":"850"},
        {"codigo":"32631-FM04","peso_kg":"850"},
        {"codigo":"32631-FM05","peso_kg":"850"},
        {"codigo":"32631-FM06","peso_kg":"850"},
        {"codigo":"32631-FM07","peso_kg":"850"},
        {"codigo":"32631-FM08","peso_kg":"850"}
      ]
    }
  ]
}
```

*Las cantidades de 850 kg del ejemplo son demostrativas; deben reemplazarse por los pesos reales de cada contenedor.*

## Validaciones

- Grupos de material por prensa solo si el producto tiene `configuracion_operativa.campos.tipo_prensa` y unidad Kilogramos.
- 1 a 50 grupos; 1 a 500 contenedores por recepción.
- Número de vuelta entre 1 y 99 (entero).
- El mismo par prensa/vuelta no puede repetirse entre grupos: añadir los contenedores al grupo existente.
- Todos los identificadores de contenedor son únicos dentro de la recepción.
- La prensa debe pertenecer al catálogo del producto.
- El peso de cada contenedor debe estar dentro del intervalo permitido en el producto, hoy 850–1000 kg para ORSA VFG-R.
- La suma de los pesos debe coincidir con la cantidad total recibida, y cada lote se mantiene separado para saldos y análisis.
- No se cambian los registros anteriores ni se asignan vueltas ficticias a los lotes existentes sin ese dato.

## Relación con el número de reprocesos

La vuelta consignada en la recepción es el número de reprocesos **declarado al ingresar**. El nuevo registro no aumenta automáticamente la vuelta durante el procesamiento ni en la descarga. La siguiente etapa será definir y aplicar la regla de actualización de vuelta en el producto liberado a partir de los consumos del lote de producción, con un tratamiento explícito para mezclas de vueltas diferentes.

El portal de Haas ahora expone vuelta por lote de recepción y por agrupación de existencias actuales; la lectura de saldos, humedad y rendimiento sigue la misma lógica anterior.

## Prueba manual recomendada

1. Crear una recepción de prueba con 2 grupos y 14 contenedores, con pesos verificados.
2. Confirmar una sola fila en `lotes_llegada` y dos filas relacionadas en `lotes_inventario`, cada una con su prensa y vuelta.
3. Verificar dos movimientos de entrada y dos muestras vinculadas, sin duplicar masa.
4. Completar el checklist de 14 contenedores; comprobar que ambas existencias pasan de cuarentena a liberadas solo cuando corresponde.
5. Consumir parte de un grupo en Producción; verificar su traza exacta y que el otro grupo mantiene su saldo.
6. Verificar vista de Haas por vuelta, cantidad, humedad y lote.

## Despliegue

- Sin migraciones ni cambios directos a Supabase.
- Se actualizan el backend NestJS, el frontend Next.js y el checklist de Calidad.
- Compilar backend y frontend, probar el flujo y desplegar ambas ramas juntas.
