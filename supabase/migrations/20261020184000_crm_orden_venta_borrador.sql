-- Una cotización aceptada crea el borrador comercial. Sólo al completarlo se
-- confirma la OV y se genera el manifiesto que habilita su recorrido operativo.
ALTER TABLE "crm_ordenes_venta"
  ALTER COLUMN "orden_cliente" DROP NOT NULL,
  ALTER COLUMN "fecha_confirmacion" DROP NOT NULL;

ALTER TABLE "crm_ordenes_venta"
  ADD CONSTRAINT "ck_crm_orden_venta_confirmacion"
  CHECK (
    ("estado" <> 'BORRADOR' OR ("fecha_confirmacion" IS NULL AND "orden_cliente" IS NULL))
    AND
    ("estado" <> 'CONFIRMADA' OR ("fecha_confirmacion" IS NOT NULL AND "orden_cliente" IS NOT NULL))
  );

ALTER TABLE "crm_ordenes_venta"
  DROP CONSTRAINT IF EXISTS "ck_crm_ordenes_venta_cancelacion";

ALTER TABLE "crm_ordenes_venta"
  ADD CONSTRAINT "ck_crm_ordenes_venta_cancelacion"
  CHECK (
    ("estado" = 'CANCELADA' AND "fecha_cancelacion" IS NOT NULL AND NULLIF(btrim("motivo_cancelacion"), '') IS NOT NULL)
    OR
    ("estado" IN ('BORRADOR', 'CONFIRMADA') AND "fecha_cancelacion" IS NULL)
  );
