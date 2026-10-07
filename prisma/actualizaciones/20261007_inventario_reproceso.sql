-- Incremental sobre schema.prisma de main 8d3f6f9. No borra tablas ni datos.
-- Ejecutar completo con psql -v ON_ERROR_STOP=1 -f este_archivo.
-- No ejecutar dentro de una transacción exterior: PostgreSQL necesita confirmar enums.
ALTER TYPE inventario_condicion ADD VALUE IF NOT EXISTS 'REZAGADO';
ALTER TYPE inventario_condicion ADD VALUE IF NOT EXISTS 'FUERA_DE_ESPECIFICACION';
BEGIN;
ALTER TABLE crm_ordenes_venta ADD COLUMN IF NOT EXISTS especificaciones jsonb;
ALTER TABLE productos_materiales ADD COLUMN IF NOT EXISTS configuracion_operativa jsonb;
ALTER TABLE lotes_inventario ADD COLUMN IF NOT EXISTS especificaciones jsonb;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS es_reproceso boolean NOT NULL DEFAULT false;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS motivo_reproceso text;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS propietario_id integer REFERENCES personas("id_Persona") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Recuperar propietario comercial existente. No inferirlo desde observaciones.
UPDATE ordenes_produccion op SET propietario_id = ov.persona_id
FROM crm_ordenes_venta ov
WHERE op.orden_venta_id = ov.id AND ov.tipo_venta = 'SERVICIO_REGENERACION' AND op.propietario_id IS NULL;
UPDATE ordenes_produccion op SET propietario_id = r.propietario
FROM (SELECT r.orden_produccion_id, min(l.propietario_id) propietario
      FROM inventario_reservas r JOIN lotes_inventario l ON l.id=r.lote_inventario_id
      WHERE l.propiedad='DE_CLIENTE' GROUP BY r.orden_produccion_id
      HAVING count(DISTINCT l.propietario_id)=1) r
WHERE op."id_Orden_Produc"=r.orden_produccion_id AND op.propietario_id IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM inventario_reservas r JOIN lotes_inventario l ON l.id=r.lote_inventario_id
    JOIN ordenes_produccion op ON op."id_Orden_Produc"=r.orden_produccion_id
    WHERE l.propiedad='DE_CLIENTE' AND l.propietario_id IS DISTINCT FROM op.propietario_id)
  THEN RAISE EXCEPTION 'Existen OP con propietarios incompatibles: revisar antes de migrar'; END IF;
END $$;
UPDATE productos_materiales SET configuracion_operativa =
'{"campos":[{"clave":"tipo_prensa","etiqueta":"Tipo de prensa","opciones":["Forgemaster","Polymaster","Fagor"],"requerido":true}],"peso_min_kg":850,"peso_max_kg":1000}'::jsonb
WHERE upper(regexp_replace("nombre_Producto", '[^a-zA-Z0-9]', '', 'g'))='ORSAVFGR'
AND configuracion_operativa IS NULL;
-- Los datos históricos quedan sin detalle: no inventar contenedores ni pesos.
COMMIT;
