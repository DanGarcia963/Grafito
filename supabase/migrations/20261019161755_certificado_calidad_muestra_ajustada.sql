ALTER TABLE public.certificado_calidad
  ADD COLUMN muestra_id INTEGER,
  ADD COLUMN documento_nombre VARCHAR(255),
  ADD COLUMN documento_mime VARCHAR(150),
  ADD COLUMN documento_contenido BYTEA;

ALTER TABLE public.certificado_calidad
  ADD CONSTRAINT fk_cert_muestra
  FOREIGN KEY (muestra_id)
  REFERENCES public.muestras("id_Muestra")
  ON UPDATE RESTRICT
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_certificado_calidad_muestra
  ON public.certificado_calidad (muestra_id);
