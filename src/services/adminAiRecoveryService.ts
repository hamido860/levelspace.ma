import { supabase } from "../db/supabase";

export interface AiRecoveryTaskRef {
  id: string;
  issue_id: string;
  job_id: string | null;
  title: string | null;
  status: string;
  created_at: string | null;
}

export interface AiRecoveryFailedJobSummary {
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
}

export interface AiRecoveryJobDiagnostics {
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
  ordered_topic_outlines: Record<string, unknown>[];
  topic_outlines_status: "available" | "missing_table";
  existing_lessons_count: number;
  existing_lesson_blocks_count: number | null;
  lesson_blocks_status: "available" | "missing_table";
  existing_task: AiRecoveryTaskRef | null;
}

export interface CreateAiRecoveryTaskResult {
  task: AiRecoveryTaskRef;
  issue_id: string;
  already_exists: boolean;
  message: string;
}

export interface AiRecoveryTaskLogEntry {
  id: string;
  agent_name: string;
  log_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
}

export interface AiRecoveryTaskDetail {
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
    metadata: Record<string, unknown>;
    result: Record<string, unknown>;
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
  ordered_topic_outlines: Record<string, unknown>[];
  topic_outlines_status: "available" | "missing_table";
  existing_lessons: Record<string, unknown>[];
  lesson_blocks: Record<string, unknown>[];
  lesson_blocks_status: "available" | "missing_table";
  generated_sql: string | null;
  safety_check: Record<string, unknown> | null;
  logs: AiRecoveryTaskLogEntry[];
  latest_approval: Record<string, unknown> | null;
}

async function getAdminApiHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function parseError(response: Response) {
  try {
    const payload = await response.json();
    return payload.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const headers = await getAdminApiHeaders();
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string): Promise<T> {
  const headers = await getAdminApiHeaders();
  const response = await fetch(url, { method: "POST", headers });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
}

export async function getAiRecoveryFailedJobs() {
  const payload = await getJson<{ jobs: AiRecoveryFailedJobSummary[] }>("/api/admin/ai-recovery/failed-jobs");
  return payload.jobs || [];
}

export async function getAiRecoveryJobDiagnostics(jobId: string) {
  const payload = await getJson<{ diagnostics: AiRecoveryJobDiagnostics }>(
    `/api/admin/ai-recovery/jobs/${encodeURIComponent(jobId)}/diagnostics`,
  );
  return payload.diagnostics;
}

export async function createAiRecoveryTask(jobId: string) {
  return postJson<CreateAiRecoveryTaskResult>(
    `/api/admin/ai-recovery/jobs/${encodeURIComponent(jobId)}/create-task`,
  );
}

export async function getAiRecoveryTaskDetail(taskId: string) {
  const payload = await getJson<{ detail: AiRecoveryTaskDetail }>(
    `/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/detail`,
  );
  return payload.detail;
}

export async function generateAiRecoverySql(taskId: string) {
  return postJson<{ generated_sql: string; detail: AiRecoveryTaskDetail }>(
    `/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/generate-sql`,
  );
}

export async function runAiRecoverySafetyCheck(taskId: string) {
  return postJson<{ safety_check: Record<string, unknown>; detail: AiRecoveryTaskDetail }>(
    `/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/safety-check`,
  );
}

export async function approveAiRecoveryExecution(taskId: string) {
  return postJson<{ approval: Record<string, unknown>; detail: AiRecoveryTaskDetail }>(
    `/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/approve-execute`,
  );
}

export async function rejectAiRecoverySql(taskId: string) {
  const headers = await getAdminApiHeaders();
  const response = await fetch(`/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/reject-sql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason: "SQL preview rejected from AI Recovery detail page." }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<{ success: true; detail: AiRecoveryTaskDetail }>;
}

export async function copyAiRecoverySql(taskId: string) {
  return postJson<{ sql: string }>(
    `/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/copy-sql`,
  );
}

export async function resetAiRecoveryTask(taskId: string) {
  return postJson<{ success: true; detail: AiRecoveryTaskDetail }>(
    `/api/admin/ai-recovery/tasks/${encodeURIComponent(taskId)}/reset`,
  );
}
