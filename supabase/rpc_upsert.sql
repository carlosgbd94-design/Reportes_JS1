-- ===================================================================================
-- rpc_upsert.sql
-- Función atómica para importación masiva de datos CSV del SIS.
-- Ejecuta en una sola transacción: upsert de unidades, borrado de meses y
-- carga de nuevos registros, garantizando consistencia en caso de falla de red.
--
-- Permisos: Solo ADMIN y JURISDICCIONAL pueden ejecutar esta función.
-- Seguridad: SECURITY DEFINER — corre con permisos de propietario del esquema.
-- ===================================================================================

CREATE OR REPLACE FUNCTION public.upsert_registros_sis(
  p_unidades JSONB,
  p_registros JSONB,
  p_meses INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unidades_sync  INTEGER := 0;
  v_registros_del  INTEGER := 0;
  v_registros_ins  INTEGER := 0;
BEGIN
  -- Verificar que el usuario tiene rol ADMIN o JURISDICCIONAL
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid()
      AND UPPER(rol) IN ('ADMIN', 'JURISDICCIONAL')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol ADMIN o JURISDICCIONAL';
  END IF;

  -- 1. Upsert de unidades médicas (ignorar duplicados)
  INSERT INTO public.unidades_medicas (clues, nombre, municipio)
  SELECT
    (u ->> 'clues'),
    (u ->> 'nombre'),
    (u ->> 'municipio')
  FROM jsonb_array_elements(p_unidades) AS u
  ON CONFLICT (clues) DO NOTHING;

  GET DIAGNOSTICS v_unidades_sync = ROW_COUNT;

  -- 2. Borrar registros de los meses que vienen en el CSV (transaccional)
  DELETE FROM public.registros_sis
  WHERE mes = ANY(p_meses);

  GET DIAGNOSTICS v_registros_del = ROW_COUNT;

  -- 3. Inserción masiva de los nuevos registros
  INSERT INTO public.registros_sis (clues, variable_sis, valor, mes, anio)
  SELECT
    (r ->> 'clues'),
    (r ->> 'variable_sis'),
    (r ->> 'valor')::INTEGER,
    (r ->> 'mes')::INTEGER,
    (r ->> 'anio')::INTEGER
  FROM jsonb_array_elements(p_registros) AS r;

  GET DIAGNOSTICS v_registros_ins = ROW_COUNT;

  -- Retornar resumen del proceso
  RETURN jsonb_build_object(
    'ok', TRUE,
    'unidades_nuevas', v_unidades_sync,
    'registros_eliminados', v_registros_del,
    'registros_insertados', v_registros_ins
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', SQLERRM
    );
END;
$$;
