-- ======================================================================================
-- JS1 REPORTES — REFACTORIZACIÓN MIGRACIÓN V11 (RLS & RPC HISTORIAL)
-- ======================================================================================

-- 1. Modificar función de verificación administrativa is_admin() para que sea exclusiva del rol ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() AND rol = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Habilitar RLS en la tabla unidades y aplicar políticas seguras
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Unidades select policy" ON public.unidades;
CREATE POLICY "Unidades select policy" ON public.unidades
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Unidades admin all policy" ON public.unidades;
CREATE POLICY "Unidades admin all policy" ON public.unidades
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- 3. Configurar RLS en biologicos_existencia
ALTER TABLE public.biologicos_existencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Existencia select RLS" ON public.biologicos_existencia;
CREATE POLICY "Existencia select RLS" ON public.biologicos_existencia
    FOR SELECT
    USING (
        public.is_admin() OR
        (EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = auth.uid() AND (
                (p.rol = 'MUNICIPAL' AND (
                    biologicos_existencia.municipio = p.municipio OR
                    biologicos_existencia.municipio = ANY(p.municipios_allowed) OR
                    biologicos_existencia.municipio = ANY(string_to_array(p.municipio, ','))
                )) OR
                (p.rol = 'UNIDAD' AND biologicos_existencia.clues = p.clues)
            )
        ))
    );

DROP POLICY IF EXISTS "Existencia write RLS" ON public.biologicos_existencia;
CREATE POLICY "Existencia write RLS" ON public.biologicos_existencia
    FOR ALL
    USING (
        public.is_admin() OR
        (EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = auth.uid() AND p.rol = 'UNIDAD' AND biologicos_existencia.clues = p.clues
        ))
    )
    WITH CHECK (
        public.is_admin() OR
        (EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = auth.uid() AND p.rol = 'UNIDAD' AND biologicos_existencia.clues = p.clues
        ))
    );


-- 4. Crear la función RPC get_history_metrics_rpc para cálculo de cumplimiento y tiers administrativo
CREATE OR REPLACE FUNCTION public.get_history_metrics_rpc(p_mes VARCHAR)
RETURNS TABLE (
    clues VARCHAR,
    municipio VARCHAR,
    unidad VARCHAR,
    bio_semanas_ok INT,
    cons_semanas_ok INT,
    pedido_mensual BOOLEAN,
    ultima_captura VARCHAR,
    score INT,
    tier VARCHAR,
    ebio INT,
    econs INT,
    ispedidorequired BOOLEAN
) AS $$
DECLARE
    v_year INT;
    v_month INT;
    v_fecha_inicio DATE;
    v_fecha_fin DATE;
    v_today DATE;
    v_is_current_month BOOLEAN;
    v_total_month_cons INT := 0;
    v_total_month_bio INT := 0;
    v_curr_date DATE;
    v_dow INT;
    v_mid_month DATE;
    v_is_pedido_required BOOLEAN;
BEGIN
    v_today := CURRENT_DATE;
    
    v_year := CAST(SPLIT_PART(p_mes, '-', 1) AS INT);
    v_month := CAST(SPLIT_PART(p_mes, '-', 2) AS INT);
    
    v_fecha_inicio := CAST(p_mes || '-01' AS DATE);
    
    v_is_current_month := (TO_CHAR(v_today, 'YYYY-MM') = p_mes);
    
    IF v_is_current_month THEN
        -- Avanzar la fecha fin hasta el domingo de la semana en curso (pero sin pasarse del fin de mes)
        -- para que se incluya el viernes/jueves de esta semana aunque hoy sea jueves.
        v_fecha_fin := LEAST(
            (v_today + (7 - EXTRACT(DOW FROM v_today)::INT) % 7)::DATE,
            (v_fecha_inicio + INTERVAL '1 month - 1 day')::DATE
        );
    ELSE
        v_fecha_fin := (v_fecha_inicio + INTERVAL '1 month - 1 day')::DATE;
    END IF;

    -- Calcular semanas esperadas en el mes (jueves para consumibles, viernes para biológicos)
    v_curr_date := v_fecha_inicio;
    WHILE v_curr_date <= v_fecha_fin LOOP
        v_dow := EXTRACT(DOW FROM v_curr_date);
        IF v_dow = 4 THEN
            v_total_month_cons := v_total_month_cons + 1;
        ELSIF v_dow = 5 THEN
            v_total_month_bio := v_total_month_bio + 1;
        END IF;
        v_curr_date := v_curr_date + 1;
    END LOOP;
    
    IF v_total_month_cons = 0 THEN v_total_month_cons := 1; END IF;
    IF v_total_month_bio = 0 THEN v_total_month_bio := 1; END IF;

    v_mid_month := CAST(p_mes || '-15' AS DATE);
    IF NOT v_is_current_month OR v_today >= v_mid_month THEN
        v_is_pedido_required := true;
    ELSE
        v_is_pedido_required := false;
    END IF;

    RETURN QUERY
    WITH active_units AS (
        SELECT u.clues::VARCHAR AS clues_u, u.municipio::VARCHAR AS municipio_u, u.unidad::VARCHAR AS unidad_u
        FROM public.unidades u
        WHERE u.activo = 'SI'
    ),
    bio_counts AS (
        SELECT b.clues::VARCHAR AS clues_b, COUNT(DISTINCT target_friday) AS bio_ok
        FROM (
            SELECT g.dt::DATE AS target_friday, (g.dt - INTERVAL '1 day')::DATE AS target_thursday
            FROM generate_series(v_fecha_inicio::timestamp, v_fecha_fin::timestamp, '1 day'::interval) g(dt)
            WHERE EXTRACT(DOW FROM g.dt) = 5
        ) f
        JOIN public.biologicos_existencia b ON (b.fecha = f.target_friday OR b.fecha = f.target_thursday)
        GROUP BY b.clues
    ),
    cons_counts AS (
        SELECT c.clues::VARCHAR AS clues_c, COUNT(DISTINCT target_thursday) AS cons_ok
        FROM (
            SELECT g.dt::DATE AS target_thursday, (g.dt - INTERVAL '1 day')::DATE AS target_wednesday
            FROM generate_series(v_fecha_inicio::timestamp, v_fecha_fin::timestamp, '1 day'::interval) g(dt)
            WHERE EXTRACT(DOW FROM g.dt) = 4
        ) t
        JOIN public.consumibles c ON (c.fecha = t.target_thursday OR c.fecha = t.target_wednesday)
        GROUP BY c.clues
    ),
    pedido_counts AS (
        SELECT DISTINCT p.clues::VARCHAR AS clues_p
        FROM public.biologicos_pedido p
        WHERE p.fecha_captura >= v_fecha_inicio AND p.fecha_captura <= v_fecha_fin AND p.tipo_pedido = 'MENSUAL'
    ),
    last_captures AS (
        SELECT clues_lc, MAX(max_fecha)::VARCHAR AS ult_fecha
        FROM (
            SELECT b.clues::VARCHAR AS clues_lc, MAX(b.fecha) AS max_fecha
            FROM public.biologicos_existencia b
            WHERE b.fecha >= v_fecha_inicio AND b.fecha <= v_fecha_fin
            GROUP BY b.clues
            UNION ALL
            SELECT c.clues::VARCHAR AS clues_lc, MAX(c.fecha) AS max_fecha
            FROM public.consumibles c
            WHERE c.fecha >= v_fecha_inicio AND c.fecha <= v_fecha_fin
            GROUP BY c.clues
        ) combo
        GROUP BY clues_lc
    )
    SELECT 
        au.clues_u AS clues,
        au.municipio_u AS municipio,
        au.unidad_u AS unidad,
        COALESCE(bc.bio_ok, 0)::INT AS bio_semanas_ok,
        COALESCE(cc.cons_ok, 0)::INT AS cons_semanas_ok,
        (pc.clues_p IS NOT NULL) AS pedido_mensual,
        COALESCE(lc.ult_fecha, '—')::VARCHAR AS ultima_captura,
        -- Score
        CAST(
            ROUND(
                CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END
            ) AS INT
        ) AS score,
        -- Tier
        (
            CASE 
                WHEN ROUND(CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END) >= 100 THEN 'diamante'
                WHEN ROUND(CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END) >= 90 THEN 'oro'
                WHEN ROUND(CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END) >= 80 THEN 'plata'
                WHEN ROUND(CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END) >= 70 THEN 'bronce'
                WHEN ROUND(CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END) >= 60 THEN 'acero'
                WHEN ROUND(CASE WHEN v_is_pedido_required THEN
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.4) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.4) +
                    (CASE WHEN pc.clues_p IS NOT NULL THEN 100 ELSE 0 END * 0.2)
                ELSE
                    (COALESCE(bc.bio_ok, 0)::NUMERIC / v_total_month_bio * 100 * 0.5) +
                    (COALESCE(cc.cons_ok, 0)::NUMERIC / v_total_month_cons * 100 * 0.5)
                END) >= 50 THEN 'jade'
                ELSE 'riesgo'
            END
        )::VARCHAR AS tier,
        v_total_month_bio::INT AS ebio,
        v_total_month_cons::INT AS econs,
        v_is_pedido_required::BOOLEAN AS ispedidorequired
    FROM active_units au
    LEFT JOIN bio_counts bc ON bc.clues_b = au.clues_u
    LEFT JOIN cons_counts cc ON cc.clues_c = au.clues_u
    LEFT JOIN pedido_counts pc ON pc.clues_p = au.clues_u
    LEFT JOIN last_captures lc ON lc.clues_lc = au.clues_u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
