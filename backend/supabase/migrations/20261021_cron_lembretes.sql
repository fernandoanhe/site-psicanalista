-- =============================================================
-- MIGRATION: lembretes agendados pelo próprio Supabase (pg_cron + pg_net)
-- Substitui o cron-job.org. Rodar uma vez no SQL Editor do Supabase.
--
-- ANTES de rodar: crie no Vault um segredo chamado "cron_secret" com o
-- mesmo valor de CRON_SECRET do backend (Dashboard > Integrations > Vault).
-- O segredo nunca fica escrito aqui nem no comando do job.
-- =============================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Para aqui se o segredo ainda não estiver no Vault
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    RAISE EXCEPTION 'Crie primeiro o segredo "cron_secret" no Vault (Integrations > Vault).';
  END IF;
END
$$;

-- 3. Job a cada 5 minutos. O segredo é lido do Vault a cada execução e vai
--    no header Authorization (não aparece na URL nem nos logs da Vercel).
--    Agendar de novo com o mesmo nome substitui o job existente.
SELECT cron.schedule(
  'lembretes-sessoes',
  '*/5 * * * *',
  $job$
  SELECT net.http_get(
    url := 'https://backend-psicanalista.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $job$
);

-- Conferir depois de alguns minutos:
--   SELECT status, return_message, start_time FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'lembretes-sessoes')
--   ORDER BY start_time DESC LIMIT 5;
--   SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 5;
--
-- Para desligar: SELECT cron.unschedule('lembretes-sessoes');
