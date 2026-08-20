-- Fix: get_rda_abandono_esquema (panel "Indice de Desercion de Esquema" en Indicadores)
-- rechazaba con RAISE EXCEPTION (-> 400 en el cliente) a los perfiles con rol UNIDAD,
-- que son 71 de los ~75 usuarios del sistema. La lista de roles permitidos se quedo
-- corta frente al resto de RPCs de RDA (get_rda_indicators no restringe por rol y la
-- jerarquia se aplica en el cliente via rda_ui.js/populateFilters), por lo que UNIDAD
-- debe poder consultar este panel igual que los demas esquemas de Indicadores.
CREATE OR REPLACE FUNCTION public.get_rda_abandono_esquema(p_anio integer, p_max_mes integer)
 RETURNS TABLE(clues character varying, nombre character varying, municipio character varying, hexa_1 integer, hexa_2 integer, hexa_3 integer, hexa_ref integer, neumo_1 integer, neumo_2 integer, neumo_ref integer, neumo_c1 integer, neumo_c2 integer, neumo_c3 integer, rota_1 integer, rota_2 integer, srp_1 integer, srp_2 integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_hexa_1 text[]; v_hexa_2 text[]; v_hexa_3 text[]; v_hexa_ref text[];
    v_neumo_1 text[]; v_neumo_2 text[]; v_neumo_ref text[];
    v_neumo_c1 text[]; v_neumo_c2 text[]; v_neumo_c3 text[];
    v_rota_1 text[]; v_rota_2 text[];
    v_srp_1 text[]; v_srp_2 text[];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND upper(rol) IN ('ADMIN','JURISDICCIONAL','VISUALIZADOR_JURISDICCIONAL','MUNICIPAL','CARAVANAS','UNIDAD')
    ) THEN
        RAISE EXCEPTION 'No autorizado para consultar el análisis de continuidad de esquema';
    END IF;

    -- IMPORTANTE (a diferencia de get_rda_indicators): aquí cada llave debe resolver a UNA sola
    -- dosis, no al alias "MOTHER_*" que agrupa TODAS las dosis de ese biológico junto — por eso
    -- NO se agregan 'HEXAVALENTE'/'MOTHER_HEXAVALENTE', 'MOTHER_NEUMO_CONJ', 'MOTHER_ROTAVIRUS'
    -- ni 'SRP'/'MOTHER_SRP' como sí hace get_rda_indicators (ahí es correcto porque construye un
    -- total de cobertura, no un paso individual de un funnel).
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_3 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_3') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_hexa_ref FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('HEXA_REF') AND anio = p_anio) x;

    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_ref FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_REF') AND anio = p_anio) x;

    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_c1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_C1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_c2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_C2') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_neumo_c3 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('NEUMO_C3') AND anio = p_anio) x;

    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_rota_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ROTA_1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_rota_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('ROTA_2') AND anio = p_anio) x;

    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_srp_1 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('SRP_1') AND anio = p_anio) x;
    SELECT COALESCE(array_agg(val), ARRAY[]::text[]) INTO v_srp_2 FROM (SELECT jsonb_array_elements_text(variables) val FROM public.sis_variables_mapeo WHERE UPPER(biologico) IN ('SRP_2') AND anio = p_anio) x;

    RETURN QUERY
    SELECT
        u.clues::VARCHAR,
        u.nombre::VARCHAR,
        u.municipio::VARCHAR,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_1) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_2) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_3) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_hexa_ref) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_1) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_2) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_ref) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_c1) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_c2) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_neumo_c3) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_rota_1) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_rota_2) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_srp_1) THEN r.valor ELSE 0 END), 0)::INT,
        COALESCE(SUM(CASE WHEN r.variable_sis = ANY(v_srp_2) THEN r.valor ELSE 0 END), 0)::INT
    FROM public.unidades_medicas u
    INNER JOIN public.unidades un ON un.clues = u.clues AND un.activo = 'SI'
    LEFT JOIN public.registros_sis r
        ON r.clues = (
            CASE WHEN p_anio = 2025 AND u.clues = 'QTSSA013034' THEN 'QTSSA002020'
                 ELSE u.clues
            END
        )
        AND r.anio = p_anio
        AND r.mes <= p_max_mes
    GROUP BY u.clues, u.nombre, u.municipio;
END;
$function$;
