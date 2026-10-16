BEGIN;

ALTER TABLE public.crm_ordenes_venta_produccion
  ADD COLUMN cantidad_producto_terminado numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN cantidad_asignada_por varchar(100),
  ADD COLUMN cantidad_asignada_en timestamptz(6),
  ADD CONSTRAINT ck_crm_ov_op_cantidad_producto_terminado_no_negativa
    CHECK (cantidad_producto_terminado >= 0);

COMMENT ON COLUMN public.crm_ordenes_venta_produccion.cantidad_producto_terminado IS
  'Cantidad real de producto terminado de la OP asignada a cumplir esta OV; no es material de entrada ni cantidad planificada.';

COMMENT ON TABLE public.crm_ordenes_venta_produccion IS
  'Trazabilidad OP↔OV; cantidad_producto_terminado es la salida real aportada por la OP para cubrir la OV.';

COMMIT;
