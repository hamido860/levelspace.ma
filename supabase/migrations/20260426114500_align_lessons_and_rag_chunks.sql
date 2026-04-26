alter table public.lessons
  add column if not exists topic_id uuid,
  add column if not exists track_id uuid,
  add column if not exists title text,
  add column if not exists subtitle text,
  add column if not exists blocks jsonb,
  add column if not exists tags text[],
  add column if not exists updated_at timestamptz default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_topic_id_fkey'
  ) then
    alter table public.lessons
      add constraint lessons_topic_id_fkey
      foreign key (topic_id) references public.topics(id) on delete set null;
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
end
$$;

create index if not exists lessons_topic_id_idx
  on public.lessons (topic_id);

create index if not exists lessons_track_id_idx
  on public.lessons (track_id);

comment on column public.lessons.title is
  'DEPRECATED compatibility mirror. Prefer lesson_title for canonical Supabase lesson naming.';

comment on column public.lessons.topic_id is
  'Optional normalized topic reference for generated lessons. Preserves legacy grade/subject/title lookups.';

comment on column public.lessons.track_id is
  'Optional academic track scope for lessons generated for a specific bac track.';

comment on column public.lessons.blocks is
  'Canonical structured lesson blocks used by the current UI. Legacy flat content remains preserved in content.';

comment on column public.lessons.subtitle is
  'Optional UI summary line, e.g. block count or estimated reading time.';

comment on column public.lessons.tags is
  'Optional lesson tags for Admin/UI display and local sync compatibility.';

create or replace function public.sync_lessons_title_columns()
returns trigger
language plpgsql
as $$
begin
  if new.lesson_title is null and new.title is not null then
    new.lesson_title := new.title;
  end if;

  if new.title is null and new.lesson_title is not null then
    new.title := new.lesson_title;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_lessons_title_columns on public.lessons;

create trigger trg_sync_lessons_title_columns
before insert or update on public.lessons
for each row
execute function public.sync_lessons_title_columns();

alter table public.rag_chunks
  add column if not exists lesson_id uuid,
  add column if not exists grade_id uuid,
  add column if not exists source_url text,
  add column if not exists embedding_status text default 'pending',
  add column if not exists updated_at timestamptz default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rag_chunks_lesson_id_fkey'
  ) then
    alter table public.rag_chunks
      add constraint rag_chunks_lesson_id_fkey
      foreign key (lesson_id) references public.lessons(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rag_chunks_grade_id_fkey'
  ) then
    alter table public.rag_chunks
      add constraint rag_chunks_grade_id_fkey
      foreign key (grade_id) references public.grades(id) on delete set null;
  end if;
end
$$;

create index if not exists rag_chunks_lesson_id_idx
  on public.rag_chunks (lesson_id);

create index if not exists rag_chunks_grade_id_idx
  on public.rag_chunks (grade_id);

create index if not exists rag_chunks_embedding_status_idx
  on public.rag_chunks (embedding_status);

comment on column public.rag_chunks.lesson_id is
  'Optional lesson reference for generated lesson chunks. Nullable by design because raw curriculum chunks may not belong to a lesson.';

comment on column public.rag_chunks.grade_id is
  'Optional normalized grade scope for Admin grouping and curriculum chunk filtering.';

comment on column public.rag_chunks.source_url is
  'Optional original curriculum/source URL retained for Admin inspection.';

comment on column public.rag_chunks.embedding_status is
  'Processing state for embeddings. Legacy rows may rely on source_id/source_type only.';

comment on column public.rag_chunks.source_id is
  'Legacy generic source pointer preserved for backward compatibility.';

comment on column public.rag_chunks.source_type is
  'Legacy generic source type preserved for backward compatibility.';
