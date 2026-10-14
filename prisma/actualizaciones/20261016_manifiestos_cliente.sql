-- Vincula manifiestos independientes (por ejemplo GKN) con el cliente de CRM
-- para dirigir los envíos manuales a su correo registrado.
BEGIN;

ALTER TABLE public.manifiestos
  ADD COLUMN cliente_id INTEGER;

ALTER TABLE public.manifiestos
  ADD CONSTRAINT fk_manifiestos_cliente
  FOREIGN KEY (cliente_id)
  REFERENCES public.personas("id_Persona")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX idx_manifiestos_cliente
  ON public.manifiestos (cliente_id);

UPDATE public.manifiestos AS m
SET cliente_id = o.persona_id
FROM public.crm_ordenes_venta AS o
WHERE m.orden_venta_id = o.id
  AND m.cliente_id IS NULL;

-- Las solicitudes sencillas creadas por SHyMA entran a Recolección sin
-- número de manifiesto ni operador; Logística puede completar esos datos
-- cuando el pedido nace de una OV y empieza en PEDIDO.
ALTER TABLE public.manifiestos
  DROP CONSTRAINT IF EXISTS ck_manifiestos_datos_al_salir_de_pedido;

ALTER TABLE public.manifiestos
  ADD CONSTRAINT ck_manifiestos_datos_al_salir_de_pedido CHECK (
    estado IN ('PEDIDO', 'RECOLECCION') OR
    (NULLIF(BTRIM("no_Manifiesto"), '') IS NOT NULL AND
     "fecha_Expedicion" IS NOT NULL AND operador_id IS NOT NULL)
  );

COMMIT;
