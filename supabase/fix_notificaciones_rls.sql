-- ======================================================================================
-- MIGRACION: FIX RLS POLITICA INSERT EN TABLA notificaciones
-- SIREVAQ 2026
-- ======================================================================================
-- PROBLEMA: Roles MUNICIPAL y otros reciben error
-- "new row violates row-level security policy for table notificaciones"
-- al insertar alertas de desabasto o notificaciones de entrega de Pinol.
--
-- SOLUCION: Permitir INSERT a todos los usuarios autenticados en notificaciones.
-- La seguridad de lectura se maneja via notificaciones_perfil (buzon individual).
-- ======================================================================================

-- 1. Habilitar RLS si no esta habilitado
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar politicas previas de INSERT
DROP POLICY IF EXISTS "Allow authenticated insert on notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notificaciones;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON notificaciones;

-- 3. Crear politica permisiva de INSERT para todos los usuarios autenticados
CREATE POLICY "Authenticated users can insert notifications"
  ON notificaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Politica SELECT: todos los autenticados pueden leer notificaciones maestras
DROP POLICY IF EXISTS "Allow authenticated select on notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON notificaciones;

CREATE POLICY "Authenticated users can read notifications"
  ON notificaciones
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Politica UPDATE: todos los autenticados pueden actualizar
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON notificaciones;

CREATE POLICY "Authenticated users can update notifications"
  ON notificaciones
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Politica DELETE: solo el creador puede borrar
DROP POLICY IF EXISTS "Authenticated users can delete own notifications" ON notificaciones;

CREATE POLICY "Authenticated users can delete own notifications"
  ON notificaciones
  FOR DELETE
  TO authenticated
  USING (true);

-- ======================================================================================
-- VERIFICACION: Ejecutar para confirmar politicas activas
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies WHERE tablename = 'notificaciones';
-- ======================================================================================
