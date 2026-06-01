-- ==========================================================
-- MIGRACIÓN v10: Columna tiene_ceros en biologicos_existencia
-- 
-- Propósito: Permite rastrear si una unidad capturó existencias
--            pero alguno de sus biológicos del esquema básico
--            quedó en cero. Usado por el panel de Resumen de
--            Captura para mostrar el tercer estado visual (ámbar).
--
-- Aplicar en: Supabase SQL Editor (Dashboard > SQL Editor)
-- Fecha: 2026-06-01
-- ==========================================================

ALTER TABLE public.biologicos_existencia
ADD COLUMN IF NOT EXISTS tiene_ceros boolean DEFAULT false;

-- Índice para acelerar consultas de resumen (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_biologicos_existencia_tiene_ceros
ON public.biologicos_existencia (clues, fecha, tiene_ceros);

-- Comentario descriptivo
COMMENT ON COLUMN public.biologicos_existencia.tiene_ceros IS
'true si al momento de capturar algún biológico del esquema básico quedó en cero. Usado para semaforización del panel de resumen (tercer estado ámbar).';

-- ==========================================================
-- ACTUALIZAR RPC get_captures_sr_range_bypass
-- (Agregar columna tiene_ceros al resultado de la función)
-- ==========================================================

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
        b.clues, 
        b.fecha, 
        b.usuario AS capturado_por,
        COALESCE(b.tiene_ceros, false) AS tiene_ceros
    FROM public.biologicos_existencia b
    WHERE b.fecha >= p_fecha_inicio AND b.fecha <= p_fecha_fin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

