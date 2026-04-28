import { supabase } from "../db/supabase";

const API_HEADERS = {
  "Content-Type": "application/json",
};

export const AI_COMMAND_CENTER_AGENTS = [
  "Planner Agent",
  "Auditor Agent",
  "RAG Agent",
  "SQL Agent",
  "Worker Agent",
  "Validator Agent",
  "Reporter Agent",
];

export const AI_TASK_STATUSES = [
  "pending",
  "planning",
  "auditing",
  "waiting_for_chunks",
  "waiting_approval",
  "running",
  "validating",
  "completed",
  "failed",
  "blocked",
];

export const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"];
export const ISSUE_TYPE_OPTIONS = ["fix", "audit", "generation", "validation", "migration"];
export const TARGET_AREA_OPTIONS = ["lessons", "topics", "rag_chunks", "profiles", "onboarding", "supabase_schema"];
export const EXECUTION_MODE_OPTIONS = ["dry_run", "execute_with_approval", "execute"];
export const SAFETY_LEVEL_OPTIONS = ["read_only", "write_allowed", "destructive_blocked"];
export const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"];

const BLOCKED_SQL_PATTERNS = [/\bDROP\b/i, /\bTRUNCATE\b/i, /\bDELETE\b/i, /\bALTER\s+TABLE\b/i];

const isWriteTarget = (targetArea) => ["lessons", "topics", "rag_chunks", "profiles", "onboarding", "supabase_schema"].includes(targetArea);

const isDatabaseWriteOperation = (task) =>
  isWriteTarget(task.target_area) &&
  task.safety_level !== "read_only" &&
  task.execution_mode !== "dry_run";

const normalizeError = async (response) => {
  try {
    const payload = await response.json();
    return payload.error || "Request failed";
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const getApiHeaders = async () => {
  const headers = { ...API_HEADERS };
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
};

const postJson = async (url, body) => {
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await normalizeError(response));
  }

  return response.json();
};

const normalizeTaskInput = (task) => {
  const criticalMode = task.priority === "critical" ? "execute_with_approval" : task.execution_mode;
  const execution_mode = criticalMode || "execute_with_approval";
  const safety_level = task.safety_level || "destructive_blocked";
  const dangerousRequested =
    (task.instructions || "").toUpperCase().match(/\b(DROP|TRUNCATE|DELETE|ALTER TABLE)\b/) ||
    BLOCKED_SQL_PATTERNS.some((pattern) => pattern.test(task.sql_preview || ""));

  const requiresApproval =
    task.requires_approval ||
    execution_mode === "execute_with_approval" ||
    isDatabaseWriteOperation({ ...task, execution_mode, safety_level });

  return {
    ...task,
    execution_mode,
    safety_level: dangerousRequested ? "destructive_blocked" : safety_level,
    requires_approval: requiresApproval,
    status: task.status || "pending",
    progress: task.progress ?? 0,
  };
};

const inferTargetAreaFromAnalystTask = (task) => {
  const content = `${task?.title || ""} ${task?.description || ""} ${task?.metric_basis || ""}`.toLowerCase();

  if (content.includes("rag") || content.includes("chunk") || content.includes("embedding")) {
    return "rag_chunks";
  }
  if (content.includes("topic")) {
    return "topics";
  }
  if (content.includes("lesson")) {
    return "lessons";
  }
  if (content.includes("profile") || content.includes("user")) {
    return "profiles";
  }
  if (content.includes("onboarding")) {
    return "onboarding";
  }

  return "supabase_schema";
};

const inferIssueTypeFromActionType = (actionType) => {
  if (actionType === "generate") return "generation";
  if (actionType === "review") return "audit";
  if (actionType === "optimize") return "validation";
  return "fix";
};

export const getIssues = async () => {
  const { data, error } = await supabase
    .from("ai_issues")
    .select("*, ai_tasks(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getTasks = async () => {
  const { data, error } = await supabase
    .from("ai_tasks")
    .select("*, ai_issues(*), ai_task_approvals(*)")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((task) => ({
    ...task,
    ai_task_approvals: (task.ai_task_approvals || []).sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    ),
  }));
};

export const getMonitoringRuns = async () => {
  const { data, error } = await supabase
    .from("ai_monitoring_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(8);

  if (error) throw error;
  return data || [];
};

export const getIssuePatterns = async () => {
  const { data, error } = await supabase
    .from("ai_issue_patterns")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(8);

  if (error) throw error;
  return data || [];
};

export const getRagHealthReports = async () => {
  const { data, error } = await supabase
    .from("ai_rag_health_reports")
    .select("*, ai_issues(title)")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw error;
  return data || [];
};

export const getTaskById = async (taskId) => {
  const { data, error } = await supabase
    .from("ai_tasks")
    .select("*, ai_issues(*), ai_task_approvals(*)")
    .eq("id", taskId)
    .single();

  if (error) throw error;
  return {
    ...data,
    ai_task_approvals: (data?.ai_task_approvals || []).sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    ),
  };
};

export const createIssue = async (issue) => {
  const payload = {
    evidence: {},
    impact: "",
    suggested_action: "",
    status: "open",
    ...issue,
  };

  const { data, error } = await supabase
    .from("ai_issues")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const createTask = async (task) => {
  const normalizedTask = normalizeTaskInput(task);

  if (normalizedTask.safety_level === "destructive_blocked" && normalizedTask.execution_mode === "execute") {
    normalizedTask.execution_mode = "execute_with_approval";
  }

  const { data, error } = await supabase
    .from("ai_tasks")
    .insert(normalizedTask)
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("ai_task_logs").insert({
    task_id: data.id,
    agent_name: "Planner Agent",
    log_type: "info",
    message: "Task created and queued for planning.",
    metadata: {
      issue_id: normalizedTask.issue_id,
      execution_mode: normalizedTask.execution_mode,
      safety_level: normalizedTask.safety_level,
    },
  });

  const plan = await postJson("/api/ai-plan-task", { task_id: data.id, issue_id: normalizedTask.issue_id });

  let approval = null;
  if (plan.approvalRequired) {
    approval = await requestApproval(data.id, {
      proposed_action: plan.proposedAction,
      risk_level: plan.riskLevel,
      sql_preview: plan.sqlPreview,
      affected_records: normalizedTask.estimated_records || null,
      rollback_plan: plan.rollbackPlan,
    });
  }

  return { task: data, plan, approval };
};

export const createCommandCenterTaskFromAnalystTask = async (analystTask, context = {}) => {
  const priority = analystTask.priority || "medium";
  const targetArea = inferTargetAreaFromAnalystTask(analystTask);
  const issueType = inferIssueTypeFromActionType(analystTask.action_type);
  const instructions = [
    analystTask.description,
    analystTask.metric_basis ? `Metric basis: ${analystTask.metric_basis}` : null,
    analystTask.estimated_impact ? `Expected impact: ${analystTask.estimated_impact}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const issue = await createIssue({
    title: analystTask.title,
    severity: priority,
    issue_type: issueType,
    affected_area: targetArea,
    evidence: {
      source: "ai_analyst",
      analyst_task_id: analystTask.id,
      metric_basis: analystTask.metric_basis || null,
      action_type: analystTask.action_type || null,
      context,
    },
    impact: analystTask.estimated_impact || analystTask.description || "",
    suggested_action: analystTask.description || "",
    status: "open",
  });

  const taskResult = await createTask({
    issue_id: issue.id,
    title: analystTask.title,
    task_name: analystTask.title,
    task_type: issueType,
    priority,
    assigned_agent: "Planner Agent",
    execution_mode: "execute_with_approval",
    safety_level: "destructive_blocked",
    target_area: targetArea,
    instructions,
    requires_approval: true,
    progress: 0,
    status: "pending",
  });

  return {
    issue,
    ...taskResult,
  };
};

export const runAudit = async (taskId) => {
  return postJson("/api/ai-run-audit", { task_id: taskId });
};

export const runMonitoring = async () => {
  return postJson("/api/ai-run-monitoring", { run_type: "manual" });
};

export const requestApproval = async (taskId, proposedAction) => {
  const approvalPayload =
    typeof proposedAction === "string"
      ? {
          proposed_action: proposedAction,
          risk_level: "medium",
          sql_preview: null,
          affected_records: null,
          rollback_plan: "Restore from the latest execution snapshot before retrying.",
        }
      : {
          proposed_action: proposedAction.proposed_action || proposedAction.proposedAction || "Approve guarded write action.",
          risk_level: proposedAction.risk_level || proposedAction.riskLevel || "medium",
          sql_preview: proposedAction.sql_preview || proposedAction.sqlPreview || null,
          affected_records: proposedAction.affected_records ?? proposedAction.affectedRecords ?? null,
          rollback_plan:
            proposedAction.rollback_plan ||
            proposedAction.rollbackPlan ||
            "Restore from the latest execution snapshot before retrying.",
        };

  return postJson("/api/ai-request-approval", {
    task_id: taskId,
    ...approvalPayload,
  });
};

export const approveTask = async (taskId) => {
  return postJson("/api/ai-approve-task", { task_id: taskId });
};

export const rejectTask = async (taskId, reason = "Approval rejected by reviewer.") => {
  return postJson("/api/ai-reject-task", {
    task_id: taskId,
    reason,
  });
};

export const runTask = async (taskId) => {
  const result = await postJson("/api/ai-execute-task", { task_id: taskId });

  if (result?.dry_run) {
    await updateTaskStatus(taskId, "completed", 100);
    await supabase.from("ai_task_logs").insert({
      task_id: taskId,
      agent_name: "Validator Agent",
      log_type: "validation",
      message: "Dry run completed. No database writes were performed.",
      metadata: result.execution_result || {},
    });
    return result;
  }

  if (result?.success) {
    const validation = await validateTask(taskId);
    return { ...result, validation };
  }

  return result;
};

export const getTaskLogs = async (taskId) => {
  const { data, error } = await supabase
    .from("ai_task_logs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getTaskApproval = async (taskId) => {
  const { data, error } = await supabase
    .from("ai_task_approvals")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const validateTask = async (taskId) => {
  return postJson("/api/ai-validate-task", { task_id: taskId });
};

export const createExecutionSnapshot = async (taskId) => {
  const task = await getTaskById(taskId);
  const snapshotPayload = {
    task_id: taskId,
    snapshot_type: "manual_checkpoint",
    target_table: task.target_area,
    record_count: null,
    snapshot_data: {
      requested_at: new Date().toISOString(),
      task_name: task.task_name,
      issue_title: task.ai_issues?.title || null,
    },
  };

  const { data, error } = await supabase
    .from("ai_execution_snapshots")
    .insert(snapshotPayload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const updateTaskStatus = async (taskId, status, progress) => {
  const payload = {
    status,
    progress,
    updated_at: new Date().toISOString(),
  };

  if (status === "running") payload.started_at = new Date().toISOString();
  if (["completed", "failed", "blocked"].includes(status)) {
    payload.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("ai_tasks")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export default {
  getIssues,
  getTasks,
  getMonitoringRuns,
  getIssuePatterns,
  getRagHealthReports,
  getTaskById,
  createIssue,
  createTask,
  createCommandCenterTaskFromAnalystTask,
  runMonitoring,
  runAudit,
  requestApproval,
  approveTask,
  rejectTask,
  runTask,
  getTaskLogs,
  getTaskApproval,
  validateTask,
  createExecutionSnapshot,
  updateTaskStatus,
};
