-- 🛡️ Script de base de datos para habilitar tablas de configuración y aperturas de BCG
CREATE TABLE IF NOT EXISTS public.unidades_bcg_config (
    clues TEXT PRIMARY KEY REFERENCES public.unidades(clues) ON DELETE CASCADE,
    turnos_permitidos TEXT[] DEFAULT ARRAY['MATUTINO']::TEXT[],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.unidades_bcg_apertura (
    clues TEXT PRIMARY KEY REFERENCES public.unidades(clues) ON DELETE CASCADE,
    dia_semana TEXT NOT NULL CHECK (dia_semana IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')),
    turnos TEXT[] NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_by TEXT
);

-- Permisos públicos para lectura y escritura desde anon
ALTER TABLE public.unidades_bcg_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_bcg_apertura ENABLE ROW LEVEL SECURITY;

-- Evitar duplicados de políticas si se re-ejecuta
DROP POLICY IF EXISTS "Permitir lectura para todos" ON public.unidades_bcg_config;
DROP POLICY IF EXISTS "Permitir lectura para todos" ON public.unidades_bcg_apertura;
DROP POLICY IF EXISTS "Permitir escritura para todos" ON public.unidades_bcg_config;
DROP POLICY IF EXISTS "Permitir escritura para todos" ON public.unidades_bcg_apertura;

CREATE POLICY "Permitir lectura para todos" ON public.unidades_bcg_config FOR SELECT USING (true);
CREATE POLICY "Permitir lectura para todos" ON public.unidades_bcg_apertura FOR SELECT USING (true);

CREATE POLICY "Permitir escritura para todos" ON public.unidades_bcg_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir escritura para todos" ON public.unidades_bcg_apertura FOR ALL USING (true) WITH CHECK (true);
