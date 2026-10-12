ALTER TABLE public.lotes_produccion
  ADD COLUMN IF NOT EXISTS "cantidad_Cargada" numeric(18, 4);

COMMENT ON COLUMN public.lotes_produccion."cantidad_Cargada" IS
  'Carga física del lote en tanque, independiente de los movimientos de consumo del almacén.';
