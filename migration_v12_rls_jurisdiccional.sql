-- ======================================================================================
-- JS1 REPORTES — MIGRACIÓN V12 (CORRECCIÓN DE PERMISOS LIVE VIEW PARA JURISDICCIONAL)
-- ======================================================================================

-- 1. Habilitar lectura para JURISDICCIONAL en tabla biologicos_existencia
DROP POLICY IF EXISTS "Select Biologicos Existencia Jurisdiccional" ON public.biologicos_existencia;
CREATE POLICY "Select Biologicos Existencia Jurisdiccional" ON public.biologicos_existencia
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'JURISDICCIONAL'));

-- 2. Habilitar lectura para JURISDICCIONAL en tabla existencia_detalle
ALTER TABLE public.existencia_detalle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select Existencia Detalle Jurisdiccional" ON public.existencia_detalle;
CREATE POLICY "Select Existencia Detalle Jurisdiccional" ON public.existencia_detalle
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'JURISDICCIONAL'));

-- 3. Habilitar lectura para JURISDICCIONAL en tabla biologicos_pedido
ALTER TABLE public.biologicos_pedido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select Biologicos Pedido Jurisdiccional" ON public.biologicos_pedido;
CREATE POLICY "Select Biologicos Pedido Jurisdiccional" ON public.biologicos_pedido
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'JURISDICCIONAL'));

-- 4. Habilitar lectura para JURISDICCIONAL en tabla consumibles
ALTER TABLE public.consumibles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select Consumibles Jurisdiccional" ON public.consumibles;
CREATE POLICY "Select Consumibles Jurisdiccional" ON public.consumibles
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'JURISDICCIONAL'));

-- 5. Asegurar lectura del calendario para JURISDICCIONAL
ALTER TABLE public.calendario_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select Calendario Pedidos Jurisdiccional" ON public.calendario_pedidos;
CREATE POLICY "Select Calendario Pedidos Jurisdiccional" ON public.calendario_pedidos
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND UPPER(rol) = 'JURISDICCIONAL'));
