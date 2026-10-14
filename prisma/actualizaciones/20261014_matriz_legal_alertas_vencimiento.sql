-- Historial persistente e idempotente de avisos de vencimiento de la Matriz Legal.
-- Ejecutar una sola vez en Supabase antes de desplegar el backend actualizado.
BEGIN;

CREATE TABLE public.tramites_alertas_vencimiento (
  id SERIAL PRIMARY KEY,
  tramite_id INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  meses_anticipacion INTEGER NOT NULL,
  destinatario VARCHAR(255) NOT NULL,
  estado VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
  intentos INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_en TIMESTAMPTZ(6),
  siguiente_intento_en TIMESTAMPTZ(6),
  bloqueado_hasta TIMESTAMPTZ(6),
  ultimo_error VARCHAR(1000),
  CONSTRAINT fk_alerta_vencimiento_tramite
    FOREIGN KEY (tramite_id)
    REFERENCES public.tramites_legales ("id_Tramite_Legal")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT ck_alerta_vencimiento_meses
    CHECK (meses_anticipacion IN (1, 2, 4, 6)),
  CONSTRAINT ck_alerta_vencimiento_estado
    CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'ENVIADA', 'CANCELADA')),
  CONSTRAINT ck_alerta_vencimiento_intentos
    CHECK (intentos >= 0),
  CONSTRAINT uq_alerta_tramite_vencimiento_hito
    UNIQUE (tramite_id, fecha_vencimiento, meses_anticipacion)
);

CREATE INDEX idx_alerta_vencimiento_pendientes
  ON public.tramites_alertas_vencimiento (estado, siguiente_intento_en, bloqueado_hasta);

CREATE INDEX idx_alerta_vencimiento_tramite
  ON public.tramites_alertas_vencimiento (tramite_id, creado_en);

CREATE INDEX idx_tramites_legal_fecha_vencimiento
  ON public.tramites_legales ("fecha_Vencimiento");

-- La aplicación accede por Prisma desde el backend. La API Data de Supabase
-- no debe poder leer estos destinatarios ni el historial de envíos.
ALTER TABLE public.tramites_alertas_vencimiento ENABLE ROW LEVEL SECURITY;

COMMIT;
