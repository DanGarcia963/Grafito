ALTER TABLE public.muestras
  ADD COLUMN IF NOT EXISTS "aditivos_ajuste" jsonb;

COMMENT ON COLUMN public.muestras."aditivos_ajuste"
  IS 'Aditivos y cantidades sugeridas en Calidad para muestras MUESTRA_POR_AJUSTE; null para las demás muestras.';
