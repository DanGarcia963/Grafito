# Grafito — Cierre del ciclo físico y comercial (2026-11-25)

## Alcance

1. Calidad: descarga comercial nueva solamente con LP LIBERADO y certificado PDF aprobado. Los LP históricos que ya estaban LIBERADOS sin certificado se listan como PENDIENTES de conciliación, no se validan ni certifican automáticamente. Calidad puede VALIDAR con evidencia histórica PDF o BLOQUEAR justificadamente.
2. Contenedores: inventario_contenedores y contenedor_movimientos almacenan código, lote, ubicación, saldo y consumo individual; recepción crea contenedores POR_VERIFICAR, checklist físico los valida, descarga crea contenedores producto final. Iniciar un lote en tanque exige seleccionar contenedores y kilos explícitos cuando el lote está individualizado.
3. Logística: un vehículo Tortón (12) o Tráiler (22) tiene límite de contenedores y peso; viaje puede llevar varias entregas OV, cada una con varios lotes y contenedores. Preparar/confirmar carga no descuenta inventario. Despachar registra las salidas SALIDA_ENTREGA junto con la disminución de saldos por contenedor y auditoría.
4. Recepción: el cliente o Logística confirma cantidades recibidas por detalle y adjunta PDF; discrepancias quedan registradas sin crear artificialmente entradas a inventario. La conciliación OV compara solicitado, producto asignado, despachado, recibido, pendiente y registros fiscales existentes.

## Estructura

- Migración aditiva: backend/prisma/actualizaciones/20261125_cierre_material_logistica.sql
- Tablas: inventario_contenedores, contenedor_movimientos, calidad_conciliaciones_legacy, vehiculos_logistica, viajes_logistica, entrega_contenedores, logistica_eventos; entregas_logistica.viaje_id nullable.
- API: /api/logistica/* (protección AuthGuard/Areas); conciliación /api/calidad/conciliacion-legacy.
- Vistas: /logistica-entregas, /calidad-conciliacion y /portal-cliente con entregas físicas.
- Nuevas tablas con RLS habilitado y sin acceso directo anon/authenticated. Nada modifica Matriz Legal ni KPI.

## Históricos

- Nueve LP liberados sin certificado digital en el corte analizado: quedan PENDIENTES, nunca autorizados de forma automática.
- Los lotes históricos de recepción y las aperturas no reciben contenedores ficticios. Almacén deberá hacer conteo físico, identificar códigos y conciliar pesos exactamente contra el kardex.
- Un material sin contenedor identificado no es elegible para una entrega física nueva hasta conciliarlo.

## Reglas de integridad

- Un mismo contenedor no puede estar asignado a dos entregas activas.
- El peso y número de envases no pueden superar la capacidad del vehículo.
- La OV debe estar CONFIRMADA y la OP de origen debe tener cantidad final asignada suficiente.
- El LP debe estar FINALIZADO, LIBERADO y contar con expediente válido.
- El descuento se ejecuta en una sola transacción por viaje con bloqueos de filas y clave idempotente por detalle.
- La recepción requiere acuse PDF, cantidades por lote y nombre de quien recibe; diferencias no restauran stock.
- Un despacho no puede cancelarse. Una devolución física posterior requiere un flujo de recepción documentado.

## Limitaciones explícitas

- El módulo no emite CFDI ni registra pagos fiscales; el reporte solo lee registros de facturas y pagos existentes.
- La devolución parcial no se automatiza con una reversa sin evidencia física.
- No se puede reconstruir retroactivamente con certeza qué contenedor específico consumió un movimiento histórico agregado.
- El planeador visual de camiones del portal permanece una simulación local separada.

## Pruebas operativas prioritarias

1. Calidad bloquea nuevo producto sin certificado y exige evidencia PDF para autorizar liberaciones históricas.
2. Conciliar un lote histórico exige suma de pesos igual al saldo del lote y ubicación, sin movimientos falsos.
3. Consumir 300 kg de un contenedor y 250 kg de otro conserva el saldo individual y el kardex.
4. Tortón de 12 y tráiler de 22: rechazar un envase adicional y sobrepeso.
5. Dos usuarios intentando reservar el mismo contenedor: solo uno puede completar la operación.
6. Confirmar carga: comprobar identificador y código, sin descuento.
7. Despachar viaje: un SALIDA_ENTREGA por detalle; repetir no duplica.
8. Entrega parcial: aceptar cantidad menor, guardar incidencia y no crear stock.
9. Cliente A no puede consultar ni confirmar entregas de cliente B.
10. Manifiestos, Inventario, Ventas, Matriz Legal y KPIs deben conservar funcionalidad.

## Despliegue

Respaldar Supabase; validar Prisma y CI; aplicar SQL incremental; verificar índices/RLS/tablas y número de excepciones PENDIENTES; desplegar backend-deploy ANTES de frontend-deploy; probar roles, carga y acuse sin impactar inventario histórico.