-- ======================================================================================
-- CONFIGURACIÓN DE ALERTAS AUTOMÁTICAS (PG_CRON)
-- RDA 2026 - JURISDICCION SANITARIA 1
-- ======================================================================================

-- 1. Habilitar las extensiones necesarias en la base de datos
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- 2. Limpiar tareas anteriores si existen para evitar duplicados sin lanzar error
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname IN (
  'enviar-recordatorio-jueves', 
  'enviar-recordatorio-viernes', 
  'enviar-resumen-jueves', 
  'enviar-resumen-viernes',
  'enviar-recordatorio-captura',
  'enviar-resumen-municipal'
);

-- 3. Programar las nuevas tareas
-- IMPORTANTE: Los servidores de Supabase operan en hora UTC.
-- México (Centro) se encuentra a UTC-6 (sin horario de verano).
--
-- Horarios traducidos a UTC:
-- * 14:30 Centro de México = 20:30 UTC.
-- * 18:00 Centro de México = 00:00 UTC (del día siguiente).

-- ==========================================
-- JUEVES
-- ==========================================

-- Tarea A: Recordatorio de Captura Jueves (14:30 MX -> 20:30 UTC)
-- Verifica Consumibles de hoy y Biológicos de hoy
-- timeout_milliseconds ampliado (default de pg_net es 5000ms, insuficiente para varios envíos SMTP)
SELECT cron.schedule(
  'enviar-recordatorio-jueves',
  '30 20 * * 4',
  $$
  SELECT net.http_post(
    url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/email-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"action": "send-reminders"}',
    timeout_milliseconds := 20000
  );
  $$
);

-- Tarea B: Resumen de Capturas Jueves (18:00 MX -> Viernes 00:00 UTC)
-- Envía reporte de Consumibles a municipales y general a admins
-- timeout_milliseconds ampliado a 30s: este job envía a varios destinatarios (municipal/caravanas/admin)
SELECT cron.schedule(
  'enviar-resumen-jueves',
  '0 0 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/email-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"action": "send-summaries"}',
    timeout_milliseconds := 30000
  );
  $$
);

-- ==========================================
-- VIERNES
-- ==========================================

-- Tarea C: Recordatorio de Captura Viernes (14:30 MX -> 20:30 UTC)
-- Verifica Biológicos considerando captura de ayer (Jueves) y hoy (Viernes)
SELECT cron.schedule(
  'enviar-recordatorio-viernes',
  '30 20 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/email-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"action": "send-reminders"}',
    timeout_milliseconds := 20000
  );
  $$
);

-- Tarea D: Resumen de Capturas Viernes (18:00 MX -> Sábado 00:00 UTC)
-- Envía reporte de Biológicos a municipales y general a admins (contempla Jueves + Viernes)
SELECT cron.schedule(
  'enviar-resumen-viernes',
  '0 0 * * 6',
  $$
  SELECT net.http_post(
    url := 'https://utclfqjietlxzlorxhrs.supabase.co/functions/v1/email-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"action": "send-summaries"}',
    timeout_milliseconds := 30000
  );
  $$
);
