import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

type JsonRecord = Record<string, any>;

type AdminProfileRow = {
  id: string;
  role: string | null;
};

type ApprovalRow = {
  id: string;
  task_id: string;
  status: string;
  created_at: string;
};

export class AiCommandCenterHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const COMMAND_CENTER_AGENTS = {
  planner: "Planner Agent",
  auditor: "Auditor Agent",
  rag: "RAG Agent",
  sql: "SQL Agent",
  worker: "Worker Agent",
  validator: "Validator Agent",
  reporter: "Reporter Agent",
} as const;

export const DANGEROUS_SQL_KEYWORDS = ["DROP", "TRUNCATE", "DELETE", "ALTER TABLE"];

export const BLOCKING_SQL_PATTERNS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\b/i,
  /\bALTER\s+TABLE\b/i,
];

export const WRITE_SQL_PATTERNS = [/\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bALTER\b/i];

export const MINIMUM_RELEVANCE_SCORE = 0.75;
export const MAX_AUTOMATIC_RETRIES = 3;

type TaskRow = {
  id: string;
  issue_id: string;
  task_name: string;
  task_type: string;
  priority: string;
  assigned_agent: string;
  execution_mode: string;
  safety_level: string;
  target_area: string;
  instructions: string | null;
  status: string;
  progress: number;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
};

type IssueRow = {
  id: string;
  title: string;
  severity: string;
  issue_type: string;
  affected_area: string;
  evidence: JsonRecord | null;
  impact: string | null;
  suggested_action: string | null;
  status: string;
};

export function getServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getPublicSupabaseForAuth(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const authKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !authKey) {
    throw new Error("Supabase auth credentials are not configured.");
  }

  return createClient(url, authKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function getAuthenticatedUser(req: VercelRequest): Promise<User> {
  const token = getBearerToken(req);
  if (!token) {
    throw new AiCommandCenterHttpError(401, "Authentication required.");
  }

  const authSupabase = getPublicSupabaseForAuth();
  const { data, error } = await authSupabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AiCommandCenterHttpError(401, "Invalid or expired authentication token.");
  }

  return data.user;
}

export async function requireAiAdmin(req: VercelRequest) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServerSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new AiCommandCenterHttpError(500, error.message);
  }

  if (!profile || String((profile as AdminProfileRow).role || "").toLowerCase() !== "admin") {
    throw new AiCommandCenterHttpError(403, "Admin access is required for AI Command Center operations.");
  }

  return { user, profile: profile as AdminProfileRow };
}

export function nowIso() {
  return new Date().toISOString();
}

export function isWriteMode(task: Pick<TaskRow, "execution_mode" | "safety_level" | "requires_approval">) {
  return (
    task.execution_mode === "execute" ||
    task.execution_mode === "execute_with_approval" ||
    task.safety_level === "write_allowed" ||
    task.requires_approval
  );
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export function buildSqlRisk(sqlPreview?: string | null) {
  const preview = sqlPreview || "";
  const upperPreview = preview.toUpperCase();
  const containsDangerousKeyword = DANGEROUS_SQL_KEYWORDS.some((keyword) => upperPreview.includes(keyword));
  const updateWithoutWhere = /\bUPDATE\b/i.test(preview) && !/\bWHERE\b/i.test(preview);
  const deleteWithoutWhere = /\bDELETE\b/i.test(preview) && !/\bWHERE\b/i.test(preview);

  return {
    isWrite: WRITE_SQL_PATTERNS.some((pattern) => pattern.test(preview)),
    isHighRisk: containsDangerousKeyword || updateWithoutWhere || deleteWithoutWhere,
    isBlocked: containsDangerousKeyword || updateWithoutWhere || deleteWithoutWhere,
    riskLevel: containsDangerousKeyword || updateWithoutWhere || deleteWithoutWhere ? "high" : "medium",
  };
}

export async function createTaskLog(
  supabase: SupabaseClient,
  taskId: string,
  agentName: string,
  logType: string,
  message: string,
  metadata: JsonRecord = {},
) {
  const payload = {
    task_id: taskId,
    agent_name: agentName,
    log_type: logType,
    message,
    metadata,
  };
  await supabase.from("ai_task_logs").insert(payload);
  return payload;
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: string,
  progress: number,
  extras: JsonRecord = {},
) {
  const payload: JsonRecord = {
    status,
    progress,
    updated_at: nowIso(),
    ...extras,
  };

  if (status === "running" && !payload.started_at) payload.started_at = nowIso();
  if (["completed", "failed", "blocked"].includes(status) && !payload.completed_at) {
    payload.completed_at = nowIso();
  }

  const { error } = await supabase.from("ai_tasks").update(payload).eq("id", taskId);
  if (error) throw error;
}

export async function fetchTaskBundle(supabase: SupabaseClient, taskId: string) {
  const { data: task, error: taskError } = await supabase
    .from("ai_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    throw new Error(taskError?.message || "Task not found.");
  }

  const [{ data: issue, error: issueError }, { data: approvals, error: approvalError }] = await Promise.all([
    supabase.from("ai_issues").select("*").eq("id", task.issue_id).single(),
    supabase
      .from("ai_task_approvals")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
  ]);

  if (issueError || !issue) {
    throw new Error(issueError?.message || "Issue not found.");
  }
  if (approvalError) {
    throw new Error(approvalError.message);
  }

  return {
    task: task as TaskRow,
    issue: issue as IssueRow,
    approvals: approvals || [],
    latestApproval: approvals?.[0] || null,
  };
}

export async function fetchLatestPendingApproval(supabase: SupabaseClient, taskId: string) {
  const { data: approval, error } = await supabase
    .from("ai_task_approvals")
    .select("*")
    .eq("task_id", taskId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return approval as ApprovalRow | null;
}

export function inferSqlPreview(task: TaskRow, issue: IssueRow) {
  const title = `${issue.title} ${task.task_name}`.toLowerCase();

  if (title.includes("failed lesson generation")) {
    return [
      "select status, last_error, count(*) as count",
      "from lesson_gen_queue",
      "where status = 'failed'",
      "group by status, last_error",
      "order by count desc;",
      "",
      "update lesson_gen_queue",
      "set status = 'pending', claimed_at = null, last_error = null",
      "where status = 'failed'",
      "and attempts < 3;",
    ].join("\n");
  }

  if (title.includes("missing rag") || task.target_area === "rag_chunks") {
    return [
      "select grade_id, subject_id, topic_id, count(*) as chunk_count",
      "from rag_chunks",
      "where grade_id = :grade_id",
      "and subject_id = :subject_id",
      "and topic_id = :topic_id",
      "group by grade_id, subject_id, topic_id;",
    ].join("\n");
  }

  if (title.includes("topic")) {
    return [
      "select *",
      "from lesson_gen_queue",
      "where topic_id is null",
      "and status in ('pending', 'failed', 'retryable_failed');",
    ].join("\n");
  }

  if (title.includes("duplicate")) {
    return [
      "select topic_id, slug, count(*) as count",
      "from lessons",
      "group by topic_id, slug",
      "having count(*) > 1;",
    ].join("\n");
  }

  if (task.target_area === "profiles" || task.target_area === "onboarding") {
    return [
      "select profiles.id, profiles.selected_grade, profiles.selected_bac_track",
      "from profiles",
      "where onboarding_completed = true;",
    ].join("\n");
  }

  return [
    "-- Planner generated a guarded execution shell.",
    "-- Auditor runs first, then Worker executes only after approval when writes are needed.",
  ].join("\n");
}

export function buildRollbackPlan(task: TaskRow, issue: IssueRow) {
  if (task.target_area === "lessons") {
    return "Restore lesson_gen_queue rows from snapshot, revert retried jobs to their pre-run status, and preserve any completed lessons created during the run.";
  }
  if (task.target_area === "rag_chunks") {
    return "Restore chunk linkage rows from snapshot and re-run retrieval diagnostics before allowing another generation attempt.";
  }
  if (task.target_area === "profiles" || task.target_area === "onboarding") {
    return "Restore profile academic fields from snapshot and clear any UI sync flags introduced during the remediation.";
  }
  return `Restore ${issue.affected_area} from the execution snapshot before retrying this task.`;
}

export function buildExecutionPlan(task: TaskRow, issue: IssueRow) {
  const sqlPreview = inferSqlPreview(task, issue);
  const sqlRisk = buildSqlRisk(sqlPreview);
  const approvalRequired =
    task.requires_approval ||
    task.execution_mode === "execute_with_approval" ||
    task.safety_level === "write_allowed" ||
    sqlRisk.isWrite;
  const destructiveBlocked =
    task.safety_level === "destructive_blocked" && sqlRisk.isBlocked;
  const riskLevel = destructiveBlocked
    ? "high"
    : sqlRisk.isHighRisk
      ? "high"
      : issue.severity === "critical"
        ? "high"
        : issue.severity === "high"
          ? "medium"
          : "low";

  const steps = [
    {
      name: COMMAND_CENTER_AGENTS.planner,
      status: "completed",
      description: "Classify the issue, infer the required checks, and stage a guarded execution plan.",
    },
    {
      name: COMMAND_CENTER_AGENTS.auditor,
      status: "pending",
      description: "Run read-only diagnostics against the issue scope and capture evidence.",
    },
    {
      name: COMMAND_CENTER_AGENTS.sql,
      status: "pending",
      description: "Prepare diagnostic SQL and safe write proposals without executing destructive operations.",
    },
    {
      name: COMMAND_CENTER_AGENTS.worker,
      status: approvalRequired ? "waiting_approval" : "pending",
      description: "Execute the approved plan and write structured task logs for each step.",
    },
    {
      name: COMMAND_CENTER_AGENTS.validator,
      status: "pending",
      description: "Confirm the issue has been remediated and that no navigation or integrity regressions remain.",
    },
    {
      name: COMMAND_CENTER_AGENTS.reporter,
      status: "pending",
      description: "Publish the final report with counts, blockers, and next actions.",
    },
  ];

  return {
    steps,
    riskLevel,
    approvalRequired,
    destructiveBlocked,
    requiredApprovals: approvalRequired
      ? [
          "Write operations require human approval before execution.",
          "Any SQL containing DROP, TRUNCATE, DELETE, ALTER TABLE, or UPDATE without WHERE remains blocked by default.",
        ]
      : ["Read-only audit path. No human approval required."],
    rollbackPlan: buildRollbackPlan(task, issue),
    sqlPreview,
    proposedAction: issue.suggested_action || task.instructions || `Execute guarded remediation for ${issue.title}.`,
  };
}

async function safeSelect(
  supabase: SupabaseClient,
  table: string,
  columns = "*",
  mutator?: (query: any) => any,
) {
  try {
    let query: any = supabase.from(table).select(columns);
    if (mutator) query = mutator(query);
    const { data, error } = await query;
    if (error) return { data: [], error };
    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

function countInvalidChunkLinks(chunks: JsonRecord[], field: string, expectedValue?: string | null) {
  if (!expectedValue) return 0;
  return chunks.filter((chunk) => !chunk[field] || chunk[field] !== expectedValue).length;
}

export async function runRagDiagnostic(
  supabase: SupabaseClient,
  input: {
    grade_id?: string | null;
    subject_id?: string | null;
    topic_id?: string | null;
    lesson_id?: string | null;
  },
) {
  const { data: gradeScopedChunks, error } = await safeSelect(
    supabase,
    "rag_chunks",
    "*",
    (query) => (input.grade_id ? query.eq("grade_id", input.grade_id).limit(500) : query.limit(500)),
  );

  if (error) {
    throw new Error(normalizeError(error));
  }

  const filteredChunks = gradeScopedChunks.filter((chunk: JsonRecord) => {
    const subjectOk = input.subject_id ? !("subject_id" in chunk) || chunk.subject_id === input.subject_id : true;
    const topicOk = input.topic_id ? !("topic_id" in chunk) || chunk.topic_id === input.topic_id : true;
    const lessonOk = input.lesson_id ? !("lesson_id" in chunk) || chunk.lesson_id === input.lesson_id : true;
    return subjectOk && topicOk && lessonOk;
  });

  const nonEmptyChunks = filteredChunks.filter((chunk) => String(chunk.content || "").trim().length > 0);
  const averageLength =
    nonEmptyChunks.length > 0
      ? nonEmptyChunks.reduce((sum, chunk) => sum + String(chunk.content || "").trim().length, 0) / nonEmptyChunks.length
      : 0;

  const relevanceSignals = nonEmptyChunks.map((chunk) => {
    const metadataScore = Number(
      chunk?.metadata?.relevance_score ??
      chunk?.relevance_score ??
      chunk?.quality_score ??
      0,
    );
    if (Number.isFinite(metadataScore) && metadataScore > 0) {
      return Math.max(0, Math.min(1, metadataScore));
    }

    let score = 0.6;
    if (String(chunk.content || "").trim().length >= 250) score += 0.1;
    if (input.topic_id && chunk.topic_id === input.topic_id) score += 0.15;
    if (input.subject_id && chunk.subject_id === input.subject_id) score += 0.1;
    if (input.grade_id && chunk.grade_id === input.grade_id) score += 0.1;
    return Math.max(0, Math.min(1, score));
  });

  const relevanceScore =
    relevanceSignals.length > 0
      ? Number((relevanceSignals.reduce((sum, score) => sum + score, 0) / relevanceSignals.length).toFixed(2))
      : 0;

  const invalidLinks = {
    grade: countInvalidChunkLinks(nonEmptyChunks, "grade_id", input.grade_id),
    subject: countInvalidChunkLinks(nonEmptyChunks, "subject_id", input.subject_id),
    topic: countInvalidChunkLinks(nonEmptyChunks, "topic_id", input.topic_id),
  };

  let blockingReason = "";
  if (nonEmptyChunks.length === 0) {
    blockingReason = "No valid RAG chunks found for this lesson/topic.";
  } else if (relevanceScore < MINIMUM_RELEVANCE_SCORE) {
    blockingReason = `Chunk relevance ${relevanceScore} is below the ${MINIMUM_RELEVANCE_SCORE} threshold.`;
  } else if (averageLength < 120) {
    blockingReason = "Chunk text is too short to safely generate curriculum content.";
  }

  return {
    chunks_found: nonEmptyChunks.length,
    relevance_score: relevanceScore,
    average_chunk_length: Math.round(averageLength),
    invalid_links: invalidLinks,
    blocking_reason: blockingReason || null,
  };
}

export async function runAuditForTask(
  supabase: SupabaseClient,
  task: TaskRow,
  issue: IssueRow,
) {
  const failedJobsResult = await safeSelect(
    supabase,
    "lesson_gen_queue",
    "id, topic_id, status, attempts, last_error, updated_at",
    (query) => query.limit(300).order("updated_at", { ascending: false }),
  );
  const lessonsResult = await safeSelect(
    supabase,
    "lessons",
    "*",
    (query) => query.limit(300),
  );
  const topicsResult = await safeSelect(
    supabase,
    "topics",
    "*",
    (query) => query.limit(300),
  );

  const jobs = failedJobsResult.data || [];
  const failedJobs = jobs.filter((job: JsonRecord) =>
    ["failed", "retryable_failed", "permanent_failed"].includes(job.status),
  );
  const jobsMissingTopic = jobs.filter((job: JsonRecord) => !job.topic_id);
  const retryableFailed = failedJobs.filter((job: JsonRecord) => Number(job.attempts || 0) < MAX_AUTOMATIC_RETRIES);
  const permanentFailed = failedJobs.filter((job: JsonRecord) => Number(job.attempts || 0) >= MAX_AUTOMATIC_RETRIES);
  const lessons = lessonsResult.data || [];
  const lessonsWithoutTopic = lessons.filter((lesson: JsonRecord) => !lesson.topic_id);
  const duplicateLessonsMap = new Map<string, number>();

  lessons.forEach((lesson: JsonRecord) => {
    const key = `${lesson.topic_id || "none"}::${lesson.slug || lesson.lesson_title || lesson.title || "untitled"}::${lesson.lesson_order || "none"}`;
    duplicateLessonsMap.set(key, (duplicateLessonsMap.get(key) || 0) + 1);
  });

  const duplicateLessons = [...duplicateLessonsMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  const topicCount = (topicsResult.data || []).length;

  const ragDiagnostic = await runRagDiagnostic(supabase, {
    grade_id: issue.evidence?.grade_id || null,
    subject_id: issue.evidence?.subject_id || null,
    topic_id: issue.evidence?.topic_id || null,
    lesson_id: issue.evidence?.lesson_id || null,
  }).catch(() => ({
    chunks_found: 0,
    relevance_score: 0,
    average_chunk_length: 0,
    invalid_links: { grade: 0, subject: 0, topic: 0 },
    blocking_reason: null,
  }));

  const logs = [
    {
      agent_name: COMMAND_CENTER_AGENTS.auditor,
      log_type: "info",
      message: `Found ${failedJobs.length} failed lesson generation jobs.`,
      metadata: { failedJobs: failedJobs.length, retryable: retryableFailed.length, permanent: permanentFailed.length },
    },
    {
      agent_name: COMMAND_CENTER_AGENTS.auditor,
      log_type: jobsMissingTopic.length > 0 ? "warning" : "info",
      message:
        jobsMissingTopic.length > 0
          ? `Detected ${jobsMissingTopic.length} jobs without topic_id. Generation must stay blocked until a DB-backed mapping is resolved.`
          : "No missing topic_id values found in the sampled generation queue.",
      metadata: { jobsMissingTopic: jobsMissingTopic.length },
    },
    {
      agent_name: COMMAND_CENTER_AGENTS.rag,
      log_type: ragDiagnostic.blocking_reason ? "warning" : "validation",
      message: ragDiagnostic.blocking_reason
        ? ragDiagnostic.blocking_reason
        : `RAG check passed with ${ragDiagnostic.chunks_found} chunks and relevance ${ragDiagnostic.relevance_score}.`,
      metadata: ragDiagnostic,
    },
    {
      agent_name: COMMAND_CENTER_AGENTS.auditor,
      log_type: duplicateLessons.length > 0 ? "warning" : "info",
      message:
        duplicateLessons.length > 0
          ? `Detected ${duplicateLessons.length} duplicate lesson group(s). Default duplicate action remains skip.`
          : "No duplicate lessons detected in the sampled lesson set.",
      metadata: { duplicateLessons },
    },
    {
      agent_name: COMMAND_CENTER_AGENTS.sql,
      log_type: "sql",
      message: "Generated diagnostic query set for the audit.",
      metadata: { sql_preview: inferSqlPreview(task, issue) },
    },
  ];

  const blockingReasons = [
    ...(ragDiagnostic.blocking_reason ? [ragDiagnostic.blocking_reason] : []),
    ...(jobsMissingTopic.length > 0 ? ["One or more jobs are missing topic_id and cannot be safely generated."] : []),
  ];

  return {
    report: {
      issue_title: issue.title,
      failed_jobs: failedJobs.length,
      retryable_failed_jobs: retryableFailed.length,
      permanent_failed_jobs: permanentFailed.length,
      missing_topic_jobs: jobsMissingTopic.length,
      lessons_without_topic: lessonsWithoutTopic.length,
      duplicate_lesson_groups: duplicateLessons.length,
      topic_count: topicCount,
      rag: ragDiagnostic,
      blocking_reasons: blockingReasons,
      recommended_status:
        blockingReasons.length > 0
          ? ragDiagnostic.blocking_reason
            ? "waiting_for_chunks"
            : "blocked"
          : task.requires_approval
            ? "waiting_approval"
            : "pending",
    },
    logs,
  };
}

export async function createExecutionSnapshot(
  supabase: SupabaseClient,
  task: TaskRow,
  issue: IssueRow,
) {
  const targetTableMap: Record<string, string> = {
    lessons: "lessons",
    topics: "topics",
    rag_chunks: "rag_chunks",
    profiles: "profiles",
    onboarding: "profiles",
    supabase_schema: "lesson_gen_queue",
  };

  const targetTable = targetTableMap[task.target_area] || issue.affected_area || "lessons";
  const { data, error } = await safeSelect(
    supabase,
    targetTable,
    "*",
    (query) => query.limit(50),
  );

  if (error) {
    throw new Error(normalizeError(error));
  }

  const snapshot = {
    task_id: task.id,
    snapshot_type: "pre_execution",
    target_table: targetTable,
    record_count: data.length,
    snapshot_data: {
      issue_title: issue.title,
      captured_at: nowIso(),
      sample: data,
    },
  };

  const { error: insertError } = await supabase.from("ai_execution_snapshots").insert(snapshot);
  if (insertError) throw insertError;
  return snapshot;
}

export async function validateTaskExecution(
  supabase: SupabaseClient,
  task: TaskRow,
  issue: IssueRow,
) {
  const audit = await runAuditForTask(supabase, task, issue);
  const beforeFailedJobs = Number(issue.evidence?.failedJobs || 0);
  const afterFailedJobs = Number(audit.report.failed_jobs || 0);
  const reducedFailures = beforeFailedJobs === 0 ? afterFailedJobs === 0 : afterFailedJobs < beforeFailedJobs;
  const ragOkay = !audit.report.rag.blocking_reason && audit.report.rag.relevance_score >= MINIMUM_RELEVANCE_SCORE;
  const noTopiclessLessons = Number(audit.report.lessons_without_topic || 0) === 0;

  const validationPassed =
    reducedFailures &&
    ragOkay &&
    noTopiclessLessons &&
    audit.report.duplicate_lesson_groups === 0;

  const summary = validationPassed
    ? `Validation passed. Failed jobs moved from ${beforeFailedJobs} to ${afterFailedJobs}.`
    : `Validation failed. Failed jobs are now ${afterFailedJobs}, RAG status is ${audit.report.rag.relevance_score}, lessons_without_topic=${audit.report.lessons_without_topic}.`;

  const finalStatus = validationPassed ? "completed" : "failed";
  const issueStatus = validationPassed ? "fixed" : "open";

  return {
    validation_report: {
      passed: validationPassed,
      summary,
      failed_jobs_before: beforeFailedJobs,
      failed_jobs_after: afterFailedJobs,
      rag: audit.report.rag,
      lessons_without_topic: audit.report.lessons_without_topic,
      duplicate_lesson_groups: audit.report.duplicate_lesson_groups,
      recommended_next_action: validationPassed
        ? "Close the issue or monitor the queue for any new failures."
        : "Keep the issue open, inspect blocked reasons, and re-run after data dependencies are resolved.",
      issue_status: issueStatus,
      final_status: finalStatus,
    },
    logs: [
      {
        agent_name: COMMAND_CENTER_AGENTS.validator,
        log_type: validationPassed ? "validation" : "error",
        message: summary,
        metadata: audit.report,
      },
      {
        agent_name: COMMAND_CENTER_AGENTS.reporter,
        log_type: "info",
        message: validationPassed
          ? "Reporter marked task completed."
          : "Reporter marked task blocked or failed pending follow-up.",
        metadata: {
          task: task.task_name,
          status: finalStatus,
          blocked_reasons: audit.report.blocking_reasons,
        },
      },
    ],
  };
}
