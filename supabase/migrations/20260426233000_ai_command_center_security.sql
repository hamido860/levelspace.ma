alter table public.profiles
  add column if not exists role text not null default 'user';

update public.profiles
set role = case
  when role is null or btrim(role) = '' then 'user'
  else lower(btrim(role))
end;

create or replace function public.is_admin_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and lower(coalesce(role, 'user')) = 'admin'
  );
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to authenticated, service_role;

alter table public.ai_issues enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.ai_task_logs enable row level security;
alter table public.ai_task_approvals enable row level security;
alter table public.ai_execution_snapshots enable row level security;
alter table public.ai_issue_patterns enable row level security;
alter table public.ai_monitoring_runs enable row level security;
alter table public.ai_rag_health_reports enable row level security;

drop policy if exists "ai_admin_select_issues" on public.ai_issues;
create policy "ai_admin_select_issues"
  on public.ai_issues
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_issues" on public.ai_issues;
create policy "ai_admin_insert_issues"
  on public.ai_issues
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_issues" on public.ai_issues;
create policy "ai_admin_update_issues"
  on public.ai_issues
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_tasks" on public.ai_tasks;
create policy "ai_admin_select_tasks"
  on public.ai_tasks
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_tasks" on public.ai_tasks;
create policy "ai_admin_insert_tasks"
  on public.ai_tasks
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_tasks" on public.ai_tasks;
create policy "ai_admin_update_tasks"
  on public.ai_tasks
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_task_logs" on public.ai_task_logs;
create policy "ai_admin_select_task_logs"
  on public.ai_task_logs
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_task_logs" on public.ai_task_logs;
create policy "ai_admin_insert_task_logs"
  on public.ai_task_logs
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_task_logs" on public.ai_task_logs;
create policy "ai_admin_update_task_logs"
  on public.ai_task_logs
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_task_approvals" on public.ai_task_approvals;
create policy "ai_admin_select_task_approvals"
  on public.ai_task_approvals
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_task_approvals" on public.ai_task_approvals;
create policy "ai_admin_insert_task_approvals"
  on public.ai_task_approvals
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_task_approvals" on public.ai_task_approvals;
create policy "ai_admin_update_task_approvals"
  on public.ai_task_approvals
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_execution_snapshots" on public.ai_execution_snapshots;
create policy "ai_admin_select_execution_snapshots"
  on public.ai_execution_snapshots
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_execution_snapshots" on public.ai_execution_snapshots;
create policy "ai_admin_insert_execution_snapshots"
  on public.ai_execution_snapshots
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_execution_snapshots" on public.ai_execution_snapshots;
create policy "ai_admin_update_execution_snapshots"
  on public.ai_execution_snapshots
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_issue_patterns" on public.ai_issue_patterns;
create policy "ai_admin_select_issue_patterns"
  on public.ai_issue_patterns
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_issue_patterns" on public.ai_issue_patterns;
create policy "ai_admin_insert_issue_patterns"
  on public.ai_issue_patterns
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_issue_patterns" on public.ai_issue_patterns;
create policy "ai_admin_update_issue_patterns"
  on public.ai_issue_patterns
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_monitoring_runs" on public.ai_monitoring_runs;
create policy "ai_admin_select_monitoring_runs"
  on public.ai_monitoring_runs
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_monitoring_runs" on public.ai_monitoring_runs;
create policy "ai_admin_insert_monitoring_runs"
  on public.ai_monitoring_runs
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_monitoring_runs" on public.ai_monitoring_runs;
create policy "ai_admin_update_monitoring_runs"
  on public.ai_monitoring_runs
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "ai_admin_select_rag_health_reports" on public.ai_rag_health_reports;
create policy "ai_admin_select_rag_health_reports"
  on public.ai_rag_health_reports
  for select
  using (public.is_admin_user());

drop policy if exists "ai_admin_insert_rag_health_reports" on public.ai_rag_health_reports;
create policy "ai_admin_insert_rag_health_reports"
  on public.ai_rag_health_reports
  for insert
  with check (public.is_admin_user());

drop policy if exists "ai_admin_update_rag_health_reports" on public.ai_rag_health_reports;
create policy "ai_admin_update_rag_health_reports"
  on public.ai_rag_health_reports
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());
