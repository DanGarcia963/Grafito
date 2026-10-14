-- Módulo de Manifiestos: pipeline, checklist SHyMA, documentos y bitácora.
-- Aplicar una sola vez en Supabase antes de desplegar la versión del backend.
BEGIN;

CREATE TABLE public.manifiestos (
  id SERIAL PRIMARY KEY,
  "no_Manifiesto" VARCHAR(100),
  "fecha_Expedicion" DATE,
  estado VARCHAR(30) NOT NULL DEFAULT 'PEDIDO',
  orden_venta_id INTEGER,
  operador_id INTEGER,
  es_gkn BOOLEAN NOT NULL DEFAULT FALSE,
  razon_social_generadora VARCHAR(200),
  nombre_residuo VARCHAR(200),
  transportista VARCHAR(200),
  transportista_autorizacion VARCHAR(100),
  transportista_placas VARCHAR(40),
  transportista_registro_sct VARCHAR(80),
  destino_autorizacion VARCHAR(100),
  destino_razon_social VARCHAR(200),
  "linea_Produccion" VARCHAR(80),
  numero_compra VARCHAR(100),
  peso_pedido NUMERIC(18,4),
  peso_llegada NUMERIC(18,4),
  fecha_recepcion_almacen TIMESTAMPTZ(6),
  checklist JSONB,
  motivo_correccion TEXT,
  documento_llegada_nombre VARCHAR(255),
  documento_llegada_mime VARCHAR(150),
  documento_llegada_contenido BYTEA,
  firmado_por_persona_id INTEGER,
  firmado_en TIMESTAMPTZ(6),
  documento_manifiesto_nombre VARCHAR(255),
  documento_manifiesto_mime VARCHAR(150),
  documento_manifiesto_contenido BYTEA,
  resguardado_por_persona_id INTEGER,
  resguardado_en TIMESTAMPTZ(6),
  creado_por VARCHAR(100) NOT NULL,
  creado_en TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_manifiestos_numero UNIQUE ("no_Manifiesto"),
  CONSTRAINT fk_manifiestos_orden_venta FOREIGN KEY (orden_venta_id)
    REFERENCES public.crm_ordenes_venta(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_manifiestos_operador FOREIGN KEY (operador_id)
    REFERENCES public.personas("id_Persona") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_manifiestos_firmado_por FOREIGN KEY (firmado_por_persona_id)
    REFERENCES public.personas("id_Persona") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_manifiestos_resguardado_por FOREIGN KEY (resguardado_por_persona_id)
    REFERENCES public.personas("id_Persona") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_manifiestos_estado CHECK (estado IN (
    'PEDIDO', 'RECOLECCION', 'PESAJE', 'VERIFICAR_DATOS',
    'CORRECCION_DATOS', 'CONTADURIA', 'RESGUARDO'
  )),
  CONSTRAINT ck_manifiestos_pesos_no_negativos CHECK (
    (peso_pedido IS NULL OR peso_pedido >= 0) AND
    (peso_llegada IS NULL OR peso_llegada >= 0)
  ),
  CONSTRAINT ck_manifiestos_datos_al_salir_de_pedido CHECK (
    estado = 'PEDIDO' OR
    (NULLIF(BTRIM("no_Manifiesto"), '') IS NOT NULL AND
     "fecha_Expedicion" IS NOT NULL AND operador_id IS NOT NULL)
  ),
  CONSTRAINT ck_manifiestos_checklist_objeto CHECK (
    checklist IS NULL OR jsonb_typeof(checklist) = 'object'
  )
);

CREATE INDEX idx_manifiestos_estado_actualizado
  ON public.manifiestos (estado, actualizado_en DESC);
CREATE INDEX idx_manifiestos_orden_estado
  ON public.manifiestos (orden_venta_id, estado);
CREATE INDEX idx_manifiestos_operador
  ON public.manifiestos (operador_id);
CREATE UNIQUE INDEX uq_manifiestos_numero_ci
  ON public.manifiestos (lower(BTRIM("no_Manifiesto")))
  WHERE "no_Manifiesto" IS NOT NULL;

CREATE TABLE public.manifiesto_eventos (
  id SERIAL PRIMARY KEY,
  manifiesto_id INTEGER NOT NULL,
  estado_anterior VARCHAR(30),
  estado_nuevo VARCHAR(30) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  actor_persona_id INTEGER,
  actor_usuario VARCHAR(100) NOT NULL,
  datos JSONB,
  creado_en TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_manifiesto_eventos_manifest FOREIGN KEY (manifiesto_id)
    REFERENCES public.manifiestos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_manifiesto_eventos_actor FOREIGN KEY (actor_persona_id)
    REFERENCES public.personas("id_Persona") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_manifiesto_eventos_estado_nuevo CHECK (estado_nuevo IN (
    'PEDIDO', 'RECOLECCION', 'PESAJE', 'VERIFICAR_DATOS',
    'CORRECCION_DATOS', 'CONTADURIA', 'RESGUARDO'
  )),
  CONSTRAINT ck_manifiesto_eventos_datos_objeto CHECK (
    datos IS NULL OR jsonb_typeof(datos) = 'object'
  )
);
CREATE INDEX idx_manifiesto_eventos_manifest_fecha
  ON public.manifiesto_eventos (manifiesto_id, creado_en DESC);
CREATE INDEX idx_manifiesto_eventos_actor_fecha
  ON public.manifiesto_eventos (actor_persona_id, creado_en DESC);

-- Crea tarjetas PEDIDO para las órdenes vigentes que ya existían antes de desplegar el módulo.
WITH creados AS (
  INSERT INTO public.manifiestos (
    estado, orden_venta_id, es_gkn, razon_social_generadora, numero_compra,
    peso_pedido, creado_por
  )
  SELECT
    'PEDIDO', o.id, FALSE, p.nombre, o.orden_cliente,
    CASE WHEN o.unidad::text = 'Kilogramos' THEN o.cantidad ELSE NULL END,
    'MIGRACION'
  FROM public.crm_ordenes_venta AS o
  JOIN public.personas AS p ON p."id_Persona" = o.persona_id
  WHERE o.estado::text <> 'CANCELADA'
    AND NOT EXISTS (
      SELECT 1 FROM public.manifiestos AS m WHERE m.orden_venta_id = o.id
    )
  RETURNING id, orden_venta_id
)
INSERT INTO public.manifiesto_eventos (
  manifiesto_id, estado_nuevo, accion, actor_usuario, datos
)
SELECT
  id, 'PEDIDO', 'CREADO_DESDE_ORDEN_EXISTENTE', 'MIGRACION',
  jsonb_build_object('orden_venta_id', orden_venta_id)
FROM creados;

-- Todo el acceso pasa por el backend autenticado; no se expone por Data API.
ALTER TABLE public.manifiestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifiesto_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manifiestos, public.manifiesto_eventos FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.manifiestos_id_seq, public.manifiesto_eventos_id_seq FROM anon, authenticated;

COMMIT;
