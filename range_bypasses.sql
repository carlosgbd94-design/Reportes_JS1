-- ======================================================================================
-- MIGRACIÓN PARA RESÚMENES POR RANGO DE FECHAS (BYPASS RLS)
-- ======================================================================================

-- 1. Existencias (SR) por rango (incluye tiene_ceros para semaforización del panel)
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


-- 2. Consumibles (CONS) por rango
CREATE OR REPLACE FUNCTION public.get_captures_cons_range_bypass(p_fecha_inicio DATE, p_fecha_fin DATE) 
RETURNS TABLE (
    clues VARCHAR,
    fecha DATE,
    capturado_por VARCHAR
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        c.clues, 
        c.fecha, 
        c.usuario AS capturado_por
    FROM public.consumibles c
    WHERE c.fecha >= p_fecha_inicio AND c.fecha <= p_fecha_fin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Pedidos (BIO) por rango
CREATE OR REPLACE FUNCTION public.get_captures_bio_range_bypass(p_fecha_inicio DATE, p_fecha_fin DATE) 
RETURNS TABLE (
    clues VARCHAR,
    fecha DATE,
    capturado_por VARCHAR,
    tipo_pedido VARCHAR
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        p.clues, 
        p.fecha, 
        p.usuario AS capturado_por,
        p.tipo_pedido
    FROM public.biologicos_pedido p
    WHERE p.fecha >= p_fecha_inicio AND p.fecha <= p_fecha_fin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
