-- ===================================================================================
-- Fix: el subpanel Admin "Capacitaciones" consultaba una tabla "archivos_drive" que
-- nunca se migró de Google Drive a Supabase -> 404 en cada carga. Las evidencias reales
-- viven hoy en Cloudflare R2 (public.r2_objects) y en Supabase Storage
-- (storage.objects, bucket 'evidencias'), bajo la ruta
-- "Evidencia_de_capacitaciones/{capacitacion}/{clues}_{unidad}/{archivo}".
-- ===================================================================================

-- 1. Parametrizar el límite de get_evidences_list_by_category (antes fijo en 100),
--    manteniendo el comportamiento por defecto igual para no romper al único caller
--    existente (case "listfiles" en main.js, navegador de archivos por categoría).
CREATE OR REPLACE FUNCTION public.get_evidences_list_by_category(category_name text, p_max_rows integer DEFAULT 100)
 RETURNS TABLE(name text, bucket_id text, owner uuid, created_at timestamp with time zone, updated_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, public_url text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata, public_url
  FROM (
    SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata, public_url
    FROM public.r2_objects
    WHERE bucket_id = 'sirevaq-evidencias'
      AND name LIKE (category_name || '/%')
    UNION ALL
    SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata,
           'https://utclfqjietlxzlorxhrs.supabase.co/storage/v1/object/public/evidencias/' || name as public_url
    FROM storage.objects
    WHERE bucket_id = 'evidencias'
      AND name LIKE (category_name || '/%')
  ) sub
  ORDER BY created_at DESC
  LIMIT p_max_rows;
$function$;

-- 2. Nueva RPC: reemplazo directo de la consulta rota a "archivos_drive". Cuenta
--    unidades distintas que subieron evidencia por capacitación, agregado en SQL --
--    sin límite de filas porque el resultado es 1 fila por capacitación, no por archivo.
--    Descarta rutas heredadas de antes de que existiera la carpeta por capacitación
--    (Categoria/CLUES_Unidad/archivo, 3 tramos) en vez de contarlas como capacitaciones
--    falsas -- solo cuenta Categoria/Capacitacion/CLUES_Unidad/archivo (4 tramos).
CREATE OR REPLACE FUNCTION public.get_capacitaciones_evidencia_stats()
 RETURNS TABLE(capacitacion text, unidades_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  WITH archivos AS (
    SELECT name FROM public.r2_objects
    WHERE bucket_id = 'sirevaq-evidencias' AND name LIKE 'Evidencia_de_capacitaciones/%'
    UNION ALL
    SELECT name FROM storage.objects
    WHERE bucket_id = 'evidencias' AND name LIKE 'Evidencia_de_capacitaciones/%'
  ),
  valid_paths AS (
    SELECT name FROM archivos WHERE array_length(string_to_array(name, '/'), 1) >= 4
  ),
  parsed AS (
    SELECT
      split_part(name, '/', 2) AS capacitacion,
      split_part(split_part(name, '/', 3), '_', 1) AS clues
    FROM valid_paths
  )
  SELECT capacitacion, count(DISTINCT clues) AS unidades_count
  FROM parsed
  WHERE capacitacion IS NOT NULL AND capacitacion <> ''
  GROUP BY capacitacion;
$function$;
