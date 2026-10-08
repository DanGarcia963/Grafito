-- Alinea la unicidad con la clave foránea compuesta reporte/oportunidad.
ALTER TABLE "public"."crm_costos_oportunidad"
  DROP CONSTRAINT "uq_crm_costos_reporte";
ALTER TABLE "public"."crm_costos_oportunidad"
  ADD CONSTRAINT "uq_crm_costos_reporte" UNIQUE ("reporte_id", "oportunidad_id");
