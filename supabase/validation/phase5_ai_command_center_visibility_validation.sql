do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_monitoring_runs'
      and column_name = 'started_at'
  ) then
    raise exception 'ai_monitoring_runs.started_at column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_monitoring_runs'
      and column_name = 'issues_detected'
  ) then
    raise exception 'ai_monitoring_runs.issues_detected column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_issue_patterns'
      and column_name = 'frequency'
  ) then
    raise exception 'ai_issue_patterns.frequency column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_issue_patterns'
      and column_name = 'last_seen_at'
  ) then
    raise exception 'ai_issue_patterns.last_seen_at column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_rag_health_reports'
      and column_name = 'relevance_score'
  ) then
    raise exception 'ai_rag_health_reports.relevance_score column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_rag_health_reports'
      and column_name = 'blocking_reason'
  ) then
    raise exception 'ai_rag_health_reports.blocking_reason column is missing';
  end if;
end
$$;

select 'Phase 5 visibility validation passed' as status;
