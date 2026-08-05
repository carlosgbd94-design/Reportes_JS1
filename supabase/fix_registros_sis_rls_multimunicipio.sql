-- Fix: perfiles MUNICIPAL con 2+ municipios (ej. CORREGIDORA,HUIMILPAN) no podian leer registros_sis
-- porque la politica comparaba unidades_medicas.municipio contra el texto completo de municipio_asignado.
DROP POLICY IF EXISTS "Select Registros Municipal" ON public.registros_sis;
CREATE POLICY "Select Registros Municipal" ON public.registros_sis
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM perfiles p
    JOIN unidades_medicas u ON (u.clues::text = registros_sis.clues::text)
    WHERE p.id = auth.uid()
      AND upper(p.rol) = 'MUNICIPAL'
      AND (
        u.municipio::text = p.municipio_asignado::text
        OR u.municipio::text = ANY (p.municipios_allowed)
        OR u.municipio::text = ANY (string_to_array(p.municipio_asignado, ','))
        OR u.municipio::text = ANY (string_to_array(p.municipio, ','))
      )
  )
);

-- Fix: la politica de UNIDAD comparaba el perfil consigo mismo (clues = clues_asignado)
-- sin referenciar registros_sis, por lo que exponia TODA la tabla a cualquier usuario UNIDAD.
DROP POLICY IF EXISTS "Select Registros Unidad" ON public.registros_sis;
CREATE POLICY "Select Registros Unidad" ON public.registros_sis
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.id = auth.uid()
      AND upper(p.rol) = 'UNIDAD'
      AND registros_sis.clues::text = p.clues_asignado::text
  )
);

-- Funcion sin ningun control de acceso y sin uso en el codigo actual: hacia bypass total de RLS.
DROP FUNCTION IF EXISTS public.get_registros_sis_by_year(integer);
