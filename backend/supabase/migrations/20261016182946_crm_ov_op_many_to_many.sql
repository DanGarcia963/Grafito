BEGIN;

CREATE TABLE public.crm_ordenes_venta_produccion (
  orden_venta_id integer NOT NULL,
  orden_produccion_id integer NOT NULL,
  creado_por varchar(100) NOT NULL,
  creado_en timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_crm_ordenes_venta_produccion
    PRIMARY KEY (orden_venta_id, orden_produccion_id),
  CONSTRAINT fk_crm_ov_op_venta
    FOREIGN KEY (orden_venta_id)
    REFERENCES public.crm_ordenes_venta(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_crm_ov_op_produccion
    FOREIGN KEY (orden_produccion_id)
    REFERENCES public.ordenes_produccion("id_Orden_Produc")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_crm_ov_op_produccion
  ON public.crm_ordenes_venta_produccion (orden_produccion_id);

-- Conserva cada vínculo anterior y su autoría sin inferir repartos de cantidad.
INSERT INTO public.crm_ordenes_venta_produccion (
  orden_venta_id,
  orden_produccion_id,
  creado_por,
  creado_en
)
SELECT
  op.orden_venta_id,
  op."id_Orden_Produc",
  op.creado_por,
  op.creado_en
FROM public.ordenes_produccion AS op
WHERE op.orden_venta_id IS NOT NULL;

-- Esta relación solo la administra el backend conectado a PostgreSQL.
ALTER TABLE public.crm_ordenes_venta_produccion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_ordenes_venta_produccion FROM anon, authenticated;

COMMENT ON TABLE public.crm_ordenes_venta_produccion IS
  'Trazabilidad muchos-a-muchos entre órdenes de venta y órdenes de producción.';

COMMIT;
