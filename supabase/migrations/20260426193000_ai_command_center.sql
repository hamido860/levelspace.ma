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

create table if not exists public.ai_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  issue_type text not null,
  affected_area text not null,
  evidence jsonb not null default '{}'::jsonb,
  impact text,
  suggested_action text,
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.ai_issues(id) on delete cascade,
  task_name text not null,
  task_type text not null,
  priority text not null,
  assigned_agent text not null,
  execution_mode text not null,
  safety_level text not null,
  target_area text not null,
  instructions text,
  status text not null default 'pending',
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  requires_approval boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

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
  proposed_action text not null,
  risk_level text not null,
  sql_preview text,
  affected_records int,
  rollback_plan text,
  status text not null default 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ai_execution_snapshots (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_tasks(id) on delete cascade,
  snapshot_type text not null,
  target_table text,
  record_count int,
  snapshot_data jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists ai_issues_status_idx on public.ai_issues(status);
create index if not exists ai_issues_severity_idx on public.ai_issues(severity);
create index if not exists ai_tasks_issue_id_idx on public.ai_tasks(issue_id);
create index if not exists ai_tasks_status_idx on public.ai_tasks(status);
create index if not exists ai_tasks_assigned_agent_idx on public.ai_tasks(assigned_agent);
create index if not exists ai_task_logs_task_id_created_at_idx on public.ai_task_logs(task_id, created_at);
create index if not exists ai_task_approvals_task_id_idx on public.ai_task_approvals(task_id);
create index if not exists ai_task_approvals_status_idx on public.ai_task_approvals(status);
create index if not exists ai_execution_snapshots_task_id_idx on public.ai_execution_snapshots(task_id);

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
