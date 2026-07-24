-- ======================================================================================
-- FIX CRÍTICO: RLS en notificaciones_perfil
-- SIREVAQ 2026
-- ======================================================================================
-- PROBLEMA RAIZ: Las políticas RLS usan current_setting('request.jwt.claims')::json->>'sub'
-- (ID de Supabase Auth), pero SIREVAQ usa autenticación propia con campo 'usuario' (texto).
-- Por eso el UPDATE/UPSERT no afecta ninguna fila y el status nunca se persiste.
--
-- SOLUCION: Deshabilitar RLS en notificaciones_perfil ya que la app maneja su propia
-- seguridad con lógica en el backend JS (filtra por usuario en todas las queries).
-- ======================================================================================

-- 1. Eliminar todas las políticas existentes de notificaciones_perfil
DROP POLICY IF EXISTS "Users can read their own notifications" ON notificaciones_perfil;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notificaciones_perfil;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notificaciones_perfil;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notificaciones_perfil;

-- 2. DESHABILITAR RLS — la app filtra por usuario en código
ALTER TABLE notificaciones_perfil DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que quedó sin RLS y sin políticas
-- Ejecuta esto para confirmar que devuelve vacío o false:
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'notificaciones_perfil';
-- SELECT * FROM pg_policies WHERE tablename = 'notificaciones_perfil';
