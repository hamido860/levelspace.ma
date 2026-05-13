create extension if not exists vector;
create extension if not exists pgcrypto;

-- Source documents are the canonical file/document layer. RAG chunks point here;
-- generated lessons do not.
create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null,
  file_url text,
  grade_id uuid references public.grades(id) on delete set null,
  track_id uuid references public.bac_tracks(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  status text not null default 'uploaded',
  quality_score numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.source_documents
  drop constraint if exists source_documents_status_check;

alter table public.source_documents
  add constraint source_documents_status_check
  check (status in ('uploaded', 'extracting', 'chunked', 'needs_review', 'approved', 'rejected', 'archived'));

create index if not exists source_documents_curriculum_idx
  on public.source_documents (grade_id, track_id, subject_id, topic_id);

alter table public.rag_chunks
  add column if not exists document_id uuid references public.source_documents(id) on delete cascade,
  add column if not exists track_id uuid references public.bac_tracks(id) on delete set null,
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists cleaned_content text,
  add column if not exists page_start integer,
  add column if not exists page_end integer,
  add column if not exists status text not null default 'needs_review',
  add column if not exists quality_score numeric(5,2),
  add column if not exists content_hash text;

update public.rag_chunks
set cleaned_content = coalesce(cleaned_content, content),
    content_hash = coalesce(content_hash, encode(digest(coalesce(cleaned_content, content), 'sha256'), 'hex')),
    status = case
      when coalesce(embedding_status, '') = 'done' or embedding is not null then 'embedded'
      when coalesce(validation_status, '') in ('rejected', 'invalid') then 'rejected'
      when coalesce(validation_status, '') in ('approved', 'verified') then 'clean'
      else coalesce(status, 'needs_review')
    end
where cleaned_content is null
   or content_hash is null
   or status is null
   or (status = 'needs_review' and (coalesce(embedding_status, '') = 'done' or embedding is not null));

alter table public.rag_chunks
  drop constraint if exists rag_chunks_status_check;

alter table public.rag_chunks
  add constraint rag_chunks_status_check
  check (status in ('clean', 'needs_review', 'rejected', 'embedded'));

create index if not exists rag_chunks_document_id_idx
  on public.rag_chunks (document_id);

create index if not exists rag_chunks_curriculum_idx
  on public.rag_chunks (grade_id, track_id, subject_id, topic_id);

create unique index if not exists rag_chunks_content_hash_udx
  on public.rag_chunks (document_id, content_hash)
  where document_id is not null and content_hash is not null;

-- Embeddings are now separate from source chunks and final lessons.
create table if not exists public.rag_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.rag_chunks(id) on delete cascade,
  embedding vector(768) not null,
  embedding_model text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (chunk_id)
);

insert into public.rag_embeddings (chunk_id, embedding, embedding_model, created_at)
select
  rc.id,
  rc.embedding,
  coalesce(rc.metadata->>'embedding_model', 'legacy-gemini-embedding-001'),
  coalesce(rc.processed_at, rc.created_at, timezone('utc'::text, now()))
from public.rag_chunks rc
where rc.embedding is not null
on conflict (chunk_id) do update
set embedding = excluded.embedding,
    embedding_model = excluded.embedding_model;

create index if not exists rag_embeddings_embedding_idx
  on public.rag_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists rag_embeddings_chunk_id_idx
  on public.rag_embeddings (chunk_id);

create table if not exists public.lesson_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid references public.grades(id) on delete set null,
  track_id uuid references public.bac_tracks(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid not null references public.topics(id) on delete cascade,
  status text not null default 'queued',
  provider_used text,
  fallback_used boolean not null default false,
  prompt_version text,
  retrieved_chunk_ids jsonb not null default '[]'::jsonb,
  output_lesson_id uuid,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

alter table public.lesson_generation_jobs
  drop constraint if exists lesson_generation_jobs_status_check;

alter table public.lesson_generation_jobs
  add constraint lesson_generation_jobs_status_check
  check (status in ('queued', 'running', 'needs_review', 'completed', 'failed'));

create index if not exists lesson_generation_jobs_curriculum_idx
  on public.lesson_generation_jobs (grade_id, track_id, subject_id, topic_id);

create index if not exists lesson_generation_jobs_status_idx
  on public.lesson_generation_jobs (status);

alter table public.lessons
  add column if not exists grade_id uuid references public.grades(id) on delete set null,
  add column if not exists track_id uuid references public.bac_tracks(id) on delete set null,
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists summary text,
  add column if not exists status text not null default 'draft',
  add column if not exists generation_job_id uuid references public.lesson_generation_jobs(id) on delete set null,
  add column if not exists source_mode text not null default 'ai_generated';

update public.lessons
set status = 'draft'
where status is null
   or status not in ('draft', 'review', 'published', 'archived', 'done');

update public.lessons
set source_mode = case
  when is_ai_generated is true then 'ai_generated'
  else 'manual'
end
where source_mode is null
   or source_mode not in ('ai_generated', 'manual', 'imported');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_grade_id_fkey'
  ) then
    alter table public.lessons
      add constraint lessons_grade_id_fkey
      foreign key (grade_id) references public.grades(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_track_id_fkey'
  ) then
    alter table public.lessons
      add constraint lessons_track_id_fkey
      foreign key (track_id) references public.bac_tracks(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_subject_id_fkey'
  ) then
    alter table public.lessons
      add constraint lessons_subject_id_fkey
      foreign key (subject_id) references public.subjects(id) on delete set null;
  end if;
end
$$;

alter table public.lessons
  drop constraint if exists lessons_status_check;

alter table public.lessons
  add constraint lessons_status_check
  check (status in ('draft', 'review', 'published', 'archived', 'done'));

alter table public.lessons
  drop constraint if exists lessons_source_mode_check;

alter table public.lessons
  add constraint lessons_source_mode_check
  check (source_mode in ('ai_generated', 'manual', 'imported'));

alter table public.lesson_generation_jobs
  drop constraint if exists lesson_generation_jobs_output_lesson_id_fkey;

alter table public.lesson_generation_jobs
  add constraint lesson_generation_jobs_output_lesson_id_fkey
  foreign key (output_lesson_id) references public.lessons(id) on delete set null;

create index if not exists lessons_curriculum_idx
  on public.lessons (grade_id, track_id, subject_id, topic_id);

create index if not exists lessons_generation_job_id_idx
  on public.lessons (generation_job_id);

create table if not exists public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null,
  emoji text,
  title text,
  content text not null,
  short_version text,
  sort_order integer not null default 0,
  order_index integer,
  importance text not null default 'medium',
  student_action text not null default 'read',
  estimated_difficulty text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.lesson_blocks
  add column if not exists type text not null default 'simple_explanation',
  add column if not exists emoji text,
  add column if not exists title text,
  add column if not exists content text not null default '',
  add column if not exists short_version text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists order_index integer,
  add column if not exists importance text not null default 'medium',
  add column if not exists student_action text not null default 'read',
  add column if not exists estimated_difficulty text not null default 'medium',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

update public.lesson_blocks
set sort_order = coalesce(nullif(sort_order, 0), order_index, 0),
    type = case
      when type in (
        'definition', 'key_idea', 'simple_explanation', 'example', 'question',
        'warning', 'dont_confuse', 'note', 'formula', 'remember', 'practice',
        'ai_hint', 'vocabulary', 'summary', 'checkpoint'
      ) then type
      else 'simple_explanation'
    end,
    importance = case when importance in ('low', 'medium', 'high') then importance else 'medium' end,
    student_action = case when student_action in ('read', 'think', 'answer', 'remember', 'practice', 'compare') then student_action else 'read' end,
    estimated_difficulty = case when estimated_difficulty in ('easy', 'medium', 'hard') then estimated_difficulty else 'medium' end;

alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_type_check;

alter table public.lesson_blocks
  add constraint lesson_blocks_type_check
  check (type in (
    'definition', 'key_idea', 'simple_explanation', 'example', 'question',
    'warning', 'dont_confuse', 'note', 'formula', 'remember', 'practice',
    'ai_hint', 'vocabulary', 'summary', 'checkpoint'
  ));

alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_importance_check;

alter table public.lesson_blocks
  add constraint lesson_blocks_importance_check
  check (importance in ('low', 'medium', 'high'));

alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_student_action_check;

alter table public.lesson_blocks
  add constraint lesson_blocks_student_action_check
  check (student_action in ('read', 'think', 'answer', 'remember', 'practice', 'compare'));

alter table public.lesson_blocks
  drop constraint if exists lesson_blocks_estimated_difficulty_check;

alter table public.lesson_blocks
  add constraint lesson_blocks_estimated_difficulty_check
  check (estimated_difficulty in ('easy', 'medium', 'hard'));

create index if not exists lesson_blocks_lesson_order_idx
  on public.lesson_blocks (lesson_id, sort_order, order_index);

create or replace function public.match_rag_embeddings (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_topic_id uuid default null,
  p_grade_id uuid default null,
  p_subject_id uuid default null,
  p_track_id uuid default null
)
returns table (
  id uuid,
  chunk_id uuid,
  document_id uuid,
  grade_id uuid,
  track_id uuid,
  subject_id uuid,
  topic_id uuid,
  content text,
  cleaned_content text,
  source_type text,
  source_url text,
  metadata jsonb,
  embedding_model text,
  similarity float
)
language sql stable
as $$
  select
    re.id,
    rc.id as chunk_id,
    rc.document_id,
    rc.grade_id,
    rc.track_id,
    rc.subject_id,
    rc.topic_id,
    rc.content,
    rc.cleaned_content,
    rc.source_type,
    rc.source_url,
    rc.metadata,
    re.embedding_model,
    1 - (re.embedding <=> query_embedding) as similarity
  from public.rag_embeddings re
  join public.rag_chunks rc on rc.id = re.chunk_id
  where 1 - (re.embedding <=> query_embedding) > match_threshold
    and rc.status in ('clean', 'embedded')
    and (p_topic_id is null or rc.topic_id = p_topic_id)
    and (p_grade_id is null or rc.grade_id = p_grade_id)
    and (p_subject_id is null or rc.subject_id = p_subject_id)
    and (p_track_id is null or rc.track_id = p_track_id)
  order by re.embedding <=> query_embedding
  limit match_count;
$$;

comment on table public.source_documents is
  'Canonical source document layer: uploaded PDFs, scraped documents, official files, and metadata.';

comment on table public.rag_chunks is
  'Canonical RAG chunk layer: extracted, cleaned, reviewable source knowledge. Do not store final lesson content or UI blocks here.';

comment on table public.rag_embeddings is
  'Canonical embedding/search layer. Stores vectors for rag_chunks only.';

comment on table public.lesson_generation_jobs is
  'Canonical AI lesson generation job layer and audit log.';

comment on table public.lessons is
  'Canonical final lesson layer: polished student-facing lesson records.';

comment on table public.lesson_blocks is
  'Canonical lesson block UI layer: structured student-facing learning blocks.';

comment on column public.lessons.embedding is
  'DEPRECATED compatibility column. Do not write new lesson embeddings here; use rag_embeddings for source chunk semantic search only.';

comment on column public.rag_chunks.embedding is
  'DEPRECATED compatibility column. New vectors belong in public.rag_embeddings.';

comment on column public.rag_chunks.lesson_id is
  'DEPRECATED compatibility link. RAG chunks are source knowledge and should not store generated lesson content.';

comment on table public.lesson_gen_queue is
  'Legacy queue table. Prefer public.lesson_generation_jobs for new generation work.';
