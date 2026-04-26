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

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await normalizeError(response));
  }

  return response.json();
};

const getCurrentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
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

export const runAudit = async (taskId) => {
  return postJson("/api/ai-run-audit", { task_id: taskId });
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

  const { data, error } = await supabase
    .from("ai_task_approvals")
    .insert({ task_id: taskId, ...approvalPayload, status: "pending" })
    .select("*")
    .single();

  if (error) throw error;

  await updateTaskStatus(taskId, "waiting_approval", 55);
  await supabase.from("ai_task_logs").insert({
    task_id: taskId,
    agent_name: "SQL Agent",
    log_type: "approval",
    message: "Approval request created for the proposed write action.",
    metadata: approvalPayload,
  });

  return data;
};

export const approveTask = async (taskId) => {
  const userId = await getCurrentUserId();
  const { data: approval, error: fetchError } = await supabase
    .from("ai_task_approvals")
    .select("*")
    .eq("task_id", taskId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!approval) throw new Error("No pending approval request found for this task.");

  const { data, error } = await supabase
    .from("ai_task_approvals")
    .update({
      status: "approved",
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", approval.id)
    .select("*")
    .single();

  if (error) throw error;

  await updateTaskStatus(taskId, "pending", 60);
  await supabase.from("ai_task_logs").insert({
    task_id: taskId,
    agent_name: "Reporter Agent",
    log_type: "approval",
    message: "Human approval granted. Worker can execute the write action.",
    metadata: { approval_id: approval.id, approved_by: userId },
  });

  return data;
};

export const rejectTask = async (taskId, reason = "Approval rejected by reviewer.") => {
  const { data: approval, error: fetchError } = await supabase
    .from("ai_task_approvals")
    .select("*")
    .eq("task_id", taskId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (approval) {
    const { error } = await supabase
      .from("ai_task_approvals")
      .update({ status: "rejected" })
      .eq("id", approval.id);
    if (error) throw error;
  }

  await updateTaskStatus(taskId, "blocked", 58);
  await supabase.from("ai_task_logs").insert({
    task_id: taskId,
    agent_name: "Reporter Agent",
    log_type: "approval",
    message: reason,
    metadata: { approval_id: approval?.id || null },
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
  getTaskById,
  createIssue,
  createTask,
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
