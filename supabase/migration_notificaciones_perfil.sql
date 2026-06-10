-- ======================================================================================
-- MIGRACIÓN: SISTEMA DE NOTIFICACIONES PER-PROFILE
-- SIREVAQ 2026
-- ======================================================================================
-- Ejecutar en el SQL Editor de Supabase ANTES de desplegar el nuevo código.
-- ======================================================================================

-- 1. Crear tabla de buzón individual por usuario
CREATE TABLE IF NOT EXISTS notificaciones_perfil (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notificacion_id TEXT NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
  usuario TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNREAD',
  read_ts TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_ts TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(notificacion_id, usuario)
);

-- 2. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_np_usuario_status ON notificaciones_perfil(usuario, deleted, status);
CREATE INDEX IF NOT EXISTS idx_np_notificacion_id ON notificaciones_perfil(notificacion_id);
CREATE INDEX IF NOT EXISTS idx_np_usuario_deleted ON notificaciones_perfil(usuario, deleted);

-- 3. Habilitar Realtime para la nueva tabla
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones_perfil;

-- 4. RLS (Row Level Security) - Asegura que cada usuario solo vea sus propias notificaciones
-- NOTA: Si la app usa service_role key, RLS no aplica. Pero lo dejamos para buenas prácticas.
ALTER TABLE notificaciones_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON notificaciones_perfil
  FOR SELECT
  USING (usuario = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own notifications"
  ON notificaciones_perfil
  FOR UPDATE
  USING (usuario = current_setting('request.jwt.claims', true)::json->>'sub');

-- 5. Normalizar columna type/tipo en notificaciones (si existe como 'tipo')
-- Verificar si la columna 'tipo' existe y renombrarla a 'type'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notificaciones' AND column_name = 'tipo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notificaciones' AND column_name = 'type'
  ) THEN
    ALTER TABLE notificaciones RENAME COLUMN tipo TO type;
  END IF;
END $$;

-- Si ambas existen, copiar datos de 'tipo' a 'type' donde 'type' esté vacío
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notificaciones' AND column_name = 'tipo'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notificaciones' AND column_name = 'type'
  ) THEN
    UPDATE notificaciones SET type = tipo WHERE (type IS NULL OR type = '') AND tipo IS NOT NULL AND tipo != '';
  END IF;
END $$;

-- ======================================================================================
-- FIN DE MIGRACIÓN
-- ======================================================================================
