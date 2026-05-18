-- AI observability verification for one real generate-lessons execution.
-- Optional: bind a specific queue job before running the checks:
-- select set_config('app.validation_job_id', '<lesson_gen_queue.id>', false);
--
-- Leave app.validation_job_id unset to inspect the latest lesson_generation_run snapshot.

with target_run as (
  select
    task_id,
    snapshot_data->>'run_id' as run_id,
    snapshot_data->>'job_id' as job_id,
    snapshot_data->>'topic_id' as topic_id,
    created_at
  from public.ai_execution_snapshots
  where snapshot_type = 'lesson_generation_run'
    and (
      coalesce(current_setting('app.validation_job_id', true), '') = ''
      or snapshot_data->>'job_id' = current_setting('app.validation_job_id', true)
    )
  order by created_at desc
  limit 1
)
select
  'snapshot_created' as check_name,
  count(*) as matching_snapshots,
  min(run_id) as run_id,
  min(job_id) as job_id,
  min(topic_id) as topic_id
from target_run;

with target_run as (
  select task_id
  from public.ai_execution_snapshots
  where snapshot_type = 'lesson_generation_run'
    and (
      coalesce(current_setting('app.validation_job_id', true), '') = ''
      or snapshot_data->>'job_id' = current_setting('app.validation_job_id', true)
    )
  order by created_at desc
  limit 1
)
select
  l.created_at,
  l.log_type,
  l.message,
  l.metadata->>'job_id' as job_id,
  l.metadata->>'topic_id' as topic_id,
  l.metadata->>'model' as model,
  l.metadata->>'duration_ms' as duration_ms
from public.ai_task_logs l
join target_run r on r.task_id = l.task_id
order by l.created_at asc;

with required_events(event_name) as (
  values
    ('job_claimed'),
    ('generation_started'),
    ('rag_context_selected'),
    ('model_called'),
    ('lesson_inserted'),
    ('lesson_blocks_inserted'),
    ('job_completed')
),
target_run as (
  select task_id
  from public.ai_execution_snapshots
  where snapshot_type = 'lesson_generation_run'
    and (
      coalesce(current_setting('app.validation_job_id', true), '') = ''
      or snapshot_data->>'job_id' = current_setting('app.validation_job_id', true)
    )
  order by created_at desc
  limit 1
),
observed_events as (
  select distinct l.log_type
  from public.ai_task_logs l
  join target_run r on r.task_id = l.task_id
)
select
  e.event_name,
  case when o.log_type is null then 'missing' else 'present' end as status
from required_events e
left join observed_events o on o.log_type = e.event_name
order by e.event_name;

with target_run as (
  select task_id
  from public.ai_execution_snapshots
  where snapshot_type = 'lesson_generation_run'
    and (
      coalesce(current_setting('app.validation_job_id', true), '') = ''
      or snapshot_data->>'job_id' = current_setting('app.validation_job_id', true)
    )
  order by created_at desc
  limit 1
)
select
  l.created_at,
  l.message,
  l.metadata->>'error_message' as error_message,
  l.metadata->>'error_code' as error_code,
  l.metadata->>'duration_ms' as duration_ms,
  l.metadata->>'job_id' as job_id,
  l.metadata->>'topic_id' as topic_id,
  l.metadata->>'model' as model
from public.ai_task_logs l
join target_run r on r.task_id = l.task_id
where l.log_type = 'job_failed'
order by l.created_at desc;
