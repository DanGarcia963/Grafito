-- El aviso de coincidencias es orientativo y el usuario puede confirmar
-- el alta aun cuando el nombre se parezca o sea igual a otro del catálogo.
ALTER TABLE public.catalogo_tramites
  DROP CONSTRAINT IF EXISTS uq_tramite_area;

DROP INDEX IF EXISTS public.uq_tramite_area;
