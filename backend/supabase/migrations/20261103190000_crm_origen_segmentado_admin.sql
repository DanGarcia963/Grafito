CREATE TYPE "crm_origen_prospecto_tipo" AS ENUM (
  'MARKETING_DIGITAL',
  'EXPOSICION',
  'REFERENCIA'
);

ALTER TABLE "crm_perfiles_comerciales"
  ADD COLUMN "origen_prospecto_tipo" "crm_origen_prospecto_tipo",
  ADD COLUMN "origen_prospecto_detalle" VARCHAR(180);

-- Conserva el texto original y clasifica solamente los casos que se pueden reconocer.
UPDATE "crm_perfiles_comerciales"
SET
  "origen_prospecto_tipo" = CASE
    WHEN "origen_prospecto" ILIKE '%marketing%' THEN 'MARKETING_DIGITAL'::"crm_origen_prospecto_tipo"
    WHEN "origen_prospecto" ILIKE '%expo%' THEN 'EXPOSICION'::"crm_origen_prospecto_tipo"
    WHEN "origen_prospecto" ILIKE '%refer%' THEN 'REFERENCIA'::"crm_origen_prospecto_tipo"
    ELSE NULL
  END,
  "origen_prospecto_detalle" = CASE
    WHEN "origen_prospecto" ILIKE '%expo%' THEN NULLIF(BTRIM(REGEXP_REPLACE("origen_prospecto", '^(expo(sici[oó]n)?)([[:space:]:-]+)?', '', 'i')), '')
    WHEN "origen_prospecto" ILIKE '%refer%' THEN NULLIF(BTRIM(REGEXP_REPLACE("origen_prospecto", '^(referencia|referido)([[:space:]:-]+)?', '', 'i')), '')
    ELSE NULL
  END
WHERE "origen_prospecto" IS NOT NULL;

CREATE INDEX "idx_crm_perfil_origen_vendedor"
  ON "crm_perfiles_comerciales"("origen_prospecto_tipo", "vendedor_responsable_id");
