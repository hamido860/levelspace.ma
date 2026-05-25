create table if not exists public.mylevel_question_bank (
  id uuid primary key default gen_random_uuid(),
  grade text not null,
  subject text not null,
  skill text not null,
  difficulty text check (difficulty in ('low', 'medium', 'high')) not null,
  question_text text not null,
  type text check (type in ('multiple-choice', 'fill-in', 'math', 'logic')) not null default 'multiple-choice',
  options jsonb,
  correct_answer text not null,
  explanation text,
  source text default 'ai_generated', -- Can be 'ai_generated', 'exercises', 'quizzes'
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (grade, subject, skill, question_text)
);

create index if not exists mylevel_question_bank_lookup_idx
  on public.mylevel_question_bank (grade, subject, skill, difficulty);

alter table public.mylevel_question_bank enable row level security;

drop policy if exists "Anyone can read mylevel_question_bank" on public.mylevel_question_bank;
create policy "Anyone can read mylevel_question_bank"
  on public.mylevel_question_bank
  for select
  using (true);

drop policy if exists "Admins and authenticated users can insert into mylevel_question_bank" on public.mylevel_question_bank;
create policy "Admins and authenticated users can insert into mylevel_question_bank"
  on public.mylevel_question_bank
  for insert
  with check (auth.role() = 'authenticated');

-- We only want admins to update/delete
drop policy if exists "Admins can update mylevel_question_bank" on public.mylevel_question_bank;
create policy "Admins can update mylevel_question_bank"
  on public.mylevel_question_bank
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop policy if exists "Admins can delete mylevel_question_bank" on public.mylevel_question_bank;
create policy "Admins can delete mylevel_question_bank"
  on public.mylevel_question_bank
  for delete
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );