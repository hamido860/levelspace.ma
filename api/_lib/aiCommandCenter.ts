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

type MonitoringIssueInput = {
  title: string;
  severity: string;
  issue_type: string;
  affected_area: string;
  error_signature: string;
  evidence: JsonRecord;
  impact: string;
  suggested_action: string;
};

type QueueJobRow = {
  id: string;
  topic_id: string | null;
  status: string | null;
  attempts: number | null;
  last_error: string | null;
  created_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
};

type TopicRow = {
  id: string;
  title: string | null;
  grade_id: string | null;
  subject_id: string | null;
};

type NamedRow = {
  id: string;
  name: string | null;
};

type RecoveryIssueRow = {
  id: string;
  error_signature: string;
  created_at?: string | null;
};

type RecoveryTaskRow = {
  id: string;
  issue_id: string;
  job_id?: string | null;
  title?: string | null;
  task_name?: string | null;
  priority?: string | null;
  target_area?: string | null;
  progress?: number | null;
  requires_approval?: boolean | null;
  instructions?: string | null;
  metadata?: JsonRecord | string | null;
  result?: JsonRecord | string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  status: string;
  created_at: string | null;
};

export type AiRecoveryTaskRef = {
  id: string;
  issue_id: string;
  job_id: string | null;
  title: string | null;
  status: string;
  created_at: string | null;
};

export type AiRecoveryFailedJobSummary = {
  job_id: string;
  topic_id: string | null;
  status: string | null;
  attempts: number | null;
  last_error: string | null;
  created_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  topic_title: string | null;
  grade_name: string | null;
  subject_name: string | null;
  outlines_count: number | null;
  outlines_status: "available" | "missing_table";
  existing_task: AiRecoveryTaskRef | null;
};

export type AiRecoveryJobDiagnostics = {
  job_id: string;
  topic_id: string | null;
  topic_title: string | null;
  grade_name: string | null;
  subject_name: string | null;
  status: string | null;
  attempts: number | null;
  last_error: string | null;
  created_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  ordered_topic_outlines: JsonRecord[];
  topic_outlines_status: "available" | "missing_table";
  existing_lessons_count: number;
  existing_lesson_blocks_count: number | null;
  lesson_blocks_status: "available" | "missing_table";
  existing_task: AiRecoveryTaskRef | null;
};

export type CreateAiRecoveryTaskResult = {
  task: AiRecoveryTaskRef;
  issue_id: string;
  already_exists: boolean;
  message: string;
};

export type AiRecoveryTaskLogEntry = {
  id: string;
  agent_name: string;
  log_type: string;
  message: string;
  metadata: JsonRecord;
  created_at: string | null;
};

export type AiRecoveryTaskDetail = {
  task: {
    id: string;
    issue_id: string;
    job_id: string | null;
    title: string | null;
    task_name: string | null;
    status: string;
    priority: string | null;
    target_area: string | null;
    progress: number | null;
    requires_approval: boolean | null;
    instructions: string | null;
    metadata: JsonRecord;
    result: JsonRecord;
    created_at: string | null;
    updated_at: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  issue: {
    id: string;
    title: string;
    severity: string;
    status: string;
  } | null;
  queue_job: {
    id: string;
    topic_id: string | null;
    status: string | null;
    attempts: number | null;
    last_error: string | null;
    created_at: string | null;
    claimed_at: string | null;
    completed_at: string | null;
  } | null;
  topic: { id: string; title: string | null } | null;
  grade: { id: string; name: string | null } | null;
  subject: { id: string; name: string | null } | null;
  ordered_topic_outlines: JsonRecord[];
  topic_outlines_status: "available" | "missing_table";
  existing_lessons: JsonRecord[];
  lesson_blocks: JsonRecord[];
  lesson_blocks_status: "available" | "missing_table";
  generated_sql: string | null;
  safety_check: JsonRecord | null;
  logs: AiRecoveryTaskLogEntry[];
  latest_approval: JsonRecord | null;
};

export type AiRecoverySafetyCheck = {
  executed_at: string;
  allowed: boolean;
  errors: string[];
  warnings: string[];
  sql_present: boolean;
  contains_begin: boolean;
  contains_commit: boolean;
  isWrite: boolean;
  isHighRisk: boolean;
  isBlocked: boolean;
  riskLevel: string;
  summary: string;
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
const AI_RECOVERY_SQL_NVIDIA_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";
const AI_RECOVERY_SQL_GEMINI_MODEL = "gemini-2.5-flash";

type TaskRow = {
  id: string;
  issue_id: string;
  task_name: string;
  title?: string | null;
  task_type: string;
  priority: string;
  assigned_agent: string;
  execution_mode: string;
  safety_level: string;
  target_area: string;
  instructions: string | null;
  job_id?: string | null;
  metadata?: JsonRecord | string | null;
  result?: JsonRecord | string | null;
  status: string;
  progress: number;
  requires_approval: boolean;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role credentials are not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getPublicSupabaseForAuth(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const authKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

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

export async function requireAdminUser(req: VercelRequest) {
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
    throw new AiCommandCenterHttpError(403, "Admin access is required.");
  }

  return { user, profile: profile as AdminProfileRow };
}

export const requireAiAdmin = requireAdminUser;

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

function parseJsonRecord(value: unknown): JsonRecord {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as JsonRecord)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  const message = String(error?.message || "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
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

async function fetchNamedRowsById(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
) {
  if (ids.length === 0) {
    return new Map<string, NamedRow>();
  }

  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map(((data || []) as NamedRow[]).map((row) => [row.id, row]));
}

async function fetchTopicContext(
  supabase: SupabaseClient,
  topicIds: string[],
) {
  if (topicIds.length === 0) {
    return {
      topicsById: new Map<string, TopicRow>(),
      gradesById: new Map<string, NamedRow>(),
      subjectsById: new Map<string, NamedRow>(),
    };
  }

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, title, grade_id, subject_id")
    .in("id", topicIds);

  if (topicsError) {
    throw topicsError;
  }

  const topicRows = (topics || []) as TopicRow[];
  const topicsById = new Map(topicRows.map((topic) => [topic.id, topic]));
  const gradeIds = Array.from(new Set(topicRows.map((topic) => topic.grade_id).filter(Boolean))) as string[];
  const subjectIds = Array.from(new Set(topicRows.map((topic) => topic.subject_id).filter(Boolean))) as string[];

  const [gradesById, subjectsById] = await Promise.all([
    fetchNamedRowsById(supabase, "grades", gradeIds),
    fetchNamedRowsById(supabase, "subjects", subjectIds),
  ]);

  return { topicsById, gradesById, subjectsById };
}

async function fetchLatestRecoveryTasksByIssueId(
  supabase: SupabaseClient,
  issueIds: string[],
) {
  if (issueIds.length === 0) {
    return new Map<string, AiRecoveryTaskRef>();
  }

  const { data, error } = await supabase
    .from("ai_tasks")
    .select("id, issue_id, job_id, title, status, created_at")
    .in("issue_id", issueIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const latestTaskByIssueId = new Map<string, AiRecoveryTaskRef>();
  ((data || []) as RecoveryTaskRow[]).forEach((task) => {
    if (!latestTaskByIssueId.has(task.issue_id)) {
      latestTaskByIssueId.set(task.issue_id, {
        id: task.id,
        issue_id: task.issue_id,
        job_id: task.job_id ?? null,
        title: task.title ?? null,
        status: task.status,
        created_at: task.created_at,
      });
    }
  });

  return latestTaskByIssueId;
}

async function fetchTopicOutlinesByTopicIds(
  supabase: SupabaseClient,
  topicIds: string[],
) {
  if (topicIds.length === 0) {
    return { outlinesByTopicId: new Map<string, JsonRecord[]>(), status: "available" as const };
  }

  const { data, error } = await supabase
    .from("topic_outlines")
    .select("*")
    .in("topic_id", topicIds);

  if (error) {
    if (isMissingTableError(error)) {
      return { outlinesByTopicId: new Map<string, JsonRecord[]>(), status: "missing_table" as const };
    }
    throw error;
  }

  const outlinesByTopicId = new Map<string, JsonRecord[]>();
  ((data || []) as JsonRecord[]).forEach((outline) => {
    const topicId = String(outline.topic_id || "");
    if (!topicId) return;
    const current = outlinesByTopicId.get(topicId) || [];
    current.push(outline);
    outlinesByTopicId.set(topicId, current);
  });

  return { outlinesByTopicId, status: "available" as const };
}

function sortTopicOutlines(outlines: JsonRecord[]) {
  const numericOrderFields = ["outline_order", "position", "sort_order", "order_index", "sequence"];
  const textOrderFields = ["created_at", "updated_at"];

  return [...outlines].sort((left, right) => {
    for (const field of numericOrderFields) {
      const leftValue = Number(left[field]);
      const rightValue = Number(right[field]);
      const leftValid = Number.isFinite(leftValue);
      const rightValid = Number.isFinite(rightValue);
      if (leftValid && rightValid && leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    for (const field of textOrderFields) {
      const leftValue = left[field] ? new Date(String(left[field])).getTime() : 0;
      const rightValue = right[field] ? new Date(String(right[field])).getTime() : 0;
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    const leftKey = String(left.id || left.title || left.name || "");
    const rightKey = String(right.id || right.title || right.name || "");
    return leftKey.localeCompare(rightKey);
  });
}

async function fetchAiRecoveryTaskForJob(
  supabase: SupabaseClient,
  jobId: string,
) {
  const { data: task, error } = await supabase
    .from("ai_tasks")
    .select("id, issue_id, job_id, title, status, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!task) {
    return { issue: null, task: null };
  }

  const { data: issue, error: issueError } = await supabase
    .from("ai_issues")
    .select("id, error_signature, created_at")
    .eq("id", task.issue_id)
    .maybeSingle();

  if (issueError) {
    throw issueError;
  }

  return {
    issue: (issue as RecoveryIssueRow | null) ?? null,
    task: {
      id: task.id,
      issue_id: task.issue_id,
      job_id: task.job_id ?? null,
      title: task.title ?? null,
      status: task.status,
      created_at: task.created_at,
    } satisfies AiRecoveryTaskRef,
  };
}

async function fetchAiRecoveryTasksByJobIds(
  supabase: SupabaseClient,
  jobIds: string[],
) {
  if (jobIds.length === 0) {
    return new Map<string, AiRecoveryTaskRef>();
  }

  const { data, error } = await supabase
    .from("ai_tasks")
    .select("id, issue_id, job_id, title, status, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const taskByJobId = new Map<string, AiRecoveryTaskRef>();
  ((data || []) as RecoveryTaskRow[]).forEach((task) => {
    const jobId = task.job_id ?? null;
    if (!jobId || taskByJobId.has(jobId)) {
      return;
    }

    taskByJobId.set(jobId, {
      id: task.id,
      issue_id: task.issue_id,
      job_id: task.job_id ?? null,
      title: task.title ?? null,
      status: task.status,
      created_at: task.created_at,
    });
  });

  return taskByJobId;
}

async function fetchOrCreateFailedLessonGenerationIssue(
  supabase: SupabaseClient,
) {
  const errorSignature = slugifySignature("failed_lesson_generation_jobs");
  const { data: existingIssue, error: existingIssueError } = await supabase
    .from("ai_issues")
    .select("id, error_signature, created_at")
    .eq("error_signature", errorSignature)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingIssueError) {
    throw existingIssueError;
  }

  if (existingIssue) {
    return existingIssue as RecoveryIssueRow;
  }

  const now = nowIso();
  const { data: createdIssue, error: createdIssueError } = await supabase
    .from("ai_issues")
    .insert({
      title: "Failed lesson generation jobs",
      severity: "critical",
      issue_type: "generation",
      affected_area: "lesson_generation",
      evidence: {
        source: "admin_ai_recovery",
        scope: "failed_lesson_generation_jobs",
      },
      impact: "One or more lesson generation jobs are failing and need admin review.",
      suggested_action: "Inspect the failed job diagnostics and create a guarded recovery task for the affected queue row.",
      error_signature: errorSignature,
      status: "open",
      created_at: now,
      updated_at: now,
    })
    .select("id, error_signature, created_at")
    .single();

  if (createdIssueError) {
    throw createdIssueError;
  }

  return createdIssue as RecoveryIssueRow;
}

export async function loadAiRecoveryFailedJobs(
  supabase: SupabaseClient,
): Promise<AiRecoveryFailedJobSummary[]> {
  const { data, error } = await supabase
    .from("lesson_gen_queue")
    .select("id, topic_id, status, attempts, last_error, created_at, claimed_at, completed_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const jobs = (data || []) as QueueJobRow[];
  const topicIds = Array.from(new Set(jobs.map((job) => job.topic_id).filter(Boolean))) as string[];
  const jobIds = jobs.map((job) => job.id);

  const [
    topicContext,
    outlineResult,
    tasksByJobId,
  ] = await Promise.all([
    fetchTopicContext(supabase, topicIds),
    fetchTopicOutlinesByTopicIds(supabase, topicIds),
    fetchAiRecoveryTasksByJobIds(supabase, jobIds),
  ]);

  return jobs.map((job) => {
    const topic = job.topic_id ? topicContext.topicsById.get(job.topic_id) || null : null;
    const grade = topic?.grade_id ? topicContext.gradesById.get(topic.grade_id) || null : null;
    const subject = topic?.subject_id ? topicContext.subjectsById.get(topic.subject_id) || null : null;
    const existingTask = tasksByJobId.get(job.id) || null;
    const topicOutlines = job.topic_id ? outlineResult.outlinesByTopicId.get(job.topic_id) || [] : [];

    return {
      job_id: job.id,
      topic_id: job.topic_id,
      status: job.status,
      attempts: job.attempts,
      last_error: job.last_error,
      created_at: job.created_at,
      claimed_at: job.claimed_at,
      completed_at: job.completed_at,
      topic_title: topic?.title || null,
      grade_name: grade?.name || null,
      subject_name: subject?.name || null,
      outlines_count: outlineResult.status === "available" ? topicOutlines.length : null,
      outlines_status: outlineResult.status,
      existing_task: existingTask,
    } satisfies AiRecoveryFailedJobSummary;
  });
}

export async function loadAiRecoveryJobDiagnostics(
  supabase: SupabaseClient,
  jobId: string,
): Promise<AiRecoveryJobDiagnostics> {
  const { data: job, error } = await supabase
    .from("lesson_gen_queue")
    .select("id, topic_id, status, attempts, last_error, created_at, claimed_at, completed_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!job) {
    throw new AiCommandCenterHttpError(404, "Failed job not found.");
  }

  const queueJob = job as QueueJobRow;
  const topicIds = queueJob.topic_id ? [queueJob.topic_id] : [];
  const [topicContext, outlineResult, existingTaskLookup] = await Promise.all([
    fetchTopicContext(supabase, topicIds),
    fetchTopicOutlinesByTopicIds(supabase, topicIds),
    fetchAiRecoveryTaskForJob(supabase, jobId),
  ]);

  const topic = queueJob.topic_id ? topicContext.topicsById.get(queueJob.topic_id) || null : null;
  const grade = topic?.grade_id ? topicContext.gradesById.get(topic.grade_id) || null : null;
  const subject = topic?.subject_id ? topicContext.subjectsById.get(topic.subject_id) || null : null;

  let existingLessonsCount = 0;
  let existingLessonBlocksCount: number | null = 0;
  let lessonBlocksStatus: "available" | "missing_table" = "available";

  let lessonRows: Array<{ id: string }> = [];
  if (queueJob.topic_id) {
    const { count, error: lessonsCountError } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("topic_id", queueJob.topic_id);

    if (lessonsCountError) {
      throw lessonsCountError;
    }
    existingLessonsCount = count ?? 0;

    const { data: lessonsForBlocks, error: lessonsForBlocksError } = await supabase
      .from("lessons")
      .select("id")
      .eq("topic_id", queueJob.topic_id);

    if (lessonsForBlocksError) {
      throw lessonsForBlocksError;
    }

    lessonRows = (lessonsForBlocks || []) as Array<{ id: string }>;
  }

  const lessonIds = lessonRows.map((lesson) => lesson.id);
  if (lessonIds.length > 0) {
    const { count, error: blocksError } = await supabase
      .from("lesson_blocks")
      .select("*", { count: "exact", head: true })
      .in("lesson_id", lessonIds);

    if (blocksError) {
      if (isMissingTableError(blocksError)) {
        existingLessonBlocksCount = null;
        lessonBlocksStatus = "missing_table";
      } else {
        throw blocksError;
      }
    } else {
      existingLessonBlocksCount = count ?? 0;
    }
  }

  const outlines =
    queueJob.topic_id && outlineResult.status === "available"
      ? sortTopicOutlines(outlineResult.outlinesByTopicId.get(queueJob.topic_id) || [])
      : [];

  return {
    job_id: queueJob.id,
    topic_id: queueJob.topic_id,
    topic_title: topic?.title || null,
    grade_name: grade?.name || null,
    subject_name: subject?.name || null,
    status: queueJob.status,
    attempts: queueJob.attempts,
    last_error: queueJob.last_error,
    created_at: queueJob.created_at,
    claimed_at: queueJob.claimed_at,
    completed_at: queueJob.completed_at,
    ordered_topic_outlines: outlines,
    topic_outlines_status: outlineResult.status,
    existing_lessons_count: existingLessonsCount,
    existing_lesson_blocks_count: existingLessonBlocksCount,
    lesson_blocks_status: lessonBlocksStatus,
    existing_task: existingTaskLookup.task,
  };
}

export async function createAiRecoveryTaskForJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<CreateAiRecoveryTaskResult> {
  const diagnostics = await loadAiRecoveryJobDiagnostics(supabase, jobId);

  if (diagnostics.status !== "failed") {
    throw new AiCommandCenterHttpError(409, "Only jobs with status 'failed' can create recovery tasks.");
  }

  const existingTaskLookup = await fetchAiRecoveryTaskForJob(supabase, jobId);
  if (existingTaskLookup.task) {
    return {
      task: existingTaskLookup.task,
      issue_id: existingTaskLookup.task.issue_id,
      already_exists: true,
      message: "Task already exists.",
    };
  }

  const now = nowIso();
  const issue = await fetchOrCreateFailedLessonGenerationIssue(supabase);
  const issueId = issue?.id || null;

  if (!issueId) {
    throw new Error("Unable to resolve AI recovery issue.");
  }

  const secondLookup = await fetchAiRecoveryTaskForJob(supabase, jobId);
  if (secondLookup.task) {
    return {
      task: secondLookup.task,
      issue_id: secondLookup.task.issue_id,
      already_exists: true,
      message: "Task already exists.",
    };
  }

  const { data: task, error: taskError } = await supabase
    .from("ai_tasks")
    .insert({
      issue_id: issueId,
      job_id: diagnostics.job_id,
      title: "Resolve failed lesson generation job",
      task_name: "Resolve failed lesson generation job",
      task_type: "generation",
      priority: "critical",
      assigned_agent: COMMAND_CENTER_AGENTS.planner,
      execution_mode: "execute_with_approval",
      safety_level: "destructive_blocked",
      target_area: "lesson_generation",
      instructions: [
        `Review failed lesson generation job ${jobId}.`,
        diagnostics.topic_title ? `Topic: ${diagnostics.topic_title}` : null,
        diagnostics.grade_name ? `Grade: ${diagnostics.grade_name}` : null,
        diagnostics.subject_name ? `Subject: ${diagnostics.subject_name}` : null,
        diagnostics.last_error ? `Last error: ${diagnostics.last_error}` : null,
        "Inspect the queue row, topic metadata, and any existing lesson or outline context.",
        "Do not execute any repair, do not generate SQL automatically, and do not mark the queue row as done.",
      ]
        .filter(Boolean)
        .join("\n"),
      status: "pending",
      progress: 0,
      requires_approval: true,
      metadata: {
        topic_id: diagnostics.topic_id,
        topic_title: diagnostics.topic_title,
        grade_name: diagnostics.grade_name,
        subject_name: diagnostics.subject_name,
        last_error: diagnostics.last_error,
      },
      result: {},
      created_at: now,
      updated_at: now,
    })
    .select("id, issue_id, job_id, title, status, created_at")
    .single();

  if (taskError) {
    throw taskError;
  }

  const taskRef: AiRecoveryTaskRef = {
    id: task.id,
    issue_id: task.issue_id,
    job_id: task.job_id ?? null,
    title: task.title ?? null,
    status: task.status,
    created_at: task.created_at,
  };

  await createTaskLog(
    supabase,
    taskRef.id,
    COMMAND_CENTER_AGENTS.planner,
    "info",
    "AI Recovery task created from a failed lesson generation job.",
    {
      recovery_job_id: diagnostics.job_id,
      topic_id: diagnostics.topic_id,
      topic_title: diagnostics.topic_title,
      outlines_count: diagnostics.ordered_topic_outlines.length,
      existing_lessons_count: diagnostics.existing_lessons_count,
      existing_lesson_blocks_count: diagnostics.existing_lesson_blocks_count,
    },
  );

  return {
    task: taskRef,
    issue_id: issueId,
    already_exists: false,
    message: "AI recovery task created.",
  };
}

function clipText(value: string | null | undefined, maxLength: number) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

function toPromptJson(value: unknown, maxLength = 12000) {
  return clipText(JSON.stringify(value, null, 2), maxLength);
}

function collectObservedKeys(rows: JsonRecord[]) {
  const keys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(parseJsonRecord(row)).forEach((key) => keys.add(key));
  });
  return [...keys].sort();
}

function stripMarkdownCodeFence(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:sql)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed.replace(/^sql\s+/i, "").trim();
}

function sanitizeGeneratedSql(rawOutput: string) {
  const cleaned = stripMarkdownCodeFence(rawOutput);

  if (!cleaned) {
    throw new AiCommandCenterHttpError(502, "AI provider returned an empty SQL preview.");
  }

  if (!/\bBEGIN\b/i.test(cleaned) || !/\bCOMMIT\b/i.test(cleaned)) {
    throw new AiCommandCenterHttpError(502, "AI provider did not return a transactional SQL preview.");
  }

  if (!/\b(INSERT|UPDATE)\b/i.test(cleaned)) {
    throw new AiCommandCenterHttpError(502, "AI provider did not return repair SQL statements.");
  }

  if (/^\s*(Here|Below|Explanation|Notes?)\b/i.test(cleaned)) {
    throw new AiCommandCenterHttpError(502, "AI provider returned commentary instead of SQL only.");
  }

  return cleaned;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSqlWhitespace(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function collectTouchedSqlTables(sql: string) {
  const matches = [
    ...sql.matchAll(/\b(?:insert\s+into|update|delete\s+from|from|join)\s+((?:public\.)?[a-z_][a-z0-9_]*)/gi),
  ];

  return Array.from(
    new Set(
      matches
        .map((match) => String(match[1] || "").toLowerCase())
        .filter(Boolean),
    ),
  );
}

function toQualifiedAllowedTableNames(tableNames: string[]) {
  const names = new Set<string>();
  tableNames.forEach((name) => {
    const normalized = name.toLowerCase();
    names.add(normalized);
    names.add(normalized.replace(/^public\./, ""));
  });
  return names;
}

function buildAiRecoverySafetyCheck(
  sqlPreview: string,
  detail: AiRecoveryTaskDetail,
): AiRecoverySafetyCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedSql = normalizeSqlWhitespace(sqlPreview);
  const containsBegin = /\bBEGIN\b/i.test(sqlPreview);
  const containsCommit = /\bCOMMIT\b/i.test(sqlPreview);
  const touchedTables = collectTouchedSqlTables(sqlPreview);
  const allowedTables = [
    "public.lessons",
    "public.lesson_blocks",
    "public.lesson_gen_queue",
    "public.ai_tasks",
    "public.lesson_gen_log",
    "public.error_recovery_log",
  ];
  const allowedTableNames = toQualifiedAllowedTableNames(allowedTables);
  const dangerousPatterns: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /\bDROP\s+DATABASE\b/i, message: "Contains DROP DATABASE." },
    { pattern: /\bDROP\s+SCHEMA\b/i, message: "Contains DROP SCHEMA." },
    { pattern: /\bALTER\s+ROLE\b/i, message: "Contains ALTER ROLE." },
    { pattern: /\bALTER\s+USER\b/i, message: "Contains ALTER USER." },
    { pattern: /\bTRUNCATE\b/i, message: "Contains TRUNCATE." },
    { pattern: /\bGRANT\b/i, message: "Contains GRANT." },
    { pattern: /\bREVOKE\b/i, message: "Contains REVOKE." },
    { pattern: /\bDELETE\s+FROM\s+auth\.users\b/i, message: "Contains DELETE FROM auth.users." },
    { pattern: /\bDELETE\s+FROM\s+public\.profiles\b/i, message: "Contains DELETE FROM public.profiles." },
    { pattern: /\bSECURITY\s+DEFINER\b/i, message: "Contains SECURITY DEFINER." },
  ];
  const placeholderPatterns: Array<{ pattern: RegExp; value: string }> = [
    { pattern: /\bJOB_ID\b/i, value: "JOB_ID" },
    { pattern: /\bTOPIC_ID\b/i, value: "TOPIC_ID" },
    { pattern: /\bUUID_HERE\b/i, value: "UUID_HERE" },
    { pattern: /\bINSERT_UUID\b/i, value: "INSERT_UUID" },
    { pattern: /\bexample-id\b/i, value: "example-id" },
    { pattern: /\bxxx\b/i, value: "xxx" },
  ];
  const jobId = detail.task.job_id || "";
  const topicId = detail.queue_job?.topic_id || detail.topic?.id || "";
  const queueUpdatePattern = jobId
    ? new RegExp(`\\bUPDATE\\s+public\\.lesson_gen_queue\\b[\\s\\S]*?\\bWHERE\\b[\\s\\S]*?\\bid\\s*=\\s*'${escapeRegex(jobId)}'`, "i")
    : null;
  const queueUpdatePatternUnqualified = jobId
    ? new RegExp(`\\bUPDATE\\s+lesson_gen_queue\\b[\\s\\S]*?\\bWHERE\\b[\\s\\S]*?\\bid\\s*=\\s*'${escapeRegex(jobId)}'`, "i")
    : null;

  if (!sqlPreview.trim()) {
    errors.push("No generated SQL is stored for this task.");
  }

  if (!containsBegin) {
    errors.push("SQL must include BEGIN.");
  }

  if (!containsCommit) {
    errors.push("SQL must include COMMIT.");
  }

  dangerousPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(sqlPreview)) {
      errors.push(message);
    }
  });

  touchedTables.forEach((tableName) => {
    if (!allowedTableNames.has(tableName)) {
      errors.push(`Touches disallowed table: ${tableName}.`);
    }
  });

  if (!touchedTables.some((tableName) => tableName.endsWith("lessons"))) {
    errors.push("SQL must touch public.lessons.");
  }

  if (!touchedTables.some((tableName) => tableName.endsWith("lesson_gen_queue"))) {
    errors.push("SQL must touch public.lesson_gen_queue.");
  }

  if (!touchedTables.some((tableName) => tableName.endsWith("ai_tasks"))) {
    warnings.push("SQL does not appear to update public.ai_tasks.");
  }

  if (/\bUPDATE\s+(?:public\.)?ai_tasks\b[\s\S]*?\bSET\b[\s\S]*?\bstatus\s*=\s*'needs_review'/i.test(sqlPreview)) {
    errors.push("SQL sets ai_tasks.status to 'needs_review', which is not allowed.");
  }

  if (!/teaching_contract/i.test(sqlPreview)) {
    errors.push("SQL must reference teaching_contract.");
  }

  if (!/needs_review/i.test(sqlPreview)) {
    errors.push("SQL must include needs_review.");
  }

  if (!/student_publish_allowed/i.test(sqlPreview)) {
    errors.push("SQL must include student_publish_allowed.");
  }

  if (!/\bfalse\b/i.test(sqlPreview)) {
    errors.push("SQL must explicitly set student_publish_allowed to false.");
  }

  if (!jobId) {
    errors.push("Task is missing a real job_id.");
  } else if (
    !new RegExp(`'${escapeRegex(jobId)}'`, "i").test(sqlPreview) ||
    !(queueUpdatePattern?.test(sqlPreview) || queueUpdatePatternUnqualified?.test(sqlPreview))
  ) {
    errors.push(`SQL does not update the correct lesson_gen_queue job_id ${jobId}.`);
  }

  if (!topicId) {
    errors.push("Task is missing a real topic_id.");
  } else if (
    !new RegExp(`'${escapeRegex(topicId)}'`, "i").test(sqlPreview) ||
    !/\btopic_id\b/i.test(sqlPreview)
  ) {
    errors.push(`SQL does not use the correct topic_id ${topicId}.`);
  }

  placeholderPatterns.forEach(({ pattern, value }) => {
    if (pattern.test(sqlPreview)) {
      errors.push(`SQL contains placeholder identifier: ${value}.`);
    }
  });

  if (/\bDELETE\s+FROM\b/i.test(sqlPreview) && !/\bDELETE\s+FROM\s+(?:public\.)?(lesson_blocks|lesson_gen_log|error_recovery_log)\b/i.test(sqlPreview)) {
    errors.push("DELETE statements are blocked unless explicitly limited to recovery log cleanup tables.");
  }

  if (!/\bUPDATE\s+(?:public\.)?lesson_gen_queue\b/i.test(sqlPreview)) {
    warnings.push("SQL does not clearly show a lesson_gen_queue update statement.");
  }

  if (!/\bUPDATE\s+(?:public\.)?ai_tasks\b/i.test(sqlPreview)) {
    warnings.push("SQL does not clearly show an ai_tasks update statement.");
  }

  if (!/\bINSERT\s+INTO\s+(?:public\.)?lesson_blocks\b|\bUPDATE\s+(?:public\.)?lesson_blocks\b/i.test(sqlPreview)) {
    warnings.push("SQL does not clearly show lesson_blocks creation or update.");
  }

  const allowed = errors.length === 0;
  const risk = buildSqlRisk(sqlPreview);
  const summary = allowed
    ? "SQL passed the conservative recovery safety checks."
    : errors[0] || "SQL failed the conservative recovery safety checks.";

  return {
    executed_at: nowIso(),
    allowed,
    errors,
    warnings,
    sql_present: Boolean(sqlPreview.trim()),
    contains_begin: containsBegin,
    contains_commit: containsCommit,
    isWrite: risk.isWrite,
    isHighRisk: risk.isHighRisk || !allowed,
    isBlocked: !allowed,
    riskLevel: allowed ? (warnings.length > 0 ? "medium" : "low") : "high",
    summary,
  };
}

function buildAiRecoverySqlSystemPrompt() {
  return [
    "You are a senior PostgreSQL recovery engineer working on a Supabase-backed educational platform.",
    "Return SQL only.",
    "Do not include markdown fences, comments, prose, bullet points, or explanations.",
    "Output one transaction that starts with BEGIN and ends with COMMIT.",
    "The SQL must create or update exactly one lesson for the requested topic.",
    "The SQL must follow the provided topic_outlines order exactly.",
    "Use only the real tables and observed columns supplied in the prompt.",
    "Populate public.lessons.blocks with the canonical structured lesson JSON.",
    "The lesson blocks used by the current UI must only use these types: text, example, formula, summary.",
    "Create ordered public.lesson_blocks rows using the observed lesson_blocks shape.",
    "Do not use DELETE, DROP, TRUNCATE, or ALTER TABLE.",
    "Set lessons.teaching_contract.status to needs_review.",
    "Set lessons.teaching_contract.student_publish_allowed to false.",
    "Set lessons.teaching_contract.source_type to chatgpt_manual.",
    "Update public.lesson_gen_queue to status = 'done' for the target job.",
    "Update public.ai_tasks to status = 'completed' for the target task if it exists.",
    "Do not ever set ai_tasks.status = 'needs_review'.",
    "Put review_status = needs_review inside ai_tasks.result JSONB.",
    "Use modern pedagogy for lower grades.",
    "Use the same language as the topic title.",
  ].join("\n");
}

type AiRecoveryProviderResult = {
  provider: "nvidia" | "gemini";
  model: string;
  sql: string;
};

async function callNvidiaSqlGenerator(prompt: string, apiKey: string): Promise<AiRecoveryProviderResult> {
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_RECOVERY_SQL_NVIDIA_MODEL,
      messages: [
        { role: "system", content: buildAiRecoverySqlSystemPrompt() },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      payload?.error ||
      `NVIDIA SQL generation failed with status ${response.status}.`;
    throw new Error(message);
  }

  const raw = payload?.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("NVIDIA SQL generation returned no content.");
  }

  return {
    provider: "nvidia",
    model: AI_RECOVERY_SQL_NVIDIA_MODEL,
    sql: sanitizeGeneratedSql(raw),
  };
}

async function callGeminiSqlGenerator(prompt: string, apiKey: string): Promise<AiRecoveryProviderResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_RECOVERY_SQL_GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${buildAiRecoverySqlSystemPrompt()}\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Gemini SQL generation failed with status ${response.status}.`;
    throw new Error(message);
  }

  const raw = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n");
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Gemini SQL generation returned no content.");
  }

  return {
    provider: "gemini",
    model: AI_RECOVERY_SQL_GEMINI_MODEL,
    sql: sanitizeGeneratedSql(raw),
  };
}

async function generateSqlWithConfiguredProvider(prompt: string) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_KEY_0;
  const errors: string[] = [];

  if (nvidiaKey && nvidiaKey !== "MY_NVIDIA_API_KEY") {
    try {
      return await callNvidiaSqlGenerator(prompt, nvidiaKey);
    } catch (error) {
      errors.push(`NVIDIA: ${normalizeError(error)}`);
    }
  }

  if (geminiKey) {
    try {
      return await callGeminiSqlGenerator(prompt, geminiKey);
    } catch (error) {
      errors.push(`Gemini: ${normalizeError(error)}`);
    }
  }

  if (!nvidiaKey && !geminiKey) {
    throw new AiCommandCenterHttpError(503, "No server-side AI provider is configured for recovery SQL generation.");
  }

  throw new AiCommandCenterHttpError(502, errors.join(" | ") || "AI SQL generation failed.");
}

async function loadRichExistingLessonsForTopic(
  supabase: SupabaseClient,
  topicId: string,
) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, topic_id, lesson_title, title, subtitle, content, blocks, slug, teaching_contract, created_at, updated_at")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as JsonRecord[];
}

function buildAiRecoverySqlPrompt(detail: AiRecoveryTaskDetail, richLessons: JsonRecord[]) {
  const taskId = detail.task.id;
  const jobId = detail.task.job_id;
  const topicId = detail.queue_job?.topic_id || detail.topic?.id || null;

  if (!jobId) {
    throw new AiCommandCenterHttpError(409, "AI recovery task is missing its linked job_id.");
  }

  if (!detail.queue_job) {
    throw new AiCommandCenterHttpError(404, "Linked lesson generation queue job was not found.");
  }

  if (detail.queue_job.status !== "failed") {
    throw new AiCommandCenterHttpError(409, "Recovery SQL can only be generated for failed lesson generation jobs.");
  }

  if (!topicId || !detail.topic) {
    throw new AiCommandCenterHttpError(404, "The failed job is missing a valid topic reference.");
  }

  const normalizedOutlines = detail.ordered_topic_outlines.map((outline, index) => ({
    order: index + 1,
    ...outline,
  }));

  const normalizedLessons = richLessons.map((lesson) => ({
    id: lesson.id,
    topic_id: lesson.topic_id,
    lesson_title: lesson.lesson_title ?? lesson.title ?? null,
    title: lesson.title ?? lesson.lesson_title ?? null,
    subtitle: lesson.subtitle ?? null,
    slug: lesson.slug ?? null,
    teaching_contract: parseJsonRecord(lesson.teaching_contract),
    blocks: Array.isArray(lesson.blocks) ? lesson.blocks : [],
    content_excerpt: clipText(String(lesson.content || ""), 1500),
    created_at: lesson.created_at ?? null,
    updated_at: lesson.updated_at ?? null,
  }));

  const promptPayload = {
    task_context: {
      task_id: taskId,
      job_id: jobId,
      issue_id: detail.task.issue_id,
      queue_status: detail.queue_job.status,
      queue_attempts: detail.queue_job.attempts,
      last_error: detail.queue_job.last_error,
      topic: detail.topic,
      grade: detail.grade,
      subject: detail.subject,
    },
    required_repair_rules: {
      lesson_count: "create or update exactly one lesson for this topic",
      queue_update: "set lesson_gen_queue.status = 'done' for this job",
      ai_task_update: "set ai_tasks.status = 'completed' and ai_tasks.result.review_status = 'needs_review' for this task",
      teaching_contract: {
        status: "needs_review",
        student_publish_allowed: false,
        source_type: "chatgpt_manual",
      },
      allowed_ui_block_types: ["text", "example", "formula", "summary"],
      transaction: "must use BEGIN and COMMIT",
      prohibited: ["ai_tasks.status = 'needs_review'", "DELETE", "DROP", "TRUNCATE", "ALTER TABLE"],
    },
    observed_schema: {
      lessons_columns: collectObservedKeys(richLessons),
      lesson_blocks_columns: collectObservedKeys(detail.lesson_blocks),
      topic_outlines_columns: collectObservedKeys(detail.ordered_topic_outlines),
    },
    topic_outlines: normalizedOutlines,
    existing_lessons_for_topic: normalizedLessons,
    existing_lesson_blocks_for_topic: detail.lesson_blocks,
    task_metadata: detail.task.metadata,
    task_result: detail.task.result,
  };

  return [
    "Generate PostgreSQL SQL for the recovery task below.",
    "Return SQL only.",
    "",
    toPromptJson(promptPayload, 26000),
  ].join("\n");
}

async function fetchAiRecoveryTaskRecord(
  supabase: SupabaseClient,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("ai_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AiCommandCenterHttpError(404, "AI recovery task not found.");
  }

  return data as RecoveryTaskRow;
}

async function updateAiRecoveryTaskColumns(
  supabase: SupabaseClient,
  taskId: string,
  payload: JsonRecord,
) {
  const { error } = await supabase
    .from("ai_tasks")
    .update({
      ...payload,
      updated_at: nowIso(),
    })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

export async function loadAiRecoveryTaskDetail(
  supabase: SupabaseClient,
  taskId: string,
): Promise<AiRecoveryTaskDetail> {
  const task = await fetchAiRecoveryTaskRecord(supabase, taskId);
  const metadata = parseJsonRecord(task.metadata);
  const result = parseJsonRecord(task.result);
  const rawSafetyCheck = metadata.safety_check || result.safety_check || null;
  const safetyCheck =
    rawSafetyCheck && typeof rawSafetyCheck === "object" && !Array.isArray(rawSafetyCheck)
      ? parseJsonRecord(rawSafetyCheck)
      : null;

  const [issue, queueJob, logs, latestApproval] = await Promise.all([
    supabase.from("ai_issues").select("id, title, severity, status").eq("id", task.issue_id).maybeSingle(),
    task.job_id
      ? supabase
          .from("lesson_gen_queue")
          .select("id, topic_id, status, attempts, last_error, created_at, claimed_at, completed_at")
          .eq("id", task.job_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("ai_task_logs").select("id, agent_name, log_type, message, metadata, created_at").eq("task_id", taskId).order("created_at", { ascending: true }),
    supabase.from("ai_task_approvals").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (issue.error) throw issue.error;
  if (queueJob.error) throw queueJob.error;
  if (logs.error) throw logs.error;
  if (latestApproval.error) throw latestApproval.error;

  const queueRow = (queueJob.data as QueueJobRow | null) ?? null;
  const topicId = queueRow?.topic_id || (typeof metadata.topic_id === "string" ? metadata.topic_id : null);
  const [topicContext, outlineResult] = await Promise.all([
    fetchTopicContext(supabase, topicId ? [topicId] : []),
    fetchTopicOutlinesByTopicIds(supabase, topicId ? [topicId] : []),
  ]);

  const topic = topicId ? topicContext.topicsById.get(topicId) || null : null;
  const grade = topic?.grade_id ? topicContext.gradesById.get(topic.grade_id) || null : null;
  const subject = topic?.subject_id ? topicContext.subjectsById.get(topic.subject_id) || null : null;

  let existingLessons: JsonRecord[] = [];
  let lessonBlocks: JsonRecord[] = [];
  let lessonBlocksStatus: "available" | "missing_table" = "available";

  if (topicId) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, lesson_title, title, topic_id, slug, teaching_contract, created_at, updated_at")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false });

    if (lessonsError) {
      throw lessonsError;
    }

    existingLessons = (lessons || []) as JsonRecord[];
    const lessonIds = existingLessons.map((lesson) => lesson.id).filter(Boolean);

    if (lessonIds.length > 0) {
      const { data: blocks, error: blocksError } = await supabase
        .from("lesson_blocks")
        .select("*")
        .in("lesson_id", lessonIds);

      if (blocksError) {
        if (isMissingTableError(blocksError)) {
          lessonBlocksStatus = "missing_table";
          lessonBlocks = [];
        } else {
          throw blocksError;
        }
      } else {
        lessonBlocks = (blocks || []) as JsonRecord[];
      }
    }
  }

  return {
    task: {
      id: task.id,
      issue_id: task.issue_id,
      job_id: task.job_id ?? null,
      title: task.title ?? null,
      task_name: task.task_name ?? null,
      status: task.status,
      priority: task.priority ?? null,
      target_area: task.target_area ?? null,
      progress: task.progress ?? null,
      requires_approval: task.requires_approval ?? null,
      instructions: task.instructions ?? null,
      metadata,
      result,
      created_at: task.created_at ?? null,
      updated_at: task.updated_at ?? null,
      started_at: task.started_at ?? null,
      completed_at: task.completed_at ?? null,
    },
    issue: issue.data
      ? {
          id: issue.data.id,
          title: issue.data.title,
          severity: issue.data.severity,
          status: issue.data.status,
        }
      : null,
    queue_job: queueRow
      ? {
          id: queueRow.id,
          topic_id: queueRow.topic_id,
          status: queueRow.status,
          attempts: queueRow.attempts,
          last_error: queueRow.last_error,
          created_at: queueRow.created_at,
          claimed_at: queueRow.claimed_at,
          completed_at: queueRow.completed_at,
        }
      : null,
    topic: topic ? { id: topic.id, title: topic.title } : null,
    grade: grade ? { id: grade.id, name: grade.name } : null,
    subject: subject ? { id: subject.id, name: subject.name } : null,
    ordered_topic_outlines: topicId && outlineResult.status === "available"
      ? sortTopicOutlines(outlineResult.outlinesByTopicId.get(topicId) || [])
      : [],
    topic_outlines_status: outlineResult.status,
    existing_lessons: existingLessons,
    lesson_blocks: lessonBlocks,
    lesson_blocks_status: lessonBlocksStatus,
    generated_sql: typeof metadata.generated_sql === "string" ? metadata.generated_sql : null,
    safety_check: safetyCheck,
    logs: ((logs.data || []) as JsonRecord[]).map((log) => ({
      id: String(log.id),
      agent_name: String(log.agent_name || ""),
      log_type: String(log.log_type || ""),
      message: String(log.message || ""),
      metadata: parseJsonRecord(log.metadata),
      created_at: typeof log.created_at === "string" ? log.created_at : null,
    })),
    latest_approval: latestApproval.data ? (latestApproval.data as JsonRecord) : null,
  };
}

export async function generateAiRecoveryRepairSql(
  supabase: SupabaseClient,
  taskId: string,
) {
  const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
  const topicId = detail.queue_job?.topic_id || detail.topic?.id || null;
  const richLessons = topicId ? await loadRichExistingLessonsForTopic(supabase, topicId) : [];
  const prompt = buildAiRecoverySqlPrompt(detail, richLessons);
  const generation = await generateSqlWithConfiguredProvider(prompt);
  const generatedAt = nowIso();

  const nextMetadata = {
    ...detail.task.metadata,
    generated_sql: generation.sql,
    generated_sql_at: generatedAt,
    generated_sql_provider: generation.provider,
    generated_sql_model: generation.model,
  };
  delete nextMetadata.safety_check;

  await updateAiRecoveryTaskColumns(supabase, taskId, {
    metadata: nextMetadata,
    progress: Math.max(Number(detail.task.progress || 0), 20),
  });

  await createTaskLog(
    supabase,
    taskId,
    COMMAND_CENTER_AGENTS.sql,
    "sql",
    "Generated AI recovery SQL preview for human review.",
    {
      job_id: detail.task.job_id,
      topic_id: detail.queue_job?.topic_id || detail.topic?.id || null,
      provider: generation.provider,
      model: generation.model,
      generated_sql_at: generatedAt,
    },
  );

  return {
    generated_sql: generation.sql,
    detail: await loadAiRecoveryTaskDetail(supabase, taskId),
  };
}

export async function runAiRecoverySafetyCheck(
  supabase: SupabaseClient,
  taskId: string,
) {
  const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
  const sqlPreview = detail.generated_sql || "";
  const safetyCheck = buildAiRecoverySafetyCheck(sqlPreview, detail);

  const nextMetadata = {
    ...detail.task.metadata,
    safety_check: safetyCheck,
  };

  await updateAiRecoveryTaskColumns(supabase, taskId, {
    metadata: nextMetadata,
    progress: Math.max(Number(detail.task.progress || 0), 35),
  });

  await createTaskLog(
    supabase,
    taskId,
    COMMAND_CENTER_AGENTS.auditor,
    safetyCheck.allowed ? "validation" : "warning",
    "Ran AI recovery safety check.",
    safetyCheck,
  );

  return {
    safety_check: safetyCheck,
    detail: await loadAiRecoveryTaskDetail(supabase, taskId),
  };
}

export async function approveAiRecoveryTaskExecution(
  supabase: SupabaseClient,
  taskId: string,
  approvedBy: string,
) {
  const { task, issue } = await fetchTaskBundle(supabase, taskId);
  const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
  const generatedSql = detail.generated_sql;

  if (!generatedSql) {
    throw new AiCommandCenterHttpError(409, "Generate repair SQL before approving execution.");
  }

  const safetyCheck = parseJsonRecord(detail.safety_check);
  if (typeof safetyCheck.allowed !== "boolean") {
    throw new AiCommandCenterHttpError(409, "Run the safety check before approving execution.");
  }

  if (!safetyCheck.allowed) {
    const firstError =
      Array.isArray(safetyCheck.errors) && typeof safetyCheck.errors[0] === "string"
        ? safetyCheck.errors[0]
        : "Stored safety check did not approve this SQL preview.";
    throw new AiCommandCenterHttpError(409, firstError);
  }

  const riskLevel = typeof safetyCheck.riskLevel === "string" ? safetyCheck.riskLevel : buildSqlRisk(generatedSql).riskLevel;
  let approval = await fetchLatestPendingApproval(supabase, taskId);

  if (!approval) {
    const { data: createdApproval, error: approvalError } = await supabase
      .from("ai_task_approvals")
      .insert({
        task_id: taskId,
        proposed_action: "Approve guarded execution of the AI recovery SQL preview.",
        risk_level: riskLevel || "medium",
        sql_preview: generatedSql,
        affected_records: null,
        rollback_plan: buildRollbackPlan(task, issue),
        status: "pending",
      })
      .select("*")
      .single();

    if (approvalError || !createdApproval) {
      throw new Error(approvalError?.message || "Unable to create approval request.");
    }

    approval = createdApproval as ApprovalRow;
  }

  const { data: approvedRecord, error: approveError } = await supabase
    .from("ai_task_approvals")
    .update({
      status: "approved",
      approved_by: approvedBy,
      approved_at: nowIso(),
    })
    .eq("id", approval.id)
    .select("*")
    .single();

  if (approveError || !approvedRecord) {
    throw new Error(approveError?.message || "Unable to approve execution.");
  }

  await updateTaskStatus(supabase, taskId, "pending", 60);
  await createTaskLog(
    supabase,
    taskId,
    COMMAND_CENTER_AGENTS.reporter,
    "approval",
    "Human approval granted for the AI recovery SQL preview.",
    {
      approval_id: approval.id,
      approved_by: approvedBy,
      sql_preview: generatedSql,
    },
  );

  return {
    approval: approvedRecord,
    detail: await loadAiRecoveryTaskDetail(supabase, taskId),
  };
}

export async function rejectAiRecoveryTaskSql(
  supabase: SupabaseClient,
  taskId: string,
  reviewedBy: string,
  reason = "SQL preview rejected by reviewer.",
) {
  const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
  const approval = await fetchLatestPendingApproval(supabase, taskId);

  if (approval) {
    const { error } = await supabase
      .from("ai_task_approvals")
      .update({ status: "rejected" })
      .eq("id", approval.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  const nextMetadata = {
    ...detail.task.metadata,
    rejected_sql_reason: reason,
    rejected_sql_at: nowIso(),
  };

  await updateAiRecoveryTaskColumns(supabase, taskId, {
    metadata: nextMetadata,
  });

  await updateTaskStatus(supabase, taskId, "blocked", 58);
  await createTaskLog(
    supabase,
    taskId,
    COMMAND_CENTER_AGENTS.reporter,
    "approval",
    reason,
    {
      approval_id: approval?.id || null,
      reviewed_by: reviewedBy,
    },
  );

  return {
    success: true,
    detail: await loadAiRecoveryTaskDetail(supabase, taskId),
  };
}

export async function resetAiRecoveryTask(
  supabase: SupabaseClient,
  taskId: string,
  resetBy: string,
) {
  const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
  const nextMetadata = { ...detail.task.metadata };
  delete nextMetadata.generated_sql;
  delete nextMetadata.generated_sql_at;
  delete nextMetadata.safety_check;
  delete nextMetadata.rejected_sql_reason;
  delete nextMetadata.rejected_sql_at;

  await supabase
    .from("ai_task_approvals")
    .update({ status: "rejected" })
    .eq("task_id", taskId)
    .eq("status", "pending");

  await updateAiRecoveryTaskColumns(supabase, taskId, {
    metadata: nextMetadata,
    result: {},
    status: "pending",
    progress: 0,
    started_at: null,
    completed_at: null,
  });

  await createTaskLog(
    supabase,
    taskId,
    COMMAND_CENTER_AGENTS.reporter,
    "info",
    "AI recovery task was reset to pending.",
    { reset_by: resetBy },
  );

  return {
    success: true,
    detail: await loadAiRecoveryTaskDetail(supabase, taskId),
  };
}

export async function copyAiRecoverySqlPreview(
  supabase: SupabaseClient,
  taskId: string,
) {
  const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
  if (!detail.generated_sql) {
    throw new AiCommandCenterHttpError(404, "No generated SQL preview is available for this task.");
  }

  return { sql: detail.generated_sql };
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

function slugifySignature(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferPatternRiskLevel(severity: string) {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

async function upsertIssuePattern(supabase: SupabaseClient, issue: MonitoringIssueInput) {
  const now = nowIso();
  const { data: existing, error: fetchError } = await supabase
    .from("ai_issue_patterns")
    .select("*")
    .eq("error_signature", issue.error_signature)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const patternPayload = {
    issue_type: issue.issue_type,
    affected_area: issue.affected_area,
    known_fix: issue.suggested_action,
    auto_fixable: false,
    risk_level: inferPatternRiskLevel(issue.severity),
    metadata: {
      title: issue.title,
      evidence: issue.evidence,
    },
    last_seen_at: now,
  };

  if (existing) {
    const { error } = await supabase
      .from("ai_issue_patterns")
      .update({
        ...patternPayload,
        frequency: Number(existing.frequency || 0) + 1,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("ai_issue_patterns")
    .insert({
      error_signature: issue.error_signature,
      frequency: 1,
      success_rate: 0,
      first_seen_at: now,
      created_at: now,
      updated_at: now,
      ...patternPayload,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data?.id || null;
}

async function upsertMonitoringIssue(supabase: SupabaseClient, issue: MonitoringIssueInput) {
  const now = nowIso();
  const activeStatuses = ["open", "planning", "auditing", "waiting_approval", "running", "blocked"];
  const { data: existing, error: fetchError } = await supabase
    .from("ai_issues")
    .select("*")
    .eq("error_signature", issue.error_signature)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const issuePayload = {
    title: issue.title,
    severity: issue.severity,
    issue_type: issue.issue_type,
    affected_area: issue.affected_area,
    evidence: issue.evidence,
    impact: issue.impact,
    suggested_action: issue.suggested_action,
    error_signature: issue.error_signature,
    status: "open",
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("ai_issues")
      .update(issuePayload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("ai_issues")
    .insert({
      ...issuePayload,
      created_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function persistRagHealthReport(
  supabase: SupabaseClient,
  issueId: string | null,
  ragDiagnostic: Awaited<ReturnType<typeof runRagDiagnostic>>,
  input: {
    grade_id?: string | null;
    subject_id?: string | null;
    topic_id?: string | null;
    lesson_id?: string | null;
  } = {},
) {
  const status = ragDiagnostic.blocking_reason ? "blocked" : "completed";
  const payload = {
    task_id: null,
    issue_id: issueId,
    grade_id: input.grade_id || null,
    subject_id: input.subject_id || null,
    topic_id: input.topic_id || null,
    lesson_id: input.lesson_id || null,
    status,
    chunk_count: Number(ragDiagnostic.chunks_found || 0),
    valid_chunk_count: Number(ragDiagnostic.chunks_found || 0),
    minimum_chunk_count: 1,
    average_chunk_length: Number(ragDiagnostic.average_chunk_length || 0),
    relevance_score: Number(ragDiagnostic.relevance_score || 0),
    blocking_reason: ragDiagnostic.blocking_reason || null,
    report_data: ragDiagnostic,
    updated_at: nowIso(),
  };

  const { error } = await supabase.from("ai_rag_health_reports").insert(payload);
  if (error) throw error;
}

export async function runMonitoringSweep(
  supabase: SupabaseClient,
  runType = "manual",
) {
  const startedAt = nowIso();
  const { data: run, error: runError } = await supabase
    .from("ai_monitoring_runs")
    .insert({
      run_type: runType,
      status: "running",
      issues_detected: 0,
      grouped_issues: 0,
      started_at: startedAt,
      metadata: {},
      created_at: startedAt,
    })
    .select("*")
    .single();

  if (runError || !run) {
    throw new Error(runError?.message || "Unable to create monitoring run.");
  }

  try {
    const failedJobsResult = await safeSelect(
      supabase,
      "lesson_gen_queue",
      "id, topic_id, status, attempts, last_error, updated_at",
      (query) => query.limit(500).order("updated_at", { ascending: false }),
    );
    const lessonsResult = await safeSelect(
      supabase,
      "lessons",
      "id, topic_id, slug, lesson_order, title, lesson_title",
      (query) => query.limit(500),
    );

    const queueRows = failedJobsResult.data || [];
    const failedJobs = queueRows.filter((job: JsonRecord) =>
      ["failed", "retryable_failed", "permanent_failed"].includes(job.status),
    );
    const jobsMissingTopic = queueRows.filter((job: JsonRecord) => !job.topic_id);
    const permanentFailed = failedJobs.filter((job: JsonRecord) => Number(job.attempts || 0) >= MAX_AUTOMATIC_RETRIES);

    const lessons = lessonsResult.data || [];
    const duplicateLessonsMap = new Map<string, number>();
    lessons.forEach((lesson: JsonRecord) => {
      const key = `${lesson.topic_id || "none"}::${lesson.slug || lesson.lesson_title || lesson.title || "untitled"}::${lesson.lesson_order || "none"}`;
      duplicateLessonsMap.set(key, (duplicateLessonsMap.get(key) || 0) + 1);
    });
    const duplicateLessons = [...duplicateLessonsMap.entries()]
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));

    const ragDiagnostic = await runRagDiagnostic(supabase, {});

    const monitoringIssues: MonitoringIssueInput[] = [];

    if (failedJobs.length > 0) {
      monitoringIssues.push({
        title: "Failed lesson generation jobs detected",
        severity: permanentFailed.length > 0 ? "critical" : failedJobs.length >= 10 ? "high" : "medium",
        issue_type: "generation",
        affected_area: "lessons",
        error_signature: slugifySignature("lesson_gen_queue_failed_jobs"),
        evidence: {
          failed_jobs: failedJobs.length,
          permanent_failed_jobs: permanentFailed.length,
          sample_job_ids: failedJobs.slice(0, 10).map((job: JsonRecord) => job.id),
        },
        impact: `${failedJobs.length} lesson generation job(s) are failing and blocking fresh curriculum output.`,
        suggested_action: "Audit the failed queue entries, retry safe jobs, and isolate permanent failures before generation resumes.",
      });
    }

    if (jobsMissingTopic.length > 0) {
      monitoringIssues.push({
        title: "Lesson generation jobs are missing topic_id",
        severity: "high",
        issue_type: "validation",
        affected_area: "topics",
        error_signature: slugifySignature("lesson_gen_queue_missing_topic_id"),
        evidence: {
          missing_topic_jobs: jobsMissingTopic.length,
          sample_job_ids: jobsMissingTopic.slice(0, 10).map((job: JsonRecord) => job.id),
        },
        impact: "Jobs without topic_id cannot be safely mapped to lessons and must remain blocked.",
        suggested_action: "Restore exact topic mappings from database relations before retrying generation.",
      });
    }

    if (duplicateLessons.length > 0) {
      monitoringIssues.push({
        title: "Duplicate lesson groups detected",
        severity: duplicateLessons.length >= 5 ? "high" : "medium",
        issue_type: "audit",
        affected_area: "lessons",
        error_signature: slugifySignature("lessons_duplicate_groups"),
        evidence: {
          duplicate_groups: duplicateLessons.length,
          sample_groups: duplicateLessons.slice(0, 10),
        },
        impact: "Duplicate lessons create curriculum ambiguity and complicate retries, edits, and reporting.",
        suggested_action: "Review duplicate groups and decide whether to skip, update, or version them explicitly.",
      });
    }

    if (ragDiagnostic.blocking_reason || ragDiagnostic.chunks_found === 0) {
      monitoringIssues.push({
        title: "RAG health is blocking safe generation",
        severity: ragDiagnostic.chunks_found === 0 ? "critical" : "high",
        issue_type: "audit",
        affected_area: "rag_chunks",
        error_signature: slugifySignature("rag_chunks_global_health"),
        evidence: ragDiagnostic,
        impact: ragDiagnostic.blocking_reason || "RAG data is insufficient for safe lesson generation.",
        suggested_action: "Repair chunk coverage, validate relevance, and re-run RAG diagnostics before generation resumes.",
      });
    }

    const createdIssues = [];
    for (const issue of monitoringIssues) {
      await upsertIssuePattern(supabase, issue);
      const storedIssue = await upsertMonitoringIssue(supabase, issue);
      createdIssues.push(storedIssue);

      if (issue.affected_area === "rag_chunks") {
        await persistRagHealthReport(supabase, storedIssue.id, ragDiagnostic);
      }
    }

    const completedAt = nowIso();
    const metadata = {
      failed_jobs: failedJobs.length,
      missing_topic_jobs: jobsMissingTopic.length,
      duplicate_lesson_groups: duplicateLessons.length,
      rag: ragDiagnostic,
      issue_signatures: monitoringIssues.map((issue) => issue.error_signature),
    };

    const { data: finalRun, error: finalRunError } = await supabase
      .from("ai_monitoring_runs")
      .update({
        status: "completed",
        issues_detected: monitoringIssues.length,
        grouped_issues: monitoringIssues.length,
        completed_at: completedAt,
        metadata,
      })
      .eq("id", run.id)
      .select("*")
      .single();

    if (finalRunError || !finalRun) {
      throw new Error(finalRunError?.message || "Unable to finalize monitoring run.");
    }

    return {
      run: finalRun,
      issues: createdIssues,
      summary: metadata,
    };
  } catch (error) {
    await supabase
      .from("ai_monitoring_runs")
      .update({
        status: "failed",
        completed_at: nowIso(),
        metadata: { error: normalizeError(error) },
      })
      .eq("id", run.id);
    throw error;
  }
}
