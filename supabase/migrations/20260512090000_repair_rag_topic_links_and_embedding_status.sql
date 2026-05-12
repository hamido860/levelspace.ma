create extension if not exists unaccent;

alter table public.rag_chunks
  add column if not exists topic_id uuid,
  add column if not exists title text,
  add column if not exists processed_at timestamptz,
  add column if not exists updated_at timestamptz default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rag_chunks_topic_id_fkey'
  ) then
    alter table public.rag_chunks
      add constraint rag_chunks_topic_id_fkey
      foreign key (topic_id) references public.topics(id) on delete set null;
  end if;
end
$$;

create index if not exists rag_chunks_topic_id_idx
  on public.rag_chunks (topic_id);

create index if not exists rag_chunks_usable_idx
  on public.rag_chunks (topic_id, embedding_status)
  where embedding is not null;

create or replace function public.normalize_curriculum_text(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(unaccent(coalesce(value, ''))), '[^[:alnum:]]+', ' ', 'g'));
$$;

create or replace function public.sync_rag_chunk_embedding_state()
returns trigger
language plpgsql
as $$
begin
  if new.embedding is not null then
    new.embedding_status := 'done';
    new.processed_at := coalesce(new.processed_at, timezone('utc'::text, now()));
  elsif new.embedding_status is null then
    new.embedding_status := 'pending';
  end if;

  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_sync_rag_chunk_embedding_state on public.rag_chunks;

create trigger trg_sync_rag_chunk_embedding_state
before insert or update of embedding, embedding_status on public.rag_chunks
for each row
execute function public.sync_rag_chunk_embedding_state();

create or replace function public.repair_rag_chunk_topic_links(max_rows integer default null)
returns table(strategy text, repaired_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with candidates as (
    select
      rc.id,
      coalesce(l.topic_id, sl.topic_id) as topic_id,
      coalesce(rc.grade_id, t.grade_id) as grade_id
    from public.rag_chunks rc
    left join public.lessons l on l.id = rc.lesson_id
    left join public.lessons sl
      on rc.source_id = sl.id
     and coalesce(rc.source_type, '') in ('lesson', 'lesson_block', 'generated_lesson')
    left join public.topics t on t.id = coalesce(l.topic_id, sl.topic_id)
    where rc.topic_id is null
      and coalesce(l.topic_id, sl.topic_id) is not null
    limit coalesce(max_rows, 2147483647)
  )
  update public.rag_chunks rc
  set topic_id = candidates.topic_id,
      grade_id = coalesce(rc.grade_id, candidates.grade_id),
      updated_at = timezone('utc'::text, now())
  from candidates
  where rc.id = candidates.id;

  get diagnostics affected = row_count;
  strategy := 'lesson_id_or_source_id';
  repaired_count := affected;
  return next;

  with candidates as (
    select rc.id, t.id as topic_id, coalesce(rc.grade_id, t.grade_id) as grade_id
    from public.rag_chunks rc
    join public.topics t
      on t.id::text = coalesce(
        rc.metadata->>'topic_id',
        rc.metadata->'topic'->>'id',
        rc.metadata->'source'->>'topic_id'
      )
    where rc.topic_id is null
    limit coalesce(max_rows, 2147483647)
  )
  update public.rag_chunks rc
  set topic_id = candidates.topic_id,
      grade_id = coalesce(rc.grade_id, candidates.grade_id),
      updated_at = timezone('utc'::text, now())
  from candidates
  where rc.id = candidates.id;

  get diagnostics affected = row_count;
  strategy := 'metadata_topic_id';
  repaired_count := affected;
  return next;

  with candidates as (
    select rc.id, l.topic_id, coalesce(rc.grade_id, t.grade_id) as grade_id
    from public.rag_chunks rc
    join public.lessons l
      on l.id::text = coalesce(
        rc.metadata->>'lesson_id',
        rc.metadata->'lesson'->>'id',
        rc.metadata->'source'->>'lesson_id'
      )
    join public.topics t on t.id = l.topic_id
    where rc.topic_id is null
      and l.topic_id is not null
    limit coalesce(max_rows, 2147483647)
  )
  update public.rag_chunks rc
  set topic_id = candidates.topic_id,
      grade_id = coalesce(rc.grade_id, candidates.grade_id),
      updated_at = timezone('utc'::text, now())
  from candidates
  where rc.id = candidates.id;

  get diagnostics affected = row_count;
  strategy := 'metadata_lesson_id';
  repaired_count := affected;
  return next;

  with candidates as (
    select distinct on (rc.id)
      rc.id,
      t.id as topic_id,
      t.grade_id
    from public.rag_chunks rc
    join public.topics t
      on public.normalize_curriculum_text(t.title) = public.normalize_curriculum_text(coalesce(
        rc.title,
        rc.metadata->>'title',
        rc.metadata->>'topic',
        rc.metadata->>'topic_title',
        rc.metadata->'source'->>'title',
        rc.metadata->'source'->>'topic_title'
      ))
    join public.subjects s on s.id = t.subject_id
    where rc.topic_id is null
      and (
        rc.grade_id is null
        or rc.grade_id = t.grade_id
        or (rc.metadata->>'grade_id') = t.grade_id::text
      )
      and (
        nullif(public.normalize_curriculum_text(coalesce(
          rc.metadata->>'subject',
          rc.metadata->>'subject_name',
          rc.metadata->'source'->>'subject',
          rc.metadata->'source'->>'subject_name'
        )), '') is null
        or public.normalize_curriculum_text(s.name) = public.normalize_curriculum_text(coalesce(
          rc.metadata->>'subject',
          rc.metadata->>'subject_name',
          rc.metadata->'source'->>'subject',
          rc.metadata->'source'->>'subject_name'
        ))
      )
    order by rc.id, t.created_at asc
    limit coalesce(max_rows, 2147483647)
  )
  update public.rag_chunks rc
  set topic_id = candidates.topic_id,
      grade_id = coalesce(rc.grade_id, candidates.grade_id),
      updated_at = timezone('utc'::text, now())
  from candidates
  where rc.id = candidates.id;

  get diagnostics affected = row_count;
  strategy := 'metadata_or_title_exact_match';
  repaired_count := affected;
  return next;
end;
$$;

update public.rag_chunks
set embedding_status = 'done',
    processed_at = coalesce(processed_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
where embedding_status = 'pending'
  and embedding is not null;

select * from public.repair_rag_chunk_topic_links();
