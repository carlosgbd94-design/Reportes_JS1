-- ==========================================================
-- MIGRACIÓN v10b: Recalcular tiene_ceros DINÁMICAMENTE
-- 
-- Problema: tiene_ceros se almacenaba en biologicos_existencia
-- pero muchos registros tienen el flag incorrecto porque:
-- 1) Registros antiguos se guardaron con lógica que revisaba
--    biológicos individuales (lotes) en vez de totales.
-- 2) La lista BIOS_SIEMPRE_ACTIVOS incluye vacunas que no
--    todas las unidades manejan (e.g. VSR, TDPA), marcando
--    falsos positivos cuando esas columnas están en 0.
--
-- Solución: Recalcular tiene_ceros DINÁMICAMENTE usando
-- existencia_detalle. Un biológico tiene cero stock solo si
-- la SUMA de cantidad de TODOS sus lotes es 0.
-- Solo se evalúan biológicos que la unidad realmente capturó.
--
-- Aplicar en: Supabase SQL Editor (Dashboard > SQL Editor)
-- Fecha: 2026-06-04
-- ==========================================================

-- 1. Actualizar RPC para recalcular tiene_ceros dinámicamente
CREATE OR REPLACE FUNCTION public.get_captures_sr_range_bypass(p_fecha_inicio DATE, p_fecha_fin DATE) 
RETURNS TABLE (
    clues VARCHAR,
    fecha DATE,
    capturado_por VARCHAR,
    tiene_ceros BOOLEAN
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        b.clues::VARCHAR AS clues, 
        b.fecha, 
        b.capturado_por::VARCHAR AS capturado_por,
        -- Recalcular dinámicamente: ¿algún biológico capturado tiene total = 0?
        COALESCE(
          (SELECT bool_or(bio_total = 0)
           FROM (
             SELECT d.biologico, SUM(d.cantidad) AS bio_total
             FROM public.existencia_detalle d
             WHERE d.clues = b.clues AND d.fecha = b.fecha
             GROUP BY d.biologico
           ) bio_sums
          ),
          false
        ) AS tiene_ceros
    FROM public.biologicos_existencia b
    WHERE b.fecha >= p_fecha_inicio AND b.fecha <= p_fecha_fin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. (Opcional) Actualizar también los registros almacenados para consistencia
-- Esto corrige el flag persistido para queries directas que no usen la RPC.
UPDATE public.biologicos_existencia be
SET tiene_ceros = COALESCE(
  (SELECT bool_or(bio_total = 0)
   FROM (
     SELECT d.biologico, SUM(d.cantidad) AS bio_total
     FROM public.existencia_detalle d
     WHERE d.clues = be.clues AND d.fecha = be.fecha
     GROUP BY d.biologico
   ) bio_sums
  ),
  false
);
