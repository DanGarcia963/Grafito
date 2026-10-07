# Inventario, especificaciones por producto y reproceso

Implementación sobre `main` 8d3f6f9 (modelo PostgreSQL de 6 de octubre de 2026).

## Uso

1. En Tanques → Inventario, registra material, propietario, ubicación y cantidad en la unidad del producto. Puedes registrar SUCIO, INSUMO o REZAGADO sin orden de venta. La recepción conserva el control de Calidad existente (cuarentena hasta dictamen).
2. Para ORSA VFG - R, el formulario muestra Forgemaster, Polymaster y Fagor como tipos de prensa. Añade identificadores y pesos reales de contenedores. Tres de 850 kg suman 2550 kg; tres de 1000 kg suman 3000 kg. Nunca se divide el total para inventar pesos.
3. Desde Órdenes crea una OP independiente, selecciona el producto objetivo y reserva insumos. Se permite material de un cliente sin venta; su propietario permanece en la OP y en las salidas. No se mezclan propietarios distintos. Material recibido para otra venta no puede usarse en una OP independiente.
4. Selecciona “Regeneración / reproceso” y documenta el motivo cuando quieras utilizar F.E. La reserva y el consumo comprueban disponibilidad específica para reproceso. El material en cuarentena o caducado sigue bloqueado.
5. Inicia un lote en un tanque libre. El consumo descuenta kg de las reservas; no duplica la entrada al inventario.
6. Si la última muestra de Calidad es MUESTRA_AJUSTADO y quedó RECHAZADA, sin revisión abierta, descarga el lote con destino F.E. El tanque queda vacío, el lote original conserva FUERA_DE_ESPECIFICACION y se crea existencia fuera de tanque. El material no se libera para entrega; una nueva OP y un nuevo lote permitirán reprocesarlo.
7. “Marcar rezagado” identifica material que quedó almacenado. No cambia el dictamen de Calidad y no convierte F.E. en producto liberado.
8. Desde una OP sin venta usa “Vincular con venta”. Valida venta confirmada, producto, unidad, propietario y cantidad pendiente de planificar. Funciona también después de finalizar la OP, sin crear otra entrada ni cambiar la propiedad.

## Datos estructurados

- `productos_materiales.configuracion_operativa`: JSONB de campos permitidos por producto. La actualización incluye el catálogo inicial de ORSA VFG - R; otros productos pueden configurar sus propios campos/opciones y límites de peso.
- `lotes_inventario.especificaciones`: JSONB validado de atributos y contenedores al ingreso o descarga.
- `crm_ordenes_venta.especificaciones`: presentación acordada al confirmar la venta. Es independiente del detalle físico real y no produce movimientos de inventario.
- `ordenes_produccion.propietario_id`: preserva propiedad aunque no exista venta.
- `es_reproceso` y `motivo_reproceso`: habilitación explícita y trazable para consumir material F.E.
- `REZAGADO` y `FUERA_DE_ESPECIFICACION`: condiciones del inventario separadas de Calidad.

Ejemplo de especificaciones:

```json
{
  "version": 1,
  "atributos": { "tipo_prensa": "Fagor" },
  "contenedores": [
    { "codigo": "C1", "peso_kg": "850" },
    { "codigo": "C2", "peso_kg": "850" },
    { "codigo": "C3", "peso_kg": "850" }
  ]
}
```

El saldo físico y las reservas siguen siendo Decimal en movimientos; JSON no sustituye la contabilidad del inventario. El detalle de contenedores describe la entrada original: después de consumos parciales, no se presenta como listado de contenedores restantes. Esta entrega no implementa consumo individual por contenedor.

El checklist de Calidad se genera desde los contenedores de la recepción. Ya no extrae números ni tipos de prensa de observaciones, ni inventa tres contenedores para registros antiguos. En históricos sin detalle se capturan manualmente en el checklist. Las observaciones originales permanecen intactas.

## Aplicación en Windows / Supabase

El repositorio no contiene un historial base de Prisma Migrate. Por eso se entrega SQL incremental, no una migración inicial que intente recrear las tablas existentes.

1. Respalda la base y programa una pausa breve de escrituras.
2. Desde la carpeta backend, con `psql` instalado y `DIRECT_URL` configurada en la sesión de PowerShell, ejecuta:

```powershell
psql "$env:DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/actualizaciones/20261007_inventario_reproceso.sql
```

La URL debe apuntar a la base del proyecto y el `search_path` al esquema donde están sus tablas (normalmente public). `psql` requiere una URL PostgreSQL sin parámetros exclusivos de Prisma como `connection_limit` o `schema`. No compartas la contraseña en capturas.

El SQL añade columnas y enums sin borrar registros, recupera propietarios de OP existentes y se detiene si detecta propietarios incompatibles. Su reejecución es segura. No utiliza `reset` ni `db push`.

3. Verifica que el producto esté configurado:

```sql
SELECT "id_Produc_Mater", "nombre_Producto", configuracion_operativa
FROM productos_materiales WHERE configuracion_operativa IS NOT NULL;
```

La configuración inicial se aplica solo a nombres equivalentes a ORSA VFG - R, ignorando espacios y guiones. Si tu catálogo utiliza otro nombre, asigna explícitamente esa configuración al ID correcto. No se modifica una configuración ya existente.

4. Genera el cliente y compila:

```powershell
npx prisma generate
npm run build
npm run test:inventario
```

5. Despliega backend y frontend después de completar el SQL. No desplegar el código nuevo contra la base sin las columnas nuevas.

Esta implementación y sus pruebas no ejecutan cambios en Supabase. Se verificó el SQL contra PostgreSQL de prueba (PGlite), incluyendo conservación de filas y reejecución.

## Validación

`npm run test:inventario`: sumas y rangos de pesos, prensas válidas, cuarentena, OP de cliente sin venta, rechazo final y descarga F.E., bloqueo de liberación histórica, reserva/consumo de reproceso, propiedad, vinculación posterior, rezagado y SQL incremental.

`npm run test:crm`: regresión del flujo comercial y de producción existente. El frontend se comprueba con `npx tsc --noEmit`.
