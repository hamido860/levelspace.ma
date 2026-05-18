create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  owner_ref text not null,
  provider text not null,
  encrypted_api_key text not null,
  key_preview text,
  is_active boolean not null default true,
  last_test_status text,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_provider_keys_provider_check check (provider in ('openai', 'gemini', 'openrouter')),
  constraint ai_provider_keys_test_status_check check (last_test_status is null or last_test_status in ('passed', 'failed')),
  constraint ai_provider_keys_owner_provider_key unique (owner_ref, provider)
);

create index if not exists ai_provider_keys_user_id_idx on public.ai_provider_keys(user_id);
create index if not exists ai_provider_keys_owner_ref_idx on public.ai_provider_keys(owner_ref);

alter table public.ai_provider_keys enable row level security;

drop policy if exists "Users can read their own provider key metadata" on public.ai_provider_keys;
create policy "Users can read their own provider key metadata"
on public.ai_provider_keys
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own provider keys" on public.ai_provider_keys;
create policy "Users can insert their own provider keys"
on public.ai_provider_keys
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own provider keys" on public.ai_provider_keys;
create policy "Users can update their own provider keys"
on public.ai_provider_keys
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own provider keys" on public.ai_provider_keys;
create policy "Users can delete their own provider keys"
on public.ai_provider_keys
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_provider_keys to authenticated;

create or replace function public.set_ai_provider_keys_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_provider_keys_updated_at on public.ai_provider_keys;
create trigger set_ai_provider_keys_updated_at
before update on public.ai_provider_keys
for each row
execute function public.set_ai_provider_keys_updated_at();
