do $$
declare
  missing_count integer;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    raise exception 'profiles.role column is missing';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin_user'
  ) then
    raise exception 'public.is_admin_user(uuid) function is missing';
  end if;

  select count(*)
  into missing_count
  from (
    values
      ('ai_issues'),
      ('ai_tasks'),
      ('ai_task_logs'),
      ('ai_task_approvals'),
      ('ai_execution_snapshots'),
      ('ai_issue_patterns'),
      ('ai_monitoring_runs'),
      ('ai_rag_health_reports')
  ) as required_tables(table_name)
  left join pg_class c
    on c.relname = required_tables.table_name
  left join pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and coalesce(c.relrowsecurity, false) = false;

  if missing_count <> 0 then
    raise exception 'One or more AI ops tables do not have RLS enabled';
  end if;

  select count(*)
  into missing_count
  from (
    values
      ('public', 'ai_issues', 'ai_admin_select_issues'),
      ('public', 'ai_issues', 'ai_admin_insert_issues'),
      ('public', 'ai_issues', 'ai_admin_update_issues'),
      ('public', 'ai_tasks', 'ai_admin_select_tasks'),
      ('public', 'ai_tasks', 'ai_admin_insert_tasks'),
      ('public', 'ai_tasks', 'ai_admin_update_tasks'),
      ('public', 'ai_task_logs', 'ai_admin_select_task_logs'),
      ('public', 'ai_task_logs', 'ai_admin_insert_task_logs'),
      ('public', 'ai_task_logs', 'ai_admin_update_task_logs'),
      ('public', 'ai_task_approvals', 'ai_admin_select_task_approvals'),
      ('public', 'ai_task_approvals', 'ai_admin_insert_task_approvals'),
      ('public', 'ai_task_approvals', 'ai_admin_update_task_approvals')
  ) as required_policies(schemaname, tablename, policyname)
  left join pg_policies p
    on p.schemaname = required_policies.schemaname
   and p.tablename = required_policies.tablename
   and p.policyname = required_policies.policyname
  where p.policyname is null;

  if missing_count <> 0 then
    raise exception 'One or more required AI ops admin policies are missing';
  end if;
end
$$;

select 'Phase 2 database security validation passed' as status;
