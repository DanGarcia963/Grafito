CREATE TYPE "crm_oportunidad_prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

ALTER TABLE "crm_oportunidades"
  ADD COLUMN "prioridad" "crm_oportunidad_prioridad" NOT NULL DEFAULT 'MEDIA';
