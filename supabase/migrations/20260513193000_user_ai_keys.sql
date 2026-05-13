create table if not exists public.user_ai_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_api_key text not null,
  key_last4 text,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ai_keys_provider_check check (provider in ('gemini', 'openrouter', 'openai')),
  constraint user_ai_keys_user_provider_key unique (user_id, provider)
);

create index if not exists user_ai_keys_user_id_idx on public.user_ai_keys(user_id);

alter table public.user_ai_keys enable row level security;

drop policy if exists "Users can read their own AI key metadata" on public.user_ai_keys;
create policy "Users can read their own AI key metadata"
on public.user_ai_keys
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own AI keys" on public.user_ai_keys;
create policy "Users can insert their own AI keys"
on public.user_ai_keys
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own AI keys" on public.user_ai_keys;
create policy "Users can update their own AI keys"
on public.user_ai_keys
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own AI keys" on public.user_ai_keys;
create policy "Users can delete their own AI keys"
on public.user_ai_keys
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_ai_keys to authenticated;

create or replace function public.set_user_ai_keys_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_ai_keys_updated_at on public.user_ai_keys;
create trigger set_user_ai_keys_updated_at
before update on public.user_ai_keys
for each row
execute function public.set_user_ai_keys_updated_at();
