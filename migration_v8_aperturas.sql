-- ==========================================================
-- SQL MIGRATION V8: TABLA DE APERTURAS EXTRAORDINARIAS
-- ==========================================================
-- Esta tabla permite que el administrador habilite días de captura 
-- fuera de los jueves estándar por motivos especiales.

CREATE TABLE IF NOT EXISTS public.aperturas_consumibles (
    fecha DATE PRIMARY KEY,
    motivo TEXT,
    activo TEXT DEFAULT 'SI',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ═══════════════════════════════════════════════
-- SEGURIDAD (RLS)
-- ═══════════════════════════════════════════════
ALTER TABLE public.aperturas_consumibles ENABLE ROW LEVEL SECURITY;

-- 1. Lectura por todos los usuarios autenticados
DROP POLICY IF EXISTS "aperturas_cons_select" ON public.aperturas_consumibles;
CREATE POLICY "aperturas_cons_select"
ON public.aperturas_consumibles FOR SELECT
USING (auth.role() = 'authenticated');

-- 2. Control total solo para Administradores
DROP POLICY IF EXISTS "aperturas_cons_admin" ON public.aperturas_consumibles;
CREATE POLICY "aperturas_cons_admin"
ON public.aperturas_consumibles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE id = auth.uid() AND UPPER(rol) = 'ADMIN'
    )
);

-- Comentario para el dashboard de Supabase
COMMENT ON TABLE public.aperturas_consumibles IS 'Registro de aperturas manuales extraordinarias para consumibles';
