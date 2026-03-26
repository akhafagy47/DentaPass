-- pg_cron schedules for DentaPass automation
-- Run after deploying Edge Functions to Supabase
-- Requires pg_cron extension (enabled by default on Supabase)

-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- ─────────────────────────────────────────────
-- Recall reminders: daily at 9:00 AM UTC
-- ─────────────────────────────────────────────
select cron.schedule(
  'recall-reminders',
  '0 9 * * *',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/recall-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- ─────────────────────────────────────────────
-- Review requests: every 2 hours
-- ─────────────────────────────────────────────
select cron.schedule(
  'review-requests',
  '0 */2 * * *',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/review-requests',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- ─────────────────────────────────────────────
-- To set app settings (run once):
-- ─────────────────────────────────────────────
-- alter database postgres set "app.supabase_url" = 'https://your-project.supabase.co';
-- alter database postgres set "app.supabase_service_role_key" = 'your-service-role-key';
