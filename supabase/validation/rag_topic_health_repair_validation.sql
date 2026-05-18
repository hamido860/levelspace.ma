-- Non-destructive RAG health validation.
-- Run after applying 20260517183000_rag_chunk_topic_health_and_repair.sql.

with canonical as (
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
    count(*) filter (where embedding is not null)::integer as with_embedding,
    count(*) filter (where embedding_status = 'done')::integer as embedding_done,
    count(*) filter (where embedding_status = 'pending')::integer as embedding_pending,
    count(*) filter (where embedding_status = 'failed')::integer as embedding_failed,
    count(*) filter (where content is null or length(content) <= 100)::integer as short_content
  from public.rag_chunks
),
health as (
  select *
  from public.rag_chunk_health
)
select
  'health_matches_canonical_counts' as check_name,
  (
    health.total_chunks = canonical.total_chunks
    and health.usable_chunks = canonical.usable_chunks
    and health.with_topic_id = canonical.with_topic_id
    and health.with_embedding = canonical.with_embedding
    and health.embedding_done = canonical.embedding_done
    and health.embedding_pending = canonical.embedding_pending
    and health.embedding_failed = canonical.embedding_failed
    and health.short_content = canonical.short_content
  ) as passed,
  jsonb_build_object('health', to_jsonb(health), 'canonical', to_jsonb(canonical)) as details
from health, canonical

union all

select
  'embedded_count_does_not_exceed_total' as check_name,
  embedding_done <= total_chunks as passed,
  to_jsonb(public.rag_chunk_health.*) as details
from public.rag_chunk_health

union all

select
  'linked_chunks_have_real_topic_rows' as check_name,
  not exists (
    select 1
    from public.rag_chunks rc
    left join public.topics t on t.id = rc.topic_id
    where rc.topic_id is not null
      and t.id is null
  ) as passed,
  jsonb_build_object(
    'invalid_link_count',
    (
      select count(*)
      from public.rag_chunks rc
      left join public.topics t on t.id = rc.topic_id
      where rc.topic_id is not null
        and t.id is null
    )
  ) as details

union all

select
  'invalid_metadata_topic_ids_stay_unlinked' as check_name,
  not exists (
    select 1
    from public.rag_chunks rc
    where rc.topic_id is not null
      and public.rag_link_is_uuid(coalesce(rc.metadata->>'topic_id', '')) = false
      and rc.metadata ? 'topic_id'
      and rc.metadata->>'topic_link_method' = 'metadata_topic_id'
  ) as passed,
  jsonb_build_object(
    'bad_metadata_links',
    (
      select count(*)
      from public.rag_chunks rc
      where rc.topic_id is not null
        and public.rag_link_is_uuid(coalesce(rc.metadata->>'topic_id', '')) = false
        and rc.metadata ? 'topic_id'
        and rc.metadata->>'topic_link_method' = 'metadata_topic_id'
    )
  ) as details

union all

select
  'unmatched_chunks_have_no_topic_id' as check_name,
  not exists (
    select 1
    from public.rag_chunks
    where metadata->>'topic_link_status' = 'unmatched'
      and topic_id is not null
  ) as passed,
  jsonb_build_object(
    'unmatched_with_topic_id',
    (
      select count(*)
      from public.rag_chunks
      where metadata->>'topic_link_status' = 'unmatched'
        and topic_id is not null
    )
  ) as details

union all

select
  'usable_excludes_missing_embeddings_or_topics' as check_name,
  not exists (
    select 1
    from public.rag_chunks
    where content is not null
      and length(content) > 100
      and grade_id is not null
      and embedding_status = 'done'
      and (topic_id is null or embedding is null)
      and id in (
        select id
        from public.rag_chunks
        where topic_id is not null
          and embedding is not null
      )
  ) as passed,
  jsonb_build_object(
    'usable_chunks',
    (select usable_chunks from public.rag_chunk_health),
    'without_topic_id',
    (select without_topic_id from public.rag_chunk_health),
    'with_embedding',
    (select with_embedding from public.rag_chunk_health)
  ) as details;
