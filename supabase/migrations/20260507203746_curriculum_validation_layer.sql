do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'validation_status'
  ) then
    alter table public.lessons
      add column validation_status text not null default 'unverified',
      add column source_confidence numeric not null default 0,
      add column source_name text,
      add column source_url text,
      add column review_notes text,
      add column reviewed_by uuid references auth.users(id) on delete set null,
      add column reviewed_at timestamptz;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'topics'
      and column_name = 'validation_status'
  ) then
    alter table public.topics
      add column validation_status text not null default 'unverified',
      add column source_confidence numeric not null default 0,
      add column source_name text,
      add column source_url text,
      add column review_notes text,
      add column reviewed_by uuid references auth.users(id) on delete set null,
      add column reviewed_at timestamptz;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rag_chunks'
      and column_name = 'validation_status'
  ) then
    alter table public.rag_chunks
      add column validation_status text not null default 'unverified',
      add column source_confidence numeric not null default 0,
      add column source_name text,
      add column review_notes text,
      add column reviewed_by uuid references auth.users(id) on delete set null,
      add column reviewed_at timestamptz;
  end if;
end
$$;

create table if not exists public.rag_questions (
  id uuid primary key default gen_random_uuid(),
  rag_chunk_id uuid references public.rag_chunks(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  question text not null default '',
  answer text,
  metadata jsonb not null default '{}'::jsonb,
  validation_status text not null default 'unverified',
  source_confidence numeric not null default 0,
  source_name text,
  source_url text,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.rag_questions
  add column if not exists rag_chunk_id uuid references public.rag_chunks(id) on delete set null,
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null,
  add column if not exists topic_id uuid references public.topics(id) on delete set null,
  add column if not exists question text not null default '',
  add column if not exists answer text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists validation_status text not null default 'unverified',
  add column if not exists source_confidence numeric not null default 0,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.lessons
  drop constraint if exists lessons_validation_status_check;

alter table public.lessons
  add constraint lessons_validation_status_check
  check (validation_status in (
    'unverified',
    'ai_generated',
    'source_matched',
    'teacher_reviewed',
    'official_validated',
    'rejected'
  ));

alter table public.topics
  drop constraint if exists topics_validation_status_check;

alter table public.topics
  add constraint topics_validation_status_check
  check (validation_status in (
    'unverified',
    'ai_generated',
    'source_matched',
    'teacher_reviewed',
    'official_validated',
    'rejected'
  ));

alter table public.rag_chunks
  drop constraint if exists rag_chunks_validation_status_check;

alter table public.rag_chunks
  add constraint rag_chunks_validation_status_check
  check (validation_status in (
    'unverified',
    'ai_generated',
    'source_matched',
    'teacher_reviewed',
    'official_validated',
    'rejected'
  ));

alter table public.rag_questions
  drop constraint if exists rag_questions_validation_status_check;

alter table public.rag_questions
  add constraint rag_questions_validation_status_check
  check (validation_status in (
    'unverified',
    'ai_generated',
    'source_matched',
    'teacher_reviewed',
    'official_validated',
    'rejected'
  ));

alter table public.lessons
  drop constraint if exists lessons_source_confidence_check;

alter table public.lessons
  add constraint lessons_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1);

alter table public.topics
  drop constraint if exists topics_source_confidence_check;

alter table public.topics
  add constraint topics_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1);

alter table public.rag_chunks
  drop constraint if exists rag_chunks_source_confidence_check;

alter table public.rag_chunks
  add constraint rag_chunks_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1);

alter table public.rag_questions
  drop constraint if exists rag_questions_source_confidence_check;

alter table public.rag_questions
  add constraint rag_questions_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1);

create table if not exists public.curriculum_source_refs (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'Morocco',
  cycle text,
  grade text,
  track text,
  subject text,
  topic_title text,
  source_name text,
  source_url text,
  source_type text not null,
  confidence_weight numeric not null default 0.5,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.curriculum_source_refs
  drop constraint if exists curriculum_source_refs_source_type_check;

alter table public.curriculum_source_refs
  add constraint curriculum_source_refs_source_type_check
  check (source_type in ('official', 'teacher_resource', 'platform', 'manual'));

alter table public.curriculum_source_refs
  drop constraint if exists curriculum_source_refs_confidence_weight_check;

alter table public.curriculum_source_refs
  add constraint curriculum_source_refs_confidence_weight_check
  check (confidence_weight >= 0 and confidence_weight <= 1);

create table if not exists public.curriculum_validation_audits (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  content_type text not null,
  validation_result text not null,
  mismatches jsonb not null default '{}'::jsonb,
  recommendation text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.curriculum_validation_audits
  drop constraint if exists curriculum_validation_audits_content_type_check;

alter table public.curriculum_validation_audits
  add constraint curriculum_validation_audits_content_type_check
  check (content_type in ('lesson', 'topic', 'rag_chunk', 'rag_question'));

create index if not exists lessons_validation_status_idx
  on public.lessons (validation_status);

create index if not exists topics_validation_status_idx
  on public.topics (validation_status);

create index if not exists rag_chunks_validation_status_idx
  on public.rag_chunks (validation_status);

create index if not exists rag_questions_validation_status_idx
  on public.rag_questions (validation_status);

create index if not exists rag_questions_lesson_id_idx
  on public.rag_questions (lesson_id);

create index if not exists rag_questions_topic_id_idx
  on public.rag_questions (topic_id);

create index if not exists rag_questions_rag_chunk_id_idx
  on public.rag_questions (rag_chunk_id);

create index if not exists curriculum_source_refs_lookup_idx
  on public.curriculum_source_refs (country, grade, track, subject);

create index if not exists curriculum_source_refs_topic_title_idx
  on public.curriculum_source_refs (topic_title);

create index if not exists curriculum_validation_audits_lookup_idx
  on public.curriculum_validation_audits (content_type, content_id, created_at desc);

update public.lessons
set validation_status = 'ai_generated'
where coalesce(is_ai_generated, false) = true
  and validation_status = 'unverified';

update public.rag_chunks
set validation_status = 'ai_generated'
where coalesce(source_type, '') in ('lesson_block', 'ai_generated', 'generated_lesson')
  and validation_status = 'unverified';

alter table public.rag_questions enable row level security;
alter table public.curriculum_source_refs enable row level security;
alter table public.curriculum_validation_audits enable row level security;

drop policy if exists "Anyone can view rag_questions" on public.rag_questions;
create policy "Anyone can view rag_questions"
  on public.rag_questions
  for select
  using (true);

drop policy if exists "Admins can manage rag_questions" on public.rag_questions;
create policy "Admins can manage rag_questions"
  on public.rag_questions
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop policy if exists "Anyone can view curriculum source refs" on public.curriculum_source_refs;
create policy "Anyone can view curriculum source refs"
  on public.curriculum_source_refs
  for select
  using (true);

drop policy if exists "Admins can manage curriculum source refs" on public.curriculum_source_refs;
create policy "Admins can manage curriculum source refs"
  on public.curriculum_source_refs
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop policy if exists "Admins can view curriculum validation audits" on public.curriculum_validation_audits;
create policy "Admins can view curriculum validation audits"
  on public.curriculum_validation_audits
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop policy if exists "Admins can manage curriculum validation audits" on public.curriculum_validation_audits;
create policy "Admins can manage curriculum validation audits"
  on public.curriculum_validation_audits
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop trigger if exists trg_rag_questions_set_updated_at on public.rag_questions;
create trigger trg_rag_questions_set_updated_at
before update on public.rag_questions
for each row
execute function public.set_updated_at();
