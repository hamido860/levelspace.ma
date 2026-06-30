-- Add 'nvidia' to the ai_provider_keys provider check constraint.
-- The original migration only allowed: openai, gemini, openrouter.
-- This patch drops and recreates the constraint to include nvidia.

alter table public.ai_provider_keys
  drop constraint if exists ai_provider_keys_provider_check;

alter table public.ai_provider_keys
  add constraint ai_provider_keys_provider_check
  check (provider in ('openai', 'gemini', 'openrouter', 'nvidia'));
