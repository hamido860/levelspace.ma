create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_severity' and n.nspname = 'public'
  ) then
    create type public.ai_severity as enum ('critical', 'high', 'medium', 'low');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_task_status' and n.nspname = 'public'
  ) then
    create type public.ai_task_status as enum (
      'pending',
      'planning',
      'auditing',
      'waiting_for_chunks',
      'waiting_approval',
      'running',
      'validating',
      'completed',
      'failed',
      'blocked',
      'permanent_failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_issue_status' and n.nspname = 'public'
  ) then
    create type public.ai_issue_status as enum (
      'open',
      'planning',
      'auditing',
      'waiting_approval',
      'running',
      'blocked',
      'fixed',
      'resolved'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_execution_mode' and n.nspname = 'public'
  ) then
    create type public.ai_execution_mode as enum ('dry_run', 'execute_with_approval', 'execute');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_safety_level' and n.nspname = 'public'
  ) then
    create type public.ai_safety_level as enum ('read_only', 'write_allowed', 'destructive_blocked');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_risk_level' and n.nspname = 'public'
  ) then
    create type public.ai_risk_level as enum ('low', 'medium', 'high', 'critical');
  end if;
end
$$;

create table if not exists public.ai_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity public.ai_severity not null default 'medium',
  issue_type text not null default 'audit',
  affected_area text not null default 'supabase_schema',
  evidence jsonb not null default '{}'::jsonb,
  impact text,
  suggested_action text,
  status public.ai_issue_status not null default 'open',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.ai_issues
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists impact text,
  add column if not exists suggested_action text,
  add column if not exists description text,
  add column if not exists source text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists error_signature text;

update public.ai_issues
set issue_type = coalesce(nullif(issue_type, ''), 'audit'),
    affected_area = coalesce(nullif(affected_area, ''), 'supabase_schema'),
    evidence = case
      when evidence = '{}'::jsonb and metadata <> '{}'::jsonb then metadata
      else evidence
    end,
    impact = coalesce(impact, description),
    suggested_action = coalesce(suggested_action, nullif(description, ''))
where true;

alter table public.ai_issues
  alter column severity type public.ai_severity using severity::text::public.ai_severity,
  alter column severity set default 'medium',
  alter column issue_type set default 'audit',
  alter column affected_area set default 'supabase_schema',
  alter column status type public.ai_issue_status using status::text::public.ai_issue_status,
  alter column status set default 'open';

alter table public.ai_issues
  alter column issue_type set not null,
  alter column affected_area set not null;

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.ai_issues(id) on delete cascade,
  task_name text not null,
  task_type text not null default 'manual',
  priority text not null default 'medium',
  assigned_agent text not null default 'Planner Agent',
  execution_mode public.ai_execution_mode not null default 'execute_with_approval',
  safety_level public.ai_safety_level not null default 'destructive_blocked',
  target_area text not null default 'supabase_schema',
  instructions text,
  status public.ai_task_status not null default 'pending',
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  requires_approval boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.ai_tasks
  add column if not exists task_name text,
  add column if not exists task_type text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists assigned_agent text,
  add column if not exists assigned_to text,
  add column if not exists target_area text,
  add column if not exists instructions text,
  add column if not exists progress int not null default 0,
  add column if not exists requires_approval boolean not null default true,
  add column if not exists error_data jsonb not null default '{}'::jsonb,
  add column if not exists input_data jsonb not null default '{}'::jsonb,
  add column if not exists output_data jsonb not null default '{}'::jsonb;

do $$
declare
  priority_type text;
begin
  select data_type
  into priority_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ai_tasks'
    and column_name = 'priority';

  if priority_type in ('smallint', 'integer', 'bigint', 'numeric') then
    execute $sql$
      alter table public.ai_tasks
      alter column priority type text
      using (
        case
          when priority is null then 'medium'
          when priority >= 90 then 'critical'
          when priority >= 70 then 'high'
          when priority >= 40 then 'medium'
          else 'low'
        end
      )
    $sql$;
  else
    execute $sql$
      alter table public.ai_tasks
      alter column priority type text
      using (
        case
          when priority is null then 'medium'
          when lower(trim(priority::text)) in ('critical', 'high', 'medium', 'low') then lower(trim(priority::text))
          when trim(priority::text) ~ '^\d+$' then
            case
              when (trim(priority::text))::integer >= 90 then 'critical'
              when (trim(priority::text))::integer >= 70 then 'high'
              when (trim(priority::text))::integer >= 40 then 'medium'
              else 'low'
            end
          else 'medium'
        end
      )
    $sql$;
  end if;
end
$$;

update public.ai_tasks t
set task_name = coalesce(nullif(task_name, ''), nullif(title, ''), 'Untitled AI task'),
    title = coalesce(nullif(title, ''), nullif(task_name, ''), 'Untitled AI task'),
    task_type = coalesce(nullif(task_type, ''), 'manual'),
    priority = coalesce(
      nullif(priority, ''),
      case
        when coalesce(i.severity::text, 'medium') = 'critical' then 'critical'
        when coalesce(i.severity::text, 'medium') = 'high' then 'high'
        when coalesce(i.severity::text, 'medium') = 'low' then 'low'
        else 'medium'
      end
    ),
    assigned_agent = coalesce(nullif(assigned_agent, ''), nullif(assigned_to, ''), 'Planner Agent'),
    target_area = coalesce(nullif(target_area, ''), nullif(i.affected_area, ''), 'supabase_schema'),
    instructions = coalesce(instructions, nullif(description, '')),
    progress = coalesce(progress, 0),
    requires_approval = coalesce(
      requires_approval,
      execution_mode::text = 'execute_with_approval' or safety_level::text <> 'read_only'
    )
from public.ai_issues i
where t.issue_id is not distinct from i.id;

update public.ai_tasks
set task_name = coalesce(nullif(task_name, ''), nullif(title, ''), 'Untitled AI task'),
    title = coalesce(nullif(title, ''), nullif(task_name, ''), 'Untitled AI task'),
    task_type = coalesce(nullif(task_type, ''), 'manual'),
    priority = coalesce(nullif(priority, ''), 'medium'),
    assigned_agent = coalesce(nullif(assigned_agent, ''), nullif(assigned_to, ''), 'Planner Agent'),
    target_area = coalesce(nullif(target_area, ''), 'supabase_schema'),
    progress = coalesce(progress, 0),
    requires_approval = coalesce(
      requires_approval,
      execution_mode::text = 'execute_with_approval' or safety_level::text <> 'read_only'
    )
where issue_id is null;

alter table public.ai_tasks
  alter column title set default 'Untitled AI task',
  alter column task_name set default 'Untitled AI task',
  alter column task_type set default 'manual',
  alter column priority set default 'medium',
  alter column assigned_agent set default 'Planner Agent',
  alter column target_area set default 'supabase_schema',
  alter column execution_mode type public.ai_execution_mode using execution_mode::text::public.ai_execution_mode,
  alter column execution_mode set default 'execute_with_approval',
  alter column safety_level type public.ai_safety_level using safety_level::text::public.ai_safety_level,
  alter column safety_level set default 'destructive_blocked',
  alter column status type public.ai_task_status using status::text::public.ai_task_status,
  alter column status set default 'pending',
  alter column progress set default 0,
  alter column requires_approval set default true;

alter table public.ai_tasks
  drop constraint if exists ai_tasks_priority_check;

alter table public.ai_tasks
  add constraint ai_tasks_priority_check
  check (priority in ('critical', 'high', 'medium', 'low'));

alter table public.ai_tasks
  alter column title set not null,
  alter column task_name set not null,
  alter column task_type set not null,
  alter column priority set not null,
  alter column assigned_agent set not null,
  alter column target_area set not null,
  alter column progress set not null,
  alter column requires_approval set not null;

do $$
declare
  has_null_issue_refs boolean;
begin
  select exists(select 1 from public.ai_tasks where issue_id is null)
  into has_null_issue_refs;

  if not has_null_issue_refs then
    alter table public.ai_tasks
      alter column issue_id set not null;
  end if;
end
$$;

alter table public.ai_tasks
  drop constraint if exists ai_tasks_issue_id_fkey;

alter table public.ai_tasks
  add constraint ai_tasks_issue_id_fkey
  foreign key (issue_id) references public.ai_issues(id) on delete cascade;

create table if not exists public.ai_task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_tasks(id) on delete cascade,
  agent_name text not null,
  log_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_task_approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_tasks(id) on delete cascade,
  proposed_action text not null default 'Approve guarded AI action.',
  risk_level public.ai_risk_level not null default 'medium',
  sql_preview text,
  affected_records int,
  rollback_plan text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.ai_task_approvals
  add column if not exists proposed_action text,
  add column if not exists sql_preview text,
  add column if not exists affected_records int,
  add column if not exists rollback_plan text,
  add column if not exists status text,
  add column if not exists approval_status text,
  add column if not exists approval_reason text,
  add column if not exists rejection_reason text,
  add column if not exists decided_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

update public.ai_task_approvals
set proposed_action = coalesce(nullif(proposed_action, ''), approval_reason, 'Approve guarded AI action.'),
    status = coalesce(nullif(status, ''), approval_status, 'pending'),
    approved_at = coalesce(approved_at, decided_at),
    rollback_plan = coalesce(rollback_plan, 'Restore affected records from the latest execution snapshot before retrying.'),
    updated_at = coalesce(updated_at, created_at, timezone('utc'::text, now()))
where true;

alter table public.ai_task_approvals
  alter column proposed_action set default 'Approve guarded AI action.',
  alter column proposed_action set not null,
  alter column risk_level type public.ai_risk_level using risk_level::text::public.ai_risk_level,
  alter column risk_level set default 'medium',
  alter column status set default 'pending',
  alter column updated_at set default timezone('utc'::text, now());

alter table public.ai_task_approvals
  drop constraint if exists ai_task_approvals_status_check;

alter table public.ai_task_approvals
  add constraint ai_task_approvals_status_check
  check (status in ('pending', 'approved', 'rejected'));

create table if not exists public.ai_execution_snapshots (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_tasks(id) on delete cascade,
  snapshot_type text not null,
  target_table text,
  record_count int,
  snapshot_data jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_issue_patterns (
  id uuid primary key default gen_random_uuid(),
  error_signature text not null unique,
  issue_type text,
  affected_area text,
  known_fix text,
  auto_fixable boolean not null default false,
  risk_level public.ai_risk_level not null default 'medium',
  frequency integer not null default 1 check (frequency >= 1),
  success_rate numeric(5,4) not null default 0 check (success_rate >= 0 and success_rate <= 1),
  first_seen_at timestamptz not null default timezone('utc'::text, now()),
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_monitoring_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'scheduled',
  status text not null default 'completed' check (status in ('scheduled', 'running', 'completed', 'failed')),
  issues_detected integer not null default 0 check (issues_detected >= 0),
  grouped_issues integer not null default 0 check (grouped_issues >= 0),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_rag_health_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.ai_tasks(id) on delete cascade,
  issue_id uuid references public.ai_issues(id) on delete set null,
  grade_id uuid references public.grades(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  status public.ai_task_status not null default 'pending',
  chunk_count integer not null default 0 check (chunk_count >= 0),
  valid_chunk_count integer not null default 0 check (valid_chunk_count >= 0 and valid_chunk_count <= chunk_count),
  minimum_chunk_count integer not null default 1 check (minimum_chunk_count >= 0),
  average_chunk_length integer not null default 0 check (average_chunk_length >= 0),
  relevance_score numeric(5,4) not null default 0 check (relevance_score >= 0 and relevance_score <= 1),
  blocking_reason text,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.ai_rag_health_reports
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.ai_rag_health_reports
  drop constraint if exists ai_rag_health_valid_chunks_check;

alter table public.ai_rag_health_reports
  add constraint ai_rag_health_valid_chunks_check
  check (valid_chunk_count <= chunk_count);

create index if not exists ai_issues_status_idx on public.ai_issues(status);
create index if not exists ai_issues_severity_idx on public.ai_issues(severity);
create index if not exists ai_issues_error_signature_idx on public.ai_issues(error_signature);
create index if not exists ai_tasks_issue_id_idx on public.ai_tasks(issue_id);
create index if not exists ai_tasks_status_idx on public.ai_tasks(status);
create index if not exists ai_tasks_assigned_agent_idx on public.ai_tasks(assigned_agent);
create index if not exists ai_tasks_priority_idx on public.ai_tasks(priority);
create index if not exists ai_task_logs_task_id_created_at_idx on public.ai_task_logs(task_id, created_at);
create index if not exists ai_task_approvals_task_id_idx on public.ai_task_approvals(task_id);
create index if not exists ai_task_approvals_status_idx on public.ai_task_approvals(status);
create index if not exists ai_execution_snapshots_task_id_idx on public.ai_execution_snapshots(task_id);
create index if not exists ai_issue_patterns_risk_level_idx on public.ai_issue_patterns(risk_level);
create index if not exists ai_issue_patterns_last_seen_at_idx on public.ai_issue_patterns(last_seen_at desc);
create index if not exists ai_monitoring_runs_status_started_at_idx on public.ai_monitoring_runs(status, started_at desc);
create index if not exists ai_rag_health_reports_task_id_idx on public.ai_rag_health_reports(task_id);
create index if not exists ai_rag_health_reports_issue_id_idx on public.ai_rag_health_reports(issue_id);
create index if not exists ai_rag_health_reports_topic_id_idx on public.ai_rag_health_reports(topic_id);
create index if not exists ai_rag_health_reports_status_idx on public.ai_rag_health_reports(status);

drop trigger if exists trg_ai_issues_set_updated_at on public.ai_issues;
create trigger trg_ai_issues_set_updated_at
before update on public.ai_issues
for each row
execute function public.set_updated_at();

drop trigger if exists trg_ai_tasks_set_updated_at on public.ai_tasks;
create trigger trg_ai_tasks_set_updated_at
before update on public.ai_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_ai_task_approvals_set_updated_at on public.ai_task_approvals;
create trigger trg_ai_task_approvals_set_updated_at
before update on public.ai_task_approvals
for each row
execute function public.set_updated_at();

drop trigger if exists trg_ai_issue_patterns_set_updated_at on public.ai_issue_patterns;
create trigger trg_ai_issue_patterns_set_updated_at
before update on public.ai_issue_patterns
for each row
execute function public.set_updated_at();

drop trigger if exists trg_ai_rag_health_reports_set_updated_at on public.ai_rag_health_reports;
create trigger trg_ai_rag_health_reports_set_updated_at
before update on public.ai_rag_health_reports
for each row
execute function public.set_updated_at();
