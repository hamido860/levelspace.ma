begin;

do $$
declare
  v_issue_id uuid;
  v_run_id uuid;
  v_pattern_id uuid;
  v_report_id uuid;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_monitoring_runs'
  ) then
    raise exception 'ai_monitoring_runs table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_issue_patterns'
  ) then
    raise exception 'ai_issue_patterns table is missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_rag_health_reports'
  ) then
    raise exception 'ai_rag_health_reports table is missing';
  end if;

  insert into public.ai_monitoring_runs (
    run_type,
    status,
    issues_detected,
    grouped_issues,
    metadata
  )
  values (
    'manual',
    'running',
    0,
    0,
    jsonb_build_object('phase', 4, 'source', 'validation')
  )
  returning id into v_run_id;

  insert into public.ai_issues (
    title,
    severity,
    issue_type,
    affected_area,
    evidence,
    impact,
    suggested_action,
    error_signature,
    status
  )
  values (
    'phase4_dummy_monitoring_issue',
    'high',
    'audit',
    'rag_chunks',
    jsonb_build_object('phase', 4, 'chunks_found', 0),
    'Validation issue for monitoring persistence.',
    'Create a monitoring issue and attach a RAG health report.',
    'phase4_dummy_monitoring_signature',
    'open'
  )
  returning id into v_issue_id;

  insert into public.ai_issue_patterns (
    error_signature,
    issue_type,
    affected_area,
    known_fix,
    auto_fixable,
    risk_level,
    frequency,
    success_rate,
    metadata
  )
  values (
    'phase4_dummy_monitoring_signature',
    'audit',
    'rag_chunks',
    'Repair chunk coverage before generation.',
    false,
    'high',
    1,
    0,
    jsonb_build_object('phase', 4)
  )
  returning id into v_pattern_id;

  insert into public.ai_rag_health_reports (
    task_id,
    issue_id,
    grade_id,
    subject_id,
    topic_id,
    lesson_id,
    status,
    chunk_count,
    valid_chunk_count,
    minimum_chunk_count,
    average_chunk_length,
    relevance_score,
    blocking_reason,
    report_data
  )
  values (
    null,
    v_issue_id,
    null,
    null,
    null,
    null,
    'blocked',
    0,
    0,
    1,
    0,
    0,
    'Validation blocking reason for Phase 4.',
    jsonb_build_object('phase', 4, 'status', 'blocked')
  )
  returning id into v_report_id;

  update public.ai_monitoring_runs
  set status = 'completed',
      issues_detected = 1,
      grouped_issues = 1,
      completed_at = timezone('utc'::text, now()),
      metadata = jsonb_build_object('phase', 4, 'issue_id', v_issue_id, 'report_id', v_report_id)
  where id = v_run_id;

  if v_run_id is null then
    raise exception 'Monitoring run insert failed';
  end if;

  if v_issue_id is null then
    raise exception 'Monitoring issue insert failed';
  end if;

  if v_pattern_id is null then
    raise exception 'Issue pattern insert failed';
  end if;

  if v_report_id is null then
    raise exception 'RAG health report insert failed';
  end if;
end
$$;

rollback;

select 'Phase 4 monitoring validation passed' as status;
