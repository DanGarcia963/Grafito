ALTER TABLE public.resultado_analisis
  ADD COLUMN IF NOT EXISTS calculo_aplicado jsonb;

COMMENT ON COLUMN public.resultado_analisis.calculo_aplicado IS
  'Entradas originales y fórmula aplicada al valor de resultado para permitir auditoría del cálculo.';