# Planeación visual de transportes — Portal Haas/GKN

## Objetivo

Nueva sección del dashboard de cliente / Producción, situada debajo de las gráficas de inventario.
Representa visualmente una posible salida de contenedores, **sin registrar un embarque real**.

- **Tortón:** máximo 12 contenedores (12 casillas, 2 × 6).
- **Tráiler:** máximo 22 contenedores (22 casillas, 2 × 11).
- Se pueden agregar varios vehículos de cada tipo (máximo preventivo de 40 vehículos en una planeación local).
- Controles para sumar/restar 1 contenedor o capturar directamente un número entero entre 0 y la capacidad.
- Dibujo SVG de cada camión con casillas de contenedores que se llenan progresivamente.
- Barra de ocupación, espacios disponibles y resumen de vehículos, contenedores planeados y capacidad total.
- Se puede eliminar cualquier vehículo del escenario.

## Almacenamiento

La información se guarda en `localStorage` del navegador, bajo la clave
`grafito:portal-cliente:transporte-visual:v1:<id_cliente>`.

**No está compartida entre usuarios o equipos, no se sincroniza con el servidor, no crea documentos de salida y no altera el inventario.**
Los datos pueden perderse si se limpia el navegador. La visualización no se debe interpretar como número de
contenedores despachados o embarques reales.

No se requieren tablas, variables de entorno, migraciones ni modificaciones de Supabase.
Se aísla la planeación por cliente (al cambiar cliente desde Producción se recupera el escenario de ese cliente).
La lectura del navegador se valida y acota para evitar números negativos, superiores a la capacidad o registros corruptos.

## Archivos

- `frontend/src/components/PortalPlanTransportes.tsx`: tarjetas, controles, camiones SVG y estado local.
- `frontend/src/app/portal-cliente/page.tsx`: integración dentro del dashboard.

## Prueba sugerida

1. Inicia sesión como cliente y agrega un tortón y un tráiler.
2. Registra 5/12 en el tortón y 18/22 en el tráiler; verifica 23 contenedores planeados y 34 de capacidad.
3. Prueba máximos, mínimos y editar la cantidad manualmente.
4. Recarga el navegador y verifica que los vehículos y cantidades se conserven.
5. Elimina un vehículo y verifica que los totales disminuyan.
6. En Producción cambia de cliente: la planeación visual de un cliente no debe aparecer en la del otro.
7. Confirma que inventario, lotes y movimientos de Supabase no cambiaron.

## Futuro

Cuando exista un módulo de embarques, migrar esta simulación a registros de transporte
con fecha, cliente, folio, lote(s), contenedor(es), validaciones de disponibilidad, confirmación
de salida y trazabilidad transaccional. No convertir automáticamente los escenarios locales en movimientos físicos.
