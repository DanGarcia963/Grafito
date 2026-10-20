-- Permite registrar una recompra que conserva la trazabilidad del análisis y
-- precio objetivo que ventas decidió reutilizar. No crea una nueva muestra.
ALTER TYPE "crm_oportunidad_historial_accion"
  ADD VALUE 'REPORTE_ID_REUTILIZADO';

ALTER TYPE "crm_oportunidad_historial_accion"
  ADD VALUE 'ORDEN_VENTA_CONFIRMADA';

ALTER TYPE "crm_orden_venta_estado"
  ADD VALUE 'BORRADOR' BEFORE 'CONFIRMADA';

ALTER TABLE "id_reportes_oportunidad"
  ADD COLUMN "reutilizado_de_id" INTEGER,
  ADD COLUMN "reutilizado_de_cotizacion_id" INTEGER,
  ADD CONSTRAINT "fk_id_reporte_reutilizado_de"
    FOREIGN KEY ("reutilizado_de_id")
    REFERENCES "id_reportes_oportunidad"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "fk_id_reporte_cotizacion_origen"
    FOREIGN KEY ("reutilizado_de_cotizacion_id")
    REFERENCES "crm_cotizaciones"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_id_reporte_reutilizado_de"
  ON "id_reportes_oportunidad"("reutilizado_de_id");

CREATE INDEX "idx_id_reporte_cotizacion_origen"
  ON "id_reportes_oportunidad"("reutilizado_de_cotizacion_id");

ALTER TABLE "crm_costos_oportunidad"
  ADD COLUMN "reutilizado_de_id" INTEGER,
  ADD CONSTRAINT "fk_crm_costo_reutilizado_de"
    FOREIGN KEY ("reutilizado_de_id")
    REFERENCES "crm_costos_oportunidad"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_crm_costos_reutilizado_de"
  ON "crm_costos_oportunidad"("reutilizado_de_id");
