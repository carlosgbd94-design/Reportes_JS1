-- ==========================================================
-- SQL MIGRATION: CLUES UPDATE FOR 'TLACOTE EL BAJO'
-- FROM: QTSSA002020 -> TO: QTSSA013034
-- ==========================================================

BEGIN;

-- 1. UNIDADES (Tabla Maestra)
UPDATE public.unidades 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 2. PERFILES (Usuarios)
UPDATE public.perfiles 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 3. BIOLOGICOS_EXISTENCIA (Histórico)
UPDATE public.biologicos_existencia 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 4. CONSUMIBLES (Histórico)
UPDATE public.consumibles 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 5. BIOLOGICOS_PARAMS (Configuración)
UPDATE public.biologicos_params 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 6. BIOLOGICOS_PEDIDO (Histórico de pedidos)
UPDATE public.biologicos_pedido 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 7. PINOL_SOLICITUDES
UPDATE public.pinol_solicitudes 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 8. NOTIFICACIONES
UPDATE public.notificaciones 
SET target_clues = 'QTSSA013034' 
WHERE target_clues = 'QTSSA002020';

-- 9. EXISTENCIA_DETALLE (Detalle por lotes)
UPDATE public.existencia_detalle 
SET clues = 'QTSSA013034' 
WHERE clues = 'QTSSA002020';

-- 10. USUARIOS (Legacy backup if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usuarios_legacy') THEN
        UPDATE public.usuarios_legacy SET clues = 'QTSSA013034' WHERE clues = 'QTSSA002020';
    END IF;
END $$;

COMMIT;

-- NOTA: Ejecuta este script en el SQL Editor de Supabase para aplicar los cambios en la base de datos.
