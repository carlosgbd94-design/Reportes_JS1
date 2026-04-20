-- ==========================================================
-- SQL MIGRATION: LEGACY USUARIOS -> SUPABASE AUTH + PERFILES
-- ==========================================================

-- 1. RESPALDO DE SEGURIDAD
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usuarios') THEN
        ALTER TABLE public.usuarios RENAME TO usuarios_legacy;
    END IF;
END $$;

-- 2. CREACIÓN DE TABLA DE PERFILES (VINCULADA A AUTH)
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    usuario TEXT,          -- ID corto legacy (ej: ana.maria)
    email TEXT,
    municipio TEXT,
    clues TEXT,
    unidad TEXT,
    rol TEXT DEFAULT 'UNIDAD',
    activo TEXT DEFAULT 'SI',
    must_change BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HABILITAR SEGURIDAD RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACCESO
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.perfiles;
CREATE POLICY "Los usuarios pueden ver su propio perfil"
ON public.perfiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Los admins pueden ver todos los perfiles" ON public.perfiles;
CREATE POLICY "Los admins pueden ver todos los perfiles"
ON public.perfiles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE id = auth.uid() AND rol = 'ADMIN'
    )
);

-- 5. FUNCIÓN DE SINCRONIZACIÓN INTELIGENTE (TRIGGER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    legacy_data RECORD;
BEGIN
    -- Intentamos buscar datos operativos en el backup legacy por email
    SELECT * INTO legacy_data FROM public.usuarios_legacy 
    WHERE LOWER(email) = LOWER(NEW.email) OR LOWER(usuario) = LOWER(NEW.email)
    LIMIT 1;

    -- Insertamos el perfil vinculándolo al nuevo UUID de Auth
    INSERT INTO public.perfiles (
        id, 
        usuario, 
        email, 
        municipio, 
        clues, 
        unidad, 
        rol, 
        activo
    )
    VALUES (
        NEW.id,
        COALESCE(legacy_data.usuario, SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(legacy_data.municipio, 'SIN ASIGNAR'),
        COALESCE(legacy_data.clues, 'SIN CLUES'),
        COALESCE(legacy_data.unidad, 'UNIDAD NUEVA'),
        COALESCE(legacy_data.rol, 'UNIDAD'),
        COALESCE(legacy_data.activo, 'SI')
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREACIÓN DEL TRIGGER EN AUTH.USERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. NOTA OPERATIVA:
-- A partir de este momento, cualquier usuario que registres en Dashbaord > Auth
-- automáticamente tomará sus CLUES, Municipio y Rol de la tabla vieja.
