-- Conserva resultados cualitativos sin cambiar los resultados numéricos existentes.
ALTER TABLE public.resultado_analisis
  ADD COLUMN IF NOT EXISTS "valor_Obtenido_Texto" text;
