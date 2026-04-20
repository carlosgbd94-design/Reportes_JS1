-- ==========================================================
-- SQL MIGRATION V7: RBAC + RLS PARA TABLAS DE DATOS
-- ==========================================================
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL > New Query)

-- ═══════════════════════════════════════════════
-- 1. AGREGAR municipios_allowed A PERFILES
-- ═══════════════════════════════════════════════
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS municipios_allowed TEXT[] DEFAULT '{}';

-- Migrar datos: Derivar municipios_allowed del rol + municipio
UPDATE public.perfiles
SET municipios_allowed = CASE 
    WHEN UPPER(rol) IN ('ADMIN', 'JURISDICCIONAL') THEN ARRAY['*']
    WHEN UPPER(rol) = 'MUNICIPAL' AND municipio IS NOT NULL AND municipio != '' THEN ARRAY[municipio]
    ELSE ARRAY[]::TEXT[]
END
WHERE municipios_allowed IS NULL OR municipios_allowed = '{}';

-- ═══════════════════════════════════════════════
-- 2. RLS PARA biologicos_existencia
-- ═══════════════════════════════════════════════
ALTER TABLE public.biologicos_existencia ENABLE ROW LEVEL SECURITY;

-- SELECT: Cada rol ve lo que le corresponde
DROP POLICY IF EXISTS "bio_select_by_role" ON public.biologicos_existencia;
CREATE POLICY "bio_select_by_role"
ON public.biologicos_existencia FOR SELECT
USING (
    -- ADMIN y JURISDICCIONAL ven todo
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE id = auth.uid() AND UPPER(rol) IN ('ADMIN', 'JURISDICCIONAL')
    )
    OR
    -- MUNICIPAL ve solo su municipio
    (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE id = auth.uid() AND UPPER(rol) = 'MUNICIPAL'
        )
        AND municipio = (SELECT municipio FROM public.perfiles WHERE id = auth.uid())
    )
    OR
    -- UNIDAD ve solo su CLUES
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

-- INSERT: Solo UNIDAD puede insertar, y solo para su CLUES
DROP POLICY IF EXISTS "bio_insert_own_clues" ON public.biologicos_existencia;
CREATE POLICY "bio_insert_own_clues"
ON public.biologicos_existencia FOR INSERT
WITH CHECK (
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

-- UPDATE: Solo UNIDAD puede actualizar su propio reporte
DROP POLICY IF EXISTS "bio_update_own_clues" ON public.biologicos_existencia;
CREATE POLICY "bio_update_own_clues"
ON public.biologicos_existencia FOR UPDATE
USING (
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

-- ═══════════════════════════════════════════════
-- 3. RLS PARA consumibles
-- ═══════════════════════════════════════════════
ALTER TABLE public.consumibles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cons_select_by_role" ON public.consumibles;
CREATE POLICY "cons_select_by_role"
ON public.consumibles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE id = auth.uid() AND UPPER(rol) IN ('ADMIN', 'JURISDICCIONAL')
    )
    OR
    (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE id = auth.uid() AND UPPER(rol) = 'MUNICIPAL'
        )
        AND municipio = (SELECT municipio FROM public.perfiles WHERE id = auth.uid())
    )
    OR
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "cons_insert_own_clues" ON public.consumibles;
CREATE POLICY "cons_insert_own_clues"
ON public.consumibles FOR INSERT
WITH CHECK (
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "cons_update_own_clues" ON public.consumibles;
CREATE POLICY "cons_update_own_clues"
ON public.consumibles FOR UPDATE
USING (
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

-- ═══════════════════════════════════════════════
-- 4. RLS PARA biologicos_pedido
-- ═══════════════════════════════════════════════
ALTER TABLE public.biologicos_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_select_by_role" ON public.biologicos_pedido;
CREATE POLICY "pedido_select_by_role"
ON public.biologicos_pedido FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE id = auth.uid() AND UPPER(rol) IN ('ADMIN', 'JURISDICCIONAL')
    )
    OR
    (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE id = auth.uid() AND UPPER(rol) = 'MUNICIPAL'
        )
        AND municipio = (SELECT municipio FROM public.perfiles WHERE id = auth.uid())
    )
    OR
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "pedido_insert_own_clues" ON public.biologicos_pedido;
CREATE POLICY "pedido_insert_own_clues"
ON public.biologicos_pedido FOR INSERT
WITH CHECK (
    clues = (SELECT clues FROM public.perfiles WHERE id = auth.uid())
);

-- ═══════════════════════════════════════════════
-- 5. FUNCIÓN HELPER: Obtener rol del usuario actual
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
    SELECT UPPER(COALESCE(rol, 'UNIDAD'))
    FROM public.perfiles 
    WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════
-- 6. VERIFICACIÓN
-- ═══════════════════════════════════════════════
-- Ejecutar esto para verificar que las políticas se crearon correctamente:
-- SELECT schemaname, tablename, policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public';
