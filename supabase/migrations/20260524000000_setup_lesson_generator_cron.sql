-- Migration: Create an automated background agent for lesson generation via pg_cron.
-- It searches the 'lessons' table for missing content and invokes the generate-lessons Edge Function.

-- Enable necessary extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a helper function to trigger lesson generation
CREATE OR REPLACE FUNCTION public.trigger_lesson_generation()
RETURNS void AS $$
DECLARE
  v_lesson_id UUID;
  v_topic_id TEXT;
  v_project_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- We use decrypted secrets stored via Supabase Vault or fallback to current_setting
  -- For production, it's highly recommended to use Vault for secrets.
  -- Here we assume 'edge_function_url' and 'service_role_key' are stored in custom settings or Vault.
  -- Example fallback using current_setting (these must be set in your postgres config):
  v_project_url := current_setting('custom.edge_function_base_url', true);
  v_service_role_key := current_setting('custom.service_role_key', true);

  -- Fallback logic if settings aren't set in pg config yet (replace these in your dashboard)
  IF v_project_url IS NULL OR v_project_url = '' THEN
    RAISE NOTICE 'Skipping generation: custom.edge_function_base_url is not set.';
    RETURN;
  END IF;

  -- Find one lesson that needs generation
  SELECT id, topic_id::TEXT INTO v_lesson_id, v_topic_id
  FROM public.lessons
  WHERE status = 'draft'
    AND (is_ai_generated IS NULL OR is_ai_generated = false)
    AND 'starter' = ANY(tags)
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_lesson_id IS NOT NULL AND v_topic_id IS NOT NULL THEN
    -- Invoke the edge function using pg_net
    SELECT net.http_post(
      url := v_project_url || '/generate-lessons',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'topicId', v_topic_id,
        'lessonId', v_lesson_id
      )
    ) INTO v_request_id;

    RAISE NOTICE 'Triggered lesson generation for lesson % via pg_net request %', v_lesson_id, v_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run every 5 minutes (adjust as needed to stay within free tier limits)
-- Note: cron.schedule must be run by a superuser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'generate_missing_lessons_job',
      '*/5 * * * *',
      'SELECT public.trigger_lesson_generation()'
    );
  END IF;
END $$;
