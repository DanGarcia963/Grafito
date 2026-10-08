-- Entrega de fórmula de I+D a Costos y precio objetivo de vuelta a Ventas.
-- Cada registro corresponde a una versión de un reporte viable.
-- El id ya es PK; esta clave adicional respalda la relación compuesta de Prisma.
ALTER TABLE "public"."id_reportes_oportunidad"
  ADD CONSTRAINT "uq_id_reporte_oportunidad" UNIQUE ("id", "oportunidad_id");
CREATE TABLE "public"."crm_costos_oportunidad" (
  "id" SERIAL NOT NULL,
  "oportunidad_id" INTEGER NOT NULL,
  "reporte_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "formula" TEXT NOT NULL,
  "formula_enviada_por" VARCHAR(100) NOT NULL,
  "formula_enviada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "precio_objetivo_litro" DECIMAL(18,6),
  "moneda" "public"."crm_moneda" NOT NULL DEFAULT 'MXN',
  "precio_emitido_por" VARCHAR(100),
  "precio_emitido_en" TIMESTAMPTZ(6),
  CONSTRAINT "crm_costos_oportunidad_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_crm_costos_oportunidad_version" UNIQUE ("oportunidad_id", "version"),
  CONSTRAINT "uq_crm_costos_reporte" UNIQUE ("reporte_id", "oportunidad_id"),
  CONSTRAINT "fk_crm_costos_oportunidad" FOREIGN KEY ("oportunidad_id")
    REFERENCES "public"."crm_oportunidades"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_crm_costos_reporte" FOREIGN KEY ("reporte_id", "oportunidad_id")
    REFERENCES "public"."id_reportes_oportunidad"("id", "oportunidad_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "chk_crm_costos_precio_emitido" CHECK (
    ("precio_objetivo_litro" IS NULL AND "precio_emitido_por" IS NULL AND "precio_emitido_en" IS NULL)
    OR ("precio_objetivo_litro" > 0 AND "precio_emitido_por" IS NOT NULL AND "precio_emitido_en" IS NOT NULL)
  )
);
CREATE INDEX "idx_crm_costos_emitido" ON "public"."crm_costos_oportunidad"("precio_emitido_en");
ALTER TABLE "public"."crm_costos_oportunidad" ENABLE ROW LEVEL SECURITY;
