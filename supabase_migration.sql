-- ======================================================================================
-- RDA 2026 - MIGRACIÓN DE SUPABASE (BASE DE DATOS Y RLS ESTRICTOS)
-- ======================================================================================

-- 1. TABLA PERFILES (Asegurar que existan las columnas necesarias)
-- Si la tabla no existe, se crea. Si existe, se añaden las columnas faltantes.
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255),
    rol VARCHAR(50) CHECK (rol IN ('UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'ADMIN')),
    clues_asignado VARCHAR(50),
    municipio_asignado VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forzar la adición de columnas si la tabla ya existía sin ellas
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS rol VARCHAR(50) CHECK (rol IN ('UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'ADMIN'));
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS clues_asignado VARCHAR(50);
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS municipio_asignado VARCHAR(150);


-- 2. TABLA UNIDADES MEDICAS
CREATE TABLE IF NOT EXISTS public.unidades_medicas (
    clues VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    municipio VARCHAR(150) NOT NULL,
    pob_menor_1 INT DEFAULT 0,
    pob_1_ano INT DEFAULT 0,
    pob_4_anos INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA REGISTROS SIS
CREATE TABLE IF NOT EXISTS public.registros_sis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clues VARCHAR(50) REFERENCES public.unidades_medicas(clues) ON DELETE CASCADE,
    variable_sis VARCHAR(50) NOT NULL,
    valor INT NOT NULL DEFAULT 0,
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.unidades_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_sis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- ======================================================================================
-- POLÍTICAS RLS (ESTRICTAS SEGÚN REQUERIMIENTO)
-- ======================================================================================

-- Función auxiliar para obtener el rol del usuario autenticado (muy útil para optimizar)
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS VARCHAR AS $$
    SELECT UPPER(rol) FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_clues() RETURNS VARCHAR AS $$
    SELECT clues_asignado FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_municipio() RETURNS VARCHAR AS $$
    SELECT municipio_asignado FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;


-- --------------------------------------------------------------------------------------
-- POLÍTICAS PARA: unidades_medicas
-- --------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin All Unidades" ON public.unidades_medicas;
CREATE POLICY "Admin All Unidades" ON public.unidades_medicas
    FOR ALL
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) IN ('JURISDICCIONAL', 'ADMIN')) )
    WITH CHECK ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) IN ('JURISDICCIONAL', 'ADMIN')) );

DROP POLICY IF EXISTS "Select Unidades Jurisdiccional" ON public.unidades_medicas;
CREATE POLICY "Select Unidades Jurisdiccional" ON public.unidades_medicas
    FOR SELECT
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) IN ('JURISDICCIONAL', 'ADMIN')) );

DROP POLICY IF EXISTS "Select Unidades Municipal" ON public.unidades_medicas;
CREATE POLICY "Select Unidades Municipal" ON public.unidades_medicas
    FOR SELECT
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'MUNICIPAL' AND municipio = municipio_asignado) );

DROP POLICY IF EXISTS "Select Unidades Unidad" ON public.unidades_medicas;
CREATE POLICY "Select Unidades Unidad" ON public.unidades_medicas
    FOR SELECT
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'UNIDAD' AND clues = clues_asignado) );


-- --------------------------------------------------------------------------------------
-- POLÍTICAS PARA: registros_sis
-- --------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin All Registros SIS" ON public.registros_sis;
CREATE POLICY "Admin All Registros SIS" ON public.registros_sis
    FOR ALL
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) IN ('JURISDICCIONAL', 'ADMIN')) )
    WITH CHECK ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) IN ('JURISDICCIONAL', 'ADMIN')) );

DROP POLICY IF EXISTS "Select Registros Jurisdiccional" ON public.registros_sis;
CREATE POLICY "Select Registros Jurisdiccional" ON public.registros_sis
    FOR SELECT
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) IN ('JURISDICCIONAL', 'ADMIN')) );

DROP POLICY IF EXISTS "Select Registros Municipal" ON public.registros_sis;
CREATE POLICY "Select Registros Municipal" ON public.registros_sis
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles p
            JOIN public.unidades_medicas u ON u.municipio = p.municipio_asignado
            WHERE p.id = auth.uid() AND UPPER(p.rol) = 'MUNICIPAL' AND registros_sis.clues = u.clues
        )
    );

DROP POLICY IF EXISTS "Select Registros Unidad" ON public.registros_sis;
CREATE POLICY "Select Registros Unidad" ON public.registros_sis
    FOR SELECT
    USING ( EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'UNIDAD' AND clues = clues_asignado) );

-- Fin de migración
