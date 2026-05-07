begin;

do $$
declare
  v_issue_id uuid;
  v_task_id uuid;
  v_log_id uuid;
  v_dummy_issue_title text := 'phase1_dummy_issue';
  v_invalid_issue_status_failed boolean := false;
  v_invalid_task_status_failed boolean := false;
  v_invalid_fk_failed boolean := false;
  v_remaining_tasks integer;
  v_remaining_logs integer;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_issues'
  ) then
    raise exception 'ai_issues table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_tasks'
  ) then
    raise exception 'ai_tasks table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_task_logs'
  ) then
    raise exception 'ai_task_logs table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_task_approvals'
  ) then
    raise exception 'ai_task_approvals table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_execution_snapshots'
  ) then
    raise exception 'ai_execution_snapshots table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_issue_patterns'
  ) then
    raise exception 'ai_issue_patterns table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_monitoring_runs'
  ) then
    raise exception 'ai_monitoring_runs table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_rag_health_reports'
  ) then
    raise exception 'ai_rag_health_reports table is missing';
  end if;

  begin
    execute $sql$
      insert into public.ai_issues (
        title, severity, issue_type, affected_area, evidence, status
      )
      values (
        'invalid_issue_status',
        'medium',
        'audit',
        'supabase_schema',
        '{}'::jsonb,
        'not_a_real_status'
      )
    $sql$;
  exception
    when others then
      v_invalid_issue_status_failed := true;
  end;

  if not v_invalid_issue_status_failed then
    raise exception 'Issue status constraint did not reject an invalid value';
  end if;

  begin
    execute $sql$
      insert into public.ai_tasks (
        issue_id,
        task_name,
        task_type,
        priority,
        assigned_agent,
        execution_mode,
        safety_level,
        target_area,
        status,
        requires_approval
      )
      values (
        gen_random_uuid(),
        'invalid_fk_task',
        'audit',
        'medium',
        'Planner Agent',
        'dry_run',
        'read_only',
        'supabase_schema',
        'pending',
        false
      )
    $sql$;
  exception
    when others then
      v_invalid_fk_failed := true;
  end;

  if not v_invalid_fk_failed then
    raise exception 'Task foreign key did not reject a missing ai_issues row';
  end if;

  insert into public.ai_issues (
    title,
    severity,
    issue_type,
    affected_area,
    evidence,
    impact,
    suggested_action,
    status
  )
  values (
    v_dummy_issue_title,
    'medium',
    'audit',
    'supabase_schema',
    jsonb_build_object('phase', 1),
    'Validation issue for phase 1.',
    'Create a dummy read-only audit task.',
    'open'
  )
  returning id into v_issue_id;

  begin
    execute format(
      $sql$
      insert into public.ai_tasks (
        issue_id,
        task_name,
        task_type,
        priority,
        assigned_agent,
        execution_mode,
        safety_level,
        target_area,
        status,
        requires_approval
      )
      values (
        %L::uuid,
        'invalid_task_status',
        'audit',
        'medium',
        'Planner Agent',
        'dry_run',
        'read_only',
        'supabase_schema',
        'not_a_real_status',
        false
      )
      $sql$,
      v_issue_id::text
    );
  exception
    when others then
      v_invalid_task_status_failed := true;
  end;

  if not v_invalid_task_status_failed then
    raise exception 'Task status constraint did not reject an invalid value';
  end if;

  insert into public.ai_tasks (
    issue_id,
    task_name,
    task_type,
    priority,
    assigned_agent,
    execution_mode,
    safety_level,
    target_area,
    instructions,
    status,
    progress,
    requires_approval
  )
  values (
    v_issue_id,
    'phase1_dummy_task',
    'audit',
    'medium',
    'Planner Agent',
    'dry_run',
    'read_only',
    'supabase_schema',
    'Validate Phase 1 database foundation.',
    'pending',
    0,
    false
  )
  returning id into v_task_id;

  insert into public.ai_task_logs (
    task_id,
    agent_name,
    log_type,
    message,
    metadata
  )
  values (
    v_task_id,
    'Validator Agent',
    'validation',
    'Phase 1 dummy log created successfully.',
    jsonb_build_object('phase', 1, 'task_id', v_task_id)
  )
  returning id into v_log_id;

  if v_issue_id is null then
    raise exception 'Dummy issue insert failed';
  end if;

  if v_task_id is null then
    raise exception 'Dummy task insert failed';
  end if;

  if v_log_id is null then
    raise exception 'Dummy log insert failed';
  end if;

  delete from public.ai_issues where id = v_issue_id;

  select count(*)
  into v_remaining_tasks
  from public.ai_tasks
  where id = v_task_id;

  if v_remaining_tasks <> 0 then
    raise exception 'Cascade delete failed for ai_tasks';
  end if;

  select count(*)
  into v_remaining_logs
  from public.ai_task_logs
  where id = v_log_id;

  if v_remaining_logs <> 0 then
    raise exception 'Cascade delete failed for ai_task_logs';
  end if;
end
$$;

rollback;

select 'Phase 1 validation passed' as status;
