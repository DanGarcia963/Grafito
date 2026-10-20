-- Caracterización estructurada de muestras de oportunidades CRM.
CREATE TYPE "crm_tipo_contacto" AS ENUM (
  'VISITA_PLANTA',
  'VISITA_CLIENTE',
  'PRESENTACION',
  'LLAMADA',
  'CORREO',
  'OTRO'
);

CREATE TYPE "crm_documento_cliente_tipo" AS ENUM (
  'CONSTANCIA_FISCAL',
  'OPINION_CUMPLIMIENTO',
  'COMPROBANTE_DOMICILIO',
  'CARATULA_BANCARIA',
  'OTRO'
);

ALTER TYPE "crm_oportunidad_historial_accion"
  ADD VALUE 'REPORTE_ID_ENVIADO_VENTAS';

ALTER TABLE "muestras"
  ADD COLUMN "id_analisis_final" JSONB,
  ADD COLUMN "id_analisis_preliminar" JSONB,
  ADD COLUMN "id_flujo_estructurado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "id_procesamiento" JSONB;

ALTER TABLE "crm_oportunidad_historial"
  ADD COLUMN "fecha_contacto" TIMESTAMPTZ(6),
  ADD COLUMN "tipo_contacto" "crm_tipo_contacto";

ALTER TABLE "id_reportes_oportunidad"
  ADD COLUMN "enviado_ventas_correo" VARCHAR(180),
  ADD COLUMN "enviado_ventas_en" TIMESTAMPTZ(6),
  ADD COLUMN "enviado_ventas_por" VARCHAR(100);

ALTER TABLE "crm_cotizaciones"
  ADD COLUMN "token_respuesta_expira" TIMESTAMPTZ(6),
  ADD COLUMN "token_respuesta_hash" CHAR(64);

CREATE TABLE "crm_documentos_cliente" (
  "id" SERIAL NOT NULL,
  "persona_id" INTEGER NOT NULL,
  "tipo_documento" "crm_documento_cliente_tipo" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "vigente" BOOLEAN NOT NULL DEFAULT true,
  "nombre_archivo" VARCHAR(255) NOT NULL,
  "tipo_mime" VARCHAR(150) NOT NULL,
  "contenido" BYTEA NOT NULL,
  "subido_por" VARCHAR(100) NOT NULL,
  "subido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_documentos_cliente_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_documentos_cliente_persona_id_fkey"
    FOREIGN KEY ("persona_id") REFERENCES "personas"("id_Persona")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "idx_crm_documento_cliente_actual"
  ON "crm_documentos_cliente"("persona_id", "tipo_documento", "vigente");

CREATE UNIQUE INDEX "uq_crm_documento_cliente_version"
  ON "crm_documentos_cliente"("persona_id", "tipo_documento", "version");

-- Solo se permite una versión vigente por tipo de documento y cuenta.
CREATE UNIQUE INDEX "uq_crm_documento_cliente_vigente"
  ON "crm_documentos_cliente"("persona_id", "tipo_documento")
  WHERE "vigente" = true;

CREATE INDEX "idx_crm_historial_ultimo_contacto"
  ON "crm_oportunidad_historial"("oportunidad_id", "fecha_contacto");

CREATE UNIQUE INDEX "uq_crm_cotizacion_token_respuesta"
  ON "crm_cotizaciones"("token_respuesta_hash");

-- Los documentos del prospecto contienen información fiscal y bancaria.
-- La aplicación NestJS accede por Prisma con el rol de servidor; no se publican
-- políticas para los roles cliente de la Data API de Supabase.
ALTER TABLE "crm_documentos_cliente" ENABLE ROW LEVEL SECURITY;
