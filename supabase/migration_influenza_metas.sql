-- SIREVAQ 2026
-- MIGRACIÓN PARA EL SISTEMA DE META-LOGRO DE INFLUENZA

-- 1. Tabla de Metas de Influenza
CREATE TABLE IF NOT EXISTS public.influenza_metas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio_campana TEXT NOT NULL, -- Ej: "2025-2026"
    municipio TEXT NOT NULL,
    clues TEXT, -- Si es nulo, representa la meta total del Municipio (cargada por Admin/Jurisdiccional)
    metas JSONB NOT NULL, -- Mapeo {"r1": 120, "r2": 0, ..., "r46": 500}
    modificado_por TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en metas
ALTER TABLE public.influenza_metas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para metas
CREATE POLICY "Permitir lectura de metas a todos los usuarios autenticados"
ON public.influenza_metas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir escritura de metas a administradores, jurisdiccionales y municipales"
ON public.influenza_metas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- 2. Tabla de Capturas Semanales de Influenza
CREATE TABLE IF NOT EXISTS public.influenza_capturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clues TEXT NOT NULL,
    unidad TEXT NOT NULL,
    municipio TEXT NOT NULL,
    fecha DATE NOT NULL, -- Viernes de la semana epidemiológica capturada
    anio_campana TEXT NOT NULL,
    valores JSONB NOT NULL, -- Mapeo {"r1": 10, "r2": 0, ..., "r46": 15}
    capturado_por TEXT NOT NULL,
    editado_por TEXT NOT NULL DEFAULT 'UNIDAD', -- 'UNIDAD' o 'MUNICIPAL'
    historial_ediciones JSONB DEFAULT '[]'::jsonb, -- Registro histórico de ediciones
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indice único para evitar duplicidad de captura por semana y CLUES
CREATE UNIQUE INDEX IF NOT EXISTS idx_influenza_capturas_clues_fecha ON public.influenza_capturas(clues, fecha);

-- Habilitar RLS en capturas
ALTER TABLE public.influenza_capturas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para capturas
CREATE POLICY "Permitir lectura de capturas a usuarios autenticados"
ON public.influenza_capturas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insertar/modificar capturas"
ON public.influenza_capturas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- 3. Tabla de Distribución de Frascos (Control Municipal)
CREATE TABLE IF NOT EXISTS public.influenza_distribucion_frascos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio TEXT NOT NULL,
    clues TEXT NOT NULL,
    cantidad_frascos INTEGER NOT NULL CHECK (cantidad_frascos >= 0),
    fecha_entrega DATE NOT NULL,
    numero_entrega INTEGER NOT NULL, -- 1, 2, 3, etc.
    entregado_por TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en distribución de frascos
ALTER TABLE public.influenza_distribucion_frascos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para distribución de frascos
CREATE POLICY "Permitir lectura de frascos a usuarios autenticados"
ON public.influenza_distribucion_frascos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir escritura de frascos a usuarios autenticados"
ON public.influenza_distribucion_frascos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
