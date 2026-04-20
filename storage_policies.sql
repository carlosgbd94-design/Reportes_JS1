-- Creación del Bucket de evidencias (si no existe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en objetos de storage (Generalmente ya viene habilitado por Supabase)
-- Si el bucket 'evidencias' no existe, créalo manualmente en el Dashboard de Supabase con acceso público.

-- Política de INSERT: Autenticados pueden subir archivos a 'evidencias'
CREATE POLICY "Permitir subida a usuarios autenticados" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'evidencias' 
);

-- Política de SELECT: Accesibilidad pública de lectura.
CREATE POLICY "Permitir lectura a cualquier usuario" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'evidencias'
);

-- Política de UPDATE: Solo los dueños
CREATE POLICY "Permitir actualización al dueño"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidencias' AND auth.uid() = owner
);

-- Política de DELETE: Solo dueños
CREATE POLICY "Permitir eliminación al dueño"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidencias' AND auth.uid() = owner
);

-- Función para listar evidencias
CREATE OR REPLACE FUNCTION get_evidences_list() 
RETURNS TABLE (
  name text, 
  bucket_id text, 
  owner uuid, 
  created_at timestamptz, 
  updated_at timestamptz, 
  last_accessed_at timestamptz, 
  metadata jsonb
) 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  SELECT name, bucket_id, owner, created_at, updated_at, last_accessed_at, metadata 
  FROM storage.objects 
  WHERE bucket_id = 'evidencias';
$$;
