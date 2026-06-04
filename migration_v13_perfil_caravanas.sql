-- ======================================================================================
-- JS1 REPORTES — MIGRACIÓN V13 (CREACIÓN DE PERFIL Y RLS PARA CARAVANAS)
-- ======================================================================================

BEGIN;

-- 1. Modificar el check constraint en public.perfiles para admitir 'CARAVANAS'
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'CARAVANAS'));

-- 2. Modificar el check constraint en public.usuarios_legacy si existe
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usuarios_legacy') THEN
        ALTER TABLE public.usuarios_legacy DROP CONSTRAINT IF EXISTS usuarios_legacy_rol_check;
        ALTER TABLE public.usuarios_legacy ADD CONSTRAINT usuarios_legacy_rol_check CHECK (rol IN ('UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'ADMIN', 'CARAVANAS'));
    END IF;
END $$;

-- 3. Políticas RLS para lectura en public.biologicos_existencia
DROP POLICY IF EXISTS "Select Biologicos Existencia Caravanas" ON public.biologicos_existencia;
CREATE POLICY "Select Biologicos Existencia Caravanas" ON public.biologicos_existencia
    FOR SELECT
    USING (
        public.get_user_role() = 'CARAVANAS'
        AND EXISTS (
            SELECT 1 FROM public.unidades u
            WHERE u.clues = biologicos_existencia.clues
            AND (u.unidad LIKE 'FAM%' OR u.unidad LIKE 'UMME%')
        )
    );

-- 4. Políticas RLS para lectura en public.consumibles
DROP POLICY IF EXISTS "Select Consumibles Caravanas" ON public.consumibles;
CREATE POLICY "Select Consumibles Caravanas" ON public.consumibles
    FOR SELECT
    USING (
        public.get_user_role() = 'CARAVANAS'
        AND EXISTS (
            SELECT 1 FROM public.unidades u
            WHERE u.clues = consumibles.clues
            AND (u.unidad LIKE 'FAM%' OR u.unidad LIKE 'UMME%')
        )
    );

-- 5. Políticas RLS para lectura en public.biologicos_pedido
DROP POLICY IF EXISTS "Select Biologicos Pedido Caravanas" ON public.biologicos_pedido;
CREATE POLICY "Select Biologicos Pedido Caravanas" ON public.biologicos_pedido
    FOR SELECT
    USING (
        public.get_user_role() = 'CARAVANAS'
        AND EXISTS (
            SELECT 1 FROM public.unidades u
            WHERE u.clues = biologicos_pedido.clues
            AND (u.unidad LIKE 'FAM%' OR u.unidad LIKE 'UMME%')
        )
    );

-- 6. Políticas RLS para lectura en public.existencia_detalle
DROP POLICY IF EXISTS "Select Existencia Detalle Caravanas" ON public.existencia_detalle;
CREATE POLICY "Select Existencia Detalle Caravanas" ON public.existencia_detalle
    FOR SELECT
    USING (
        public.get_user_role() = 'CARAVANAS'
        AND EXISTS (
            SELECT 1 FROM public.unidades u
            WHERE u.clues = existencia_detalle.clues
            AND (u.unidad LIKE 'FAM%' OR u.unidad LIKE 'UMME%')
        )
    );

-- 7. Lectura de public.calendario_pedidos para CARAVANAS
DROP POLICY IF EXISTS "Select Calendario Pedidos Caravanas" ON public.calendario_pedidos;
CREATE POLICY "Select Calendario Pedidos Caravanas" ON public.calendario_pedidos
    FOR SELECT
    USING (public.get_user_role() = 'CARAVANAS');

COMMIT;
