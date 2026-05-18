create extension if not exists unaccent;

alter table public.rag_chunks
  add column if not exists topic_id uuid references public.topics(id);

create index if not exists idx_rag_chunks_topic_id
  on public.rag_chunks(topic_id);

create index if not exists idx_rag_chunks_grade_topic_status
  on public.rag_chunks(grade_id, topic_id, embedding_status);

create index if not exists idx_rag_chunks_metadata_gin
  on public.rag_chunks using gin(metadata);

create or replace function public.rag_link_normalize(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(unaccent(coalesce(value, ''))), '[^[:alnum:]]+', ' ', 'g'));
$$;

create or replace function public.rag_link_is_uuid(value text)
returns boolean
language sql
immutable
as $$
  select coalesce(value, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

create or replace function public.repair_rag_chunk_topic_links(max_rows integer default null)
returns table(method text, linked_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
  row_limit integer := coalesce(max_rows, 2147483647);
begin
  with candidates as (
    select rc.id, l.topic_id, t.grade_id
    from public.rag_chunks rc
    join public.lessons l on l.id = rc.lesson_id
    join public.topics t on t.id = l.topic_id
    where rc.topic_id is null
      and l.topic_id is not null
    limit row_limit
  )
  update public.rag_chunks rc
  set topic_id = candidates.topic_id,
      grade_id = coalesce(rc.grade_id, candidates.grade_id),
      metadata = coalesce(rc.metadata, '{}'::jsonb) || jsonb_build_object(
        'topic_link_status', 'linked',
        'topic_link_method', 'lesson_id',
        'topic_linked_at', timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
  from candidates
  where rc.id = candidates.id;

  get diagnostics affected = row_count;
  method := 'lesson_id';
  linked_count := affected;
  return next;

  with raw_candidates as (
    select
      rc.id,
      coalesce(
        rc.metadata->>'topic_id',
        rc.metadata->'topic'->>'id',
        rc.metadata->'source'->>'topic_id'
      ) as raw_topic_id
    from public.rag_chunks rc
    where rc.topic_id is null
    limit row_limit
  ),
  candidates as (
    select rc.id, t.id as topic_id, t.grade_id
    from raw_candidates rc
    join public.topics t
      on public.rag_link_is_uuid(rc.raw_topic_id)
     and t.id = rc.raw_topic_id::uuid
  )
  update public.rag_chunks rc
  set topic_id = candidates.topic_id,
      grade_id = coalesce(rc.grade_id, candidates.grade_id),
      metadata = coalesce(rc.metadata, '{}'::jsonb) || jsonb_build_object(
        'topic_link_status', 'linked',
        'topic_link_method', 'metadata_topic_id',
        'topic_linked_at', timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
  from candidates
  where rc.id = candidates.id;

  get diagnostics affected = row_count;
  method := 'metadata_topic_id';
  linked_count := affected;
  return next;

  with chunk_titles as (
    select
      rc.id,
      rc.grade_id,
      public.rag_link_normalize(coalesce(
        rc.title,
        rc.metadata->>'topic_title',
        rc.metadata->>'topic_name',
        rc.metadata->>'topic',
        rc.metadata->>'title',
        rc.metadata->'topic'->>'title',
        rc.metadata->'source'->>'topic_title',
        rc.metadata->'source'->>'title'
      )) as normalized_title
    from public.rag_chunks rc
    where rc.topic_id is null
      and rc.grade_id is not null
    limit row_limit
  ),
  possible_matches as (
    select
      c.id,
      t.id as topic_id,
      t.grade_id
    from chunk_titles c
    join public.topics t
      on t.grade_id = c.grade_id
     and length(public.rag_link_normalize(t.title)) >= 6
     and (
       c.normalized_title = public.rag_link_normalize(t.title)
       or c.normalized_title like '%' || public.rag_link_normalize(t.title) || '%'
     )
    where c.normalized_title <> ''
  ),
  unambiguous as (
    select id, (array_agg(topic_id))[1] as topic_id, (array_agg(grade_id))[1] as grade_id
    from possible_matches
    group by id
    having count(distinct topic_id) = 1
  )
  update public.rag_chunks rc
  set topic_id = unambiguous.topic_id,
      grade_id = coalesce(rc.grade_id, unambiguous.grade_id),
      metadata = coalesce(rc.metadata, '{}'::jsonb) || jsonb_build_object(
        'topic_link_status', 'linked',
        'topic_link_method', 'title_match',
        'topic_linked_at', timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
  from unambiguous
  where rc.id = unambiguous.id;

  get diagnostics affected = row_count;
  method := 'title_match';
  linked_count := affected;
  return next;

  with chunk_subjects as (
    select
      rc.id,
      rc.grade_id,
      public.rag_link_normalize(coalesce(
        rc.metadata->>'subject',
        rc.metadata->>'subject_name',
        rc.metadata->'subject'->>'name',
        rc.metadata->'source'->>'subject',
        rc.metadata->'source'->>'subject_name'
      )) as normalized_subject
    from public.rag_chunks rc
    where rc.topic_id is null
      and rc.grade_id is not null
    limit row_limit
  ),
  possible_matches as (
    select c.id, t.id as topic_id, t.grade_id
    from chunk_subjects c
    join public.subjects s
      on c.normalized_subject <> ''
     and public.rag_link_normalize(s.name) = c.normalized_subject
    join public.topics t
      on t.grade_id = c.grade_id
     and t.subject_id = s.id
  ),
  unambiguous as (
    select id, (array_agg(topic_id))[1] as topic_id, (array_agg(grade_id))[1] as grade_id
    from possible_matches
    group by id
    having count(distinct topic_id) = 1
  )
  update public.rag_chunks rc
  set topic_id = unambiguous.topic_id,
      grade_id = coalesce(rc.grade_id, unambiguous.grade_id),
      metadata = coalesce(rc.metadata, '{}'::jsonb) || jsonb_build_object(
        'topic_link_status', 'linked',
        'topic_link_method', 'single_topic_for_grade_subject',
        'topic_linked_at', timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
  from unambiguous
  where rc.id = unambiguous.id;

  get diagnostics affected = row_count;
  method := 'single_topic_for_grade_subject';
  linked_count := affected;
  return next;

  update public.rag_chunks
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'topic_link_status', 'unmatched',
        'topic_link_reason', 'no safe topic match',
        'topic_linked_at', timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
  where topic_id is null
    and coalesce(metadata->>'topic_link_status', '') <> 'unmatched';

  get diagnostics affected = row_count;
  method := 'unmatched';
  linked_count := affected;
  return next;
end;
$$;

revoke all on function public.repair_rag_chunk_topic_links(integer) from public;
grant execute on function public.repair_rag_chunk_topic_links(integer) to service_role;

create or replace view public.rag_chunk_health
with (security_invoker = true)
as
select
  count(*)::integer as total_chunks,
  count(*) filter (
    where content is not null
      and length(content) > 100
      and topic_id is not null
      and grade_id is not null
      and embedding_status = 'done'
      and embedding is not null
  )::integer as usable_chunks,
  count(*) filter (where topic_id is not null)::integer as with_topic_id,
  count(*) filter (where grade_id is not null)::integer as with_grade_id,
  count(*) filter (where topic_id is null)::integer as without_topic_id,
  count(*) filter (where embedding is not null)::integer as with_embedding,
  count(*) filter (where embedding_status = 'done')::integer as embedding_done,
  count(*) filter (where embedding_status = 'pending')::integer as embedding_pending,
  count(*) filter (where embedding_status = 'failed')::integer as embedding_failed,
  count(*) filter (where content is null or length(content) <= 100)::integer as short_content,
  count(*) filter (where metadata->>'topic_link_method' = 'lesson_id')::integer as linked_by_lesson,
  count(*) filter (where metadata->>'topic_link_method' in ('metadata_topic_id', 'title_match', 'single_topic_for_grade_subject'))::integer as linked_by_metadata,
  count(*) filter (where metadata->>'topic_link_status' = 'unmatched')::integer as unmatched
from public.rag_chunks;


