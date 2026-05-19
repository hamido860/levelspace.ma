import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import handleSupabaseHealth from "../src/server/api/supabaseHealth";
import { handleAIEmbed, handleAIGenerate, handleAIExplain, handleAILessonBlocks, handleAIStatus } from "../src/server/api/aiHandlers";
import { generateAIResponse, type AIProviderName, type AICredentialMode } from "../src/lib/ai/provider";
import { handleDeleteUserAiKey, handleTestUserAiKey, handleUserAiKeys } from "../src/server/api/userAiKeys";
import { backfillTopicsFromLessons } from "../lib/topicSync";
import { seedStarterLessonsFromTopics } from "../src/server/curriculum/starterLessons";
import {
  AiCommandCenterHttpError,
  type AiRecoveryRecoveredLessonStatus,
  buildExecutionPlan,
  COMMAND_CENTER_AGENTS,
  copyAiRecoverySqlPreview,
  createAiRecoveryTaskForJob,
  createExecutionSnapshot,
  createTaskLog,
  executeAiRecoveryTaskSql,
  fetchLatestPendingApproval,
  fetchTaskBundle,
  generateAiRecoveryRepairSql,
  getServerSupabase,
  isWriteMode,
  loadAiRecoveryFailedJobs,
  loadAiRecoveryJobDiagnostics,
  loadAiRecoveryLogs,
  loadAiRecoveryRecoveredLessonDetail,
  loadAiRecoveryRecoveredLessons,
  loadAiRecoveryTaskDetail,
  loadRagChunkHealth,
  MAX_AUTOMATIC_RETRIES,
  requireAdminUser,
  requireAiAdmin,
  requireAuthenticatedUser,
  repairRagTopicLinks,
  resetAiRecoveryTask,
  runAiRecoverySafetyCheck,
  runAuditForTask,
  runMonitoringSweep,
  runRagDiagnostic,
  saveRecoveredLessonReviewEdits,
  sendRecoveredLessonToAi,
  updateRecoveredLessonReviewStatus,
  updateTaskStatus,
  validateTaskExecution,
  approveAiRecoveryTaskExecution,
  rejectAiRecoveryTaskSql,
} from "../src/server/api/aiCommandCenter";
import {
  applyCurriculumReviewAction,
  CURRICULUM_CONTENT_TYPES,
  CURRICULUM_VALIDATION_STATUSES,
  type CurriculumContentType,
  type CurriculumReviewFilters,
  type CurriculumValidationStatus,
  loadCurriculumReviewDetail,
  loadCurriculumReviewItems,
} from "../src/server/api/curriculumValidation";
import { getServerSupabaseEnv } from "../src/lib/supabase/server";

type JsonBody = Record<string, any>;
type RouteHandler = (req: VercelRequest, res: VercelResponse, segments: string[]) => Promise<VercelResponse | void>;
const MAX_STARTER_TOPIC_IDS_PER_REQUEST = 25;

function getSegments(req: VercelRequest) {
  const slug = req.query?.slug;
  const toSegments = (value: string) =>
    value
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })
      .filter(Boolean);

  if (Array.isArray(slug)) return slug.flatMap((value) => toSegments(String(value)));
  if (typeof slug === "string" && slug) return toSegments(slug);
  return [];
}

function getBody(req: VercelRequest): JsonBody {
  return req.body && typeof req.body === "object" ? (req.body as JsonBody) : {};
}

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readQuery(req: VercelRequest, key: string) {
  return readString(req.query?.[key]);
}

function routeKey(segments: string[]) {
  return segments.join("/");
}

function sendError(res: VercelResponse, error: unknown, fallbackMessage: string) {
  if (error instanceof AiCommandCenterHttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({
    error: error instanceof Error ? error.message : fallbackMessage,
  });
}

function readContentType(value: string | undefined): CurriculumContentType {
  if (value && (CURRICULUM_CONTENT_TYPES as readonly string[]).includes(value)) {
    return value as CurriculumContentType;
  }
  throw new AiCommandCenterHttpError(400, "content_type is required.");
}

function readReviewContentType(value: string | undefined): CurriculumContentType | "all" | null {
  if (!value || value === "all") return "all";
  if ((CURRICULUM_CONTENT_TYPES as readonly string[]).includes(value)) {
    return value as CurriculumContentType;
  }
  throw new AiCommandCenterHttpError(400, "Unsupported content_type filter.");
}

function readValidationStatus(value: string | undefined): CurriculumValidationStatus | "all" | null {
  if (!value || value === "all") return "all";
  if ((CURRICULUM_VALIDATION_STATUSES as readonly string[]).includes(value)) {
    return value as CurriculumValidationStatus;
  }
  throw new AiCommandCenterHttpError(400, "Unsupported validation_status filter.");
}

function readRecoveryStatus(value: string | undefined): AiRecoveryRecoveredLessonStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }
  return "needs_review";
}

async function handleNvidiaProxy(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAuthenticatedUser(req);
  } catch (error) {
    return sendError(res, error, "Authentication failed");
  }

  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey || apiKey === "MY_NVIDIA_API_KEY") {
    return res.status(503).json({ error: "NVIDIA API key not configured." });
  }

  try {
    const response = await axios.post(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error.message;
    console.error("[NVIDIA Proxy] Error:", message);
    return res
      .status(error?.response?.status || 502)
      .json(error?.response?.data || { error: `NVIDIA API error: ${message}` });
  }
}

async function handleAiRoot(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    ok: true,
    routes: [
      "/api/ai/status",
      "/api/ai/generate",
      "/api/ai/explain",
      "/api/ai/lesson-blocks",
      "/api/ai/embed",
    ],
  });
}

async function handleSupabasePublicConfig(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const env = getServerSupabaseEnv();
  return res.status(200).json({
    configured: env.urlConfigured && env.anonKeyConfigured,
    url: env.urlConfigured ? env.url : null,
    anonKey: env.anonKeyConfigured ? env.anonKey : null,
  });
}

async function handleAiPlanTask(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { task_id } = getBody(req) as { task_id?: string; issue_id?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    const { task, issue } = await fetchTaskBundle(supabase, task_id);
    const plan = buildExecutionPlan(task, issue);

    await updateTaskStatus(supabase, task_id, "planning", 15);
    await createTaskLog(
      supabase,
      task_id,
      COMMAND_CENTER_AGENTS.planner,
      "info",
      `Planner created an execution plan with ${plan.riskLevel} risk.`,
      plan,
    );

    return res.status(200).json(plan);
  } catch (error) {
    return sendError(res, error, "Unable to build plan.");
  }
}

async function handleAiExecuteTask(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { task_id } = getBody(req) as { task_id?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    const { task, issue, latestApproval } = await fetchTaskBundle(supabase, task_id);
    const plan = buildExecutionPlan(task, issue);

    if (plan.destructiveBlocked) {
      await updateTaskStatus(supabase, task_id, "blocked", 55);
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.sql,
        "error",
        "Execution blocked because the generated SQL is destructive or missing a WHERE clause.",
        { sql_preview: plan.sqlPreview, risk_level: plan.riskLevel },
      );
      return res.status(409).json({
        error: "Dangerous SQL is blocked by default.",
        blocked: true,
        sql_preview: plan.sqlPreview,
      });
    }

    if (isWriteMode(task) && latestApproval?.status !== "approved") {
      await updateTaskStatus(supabase, task_id, "waiting_approval", 55);
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.worker,
        "approval",
        "Worker is waiting for an approved write action before executing.",
        { approval_status: latestApproval?.status || "missing" },
      );
      return res.status(409).json({ error: "Approval is required before execution.", waiting_approval: true });
    }

    await updateTaskStatus(supabase, task_id, "running", 70);
    await createTaskLog(
      supabase,
      task_id,
      COMMAND_CENTER_AGENTS.worker,
      "info",
      "Worker started execution.",
      { execution_mode: task.execution_mode, target_area: task.target_area },
    );

    if (task.execution_mode !== "dry_run" && isWriteMode(task)) {
      const snapshot = await createExecutionSnapshot(supabase, task, issue);
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.worker,
        "info",
        "Created pre-execution snapshot.",
        snapshot,
      );
    }

    const lowerTitle = `${issue.title} ${task.task_name}`.toLowerCase();
    let executionResult: Record<string, any> = {
      mode: task.execution_mode,
      updated_jobs: 0,
      permanent_failed_jobs: 0,
      blocked_reasons: [],
      sql_preview: plan.sqlPreview,
    };

    if (task.execution_mode === "dry_run") {
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.worker,
        "sql",
        "Dry run only. No write operations were executed.",
        { sql_preview: plan.sqlPreview },
      );
      return res.status(200).json({ success: true, dry_run: true, execution_result: executionResult });
    }

    if (lowerTitle.includes("missing topic")) {
      await updateTaskStatus(supabase, task_id, "blocked", 72);
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.auditor,
        "error",
        "Execution blocked because no exact topic_id mapping could be resolved from database relations.",
        {},
      );
      return res.status(409).json({
        error: "No topic_id, no lesson. The task remains blocked until an exact mapping exists.",
        blocked: true,
      });
    }

    if (lowerTitle.includes("duplicate")) {
      await updateTaskStatus(supabase, task_id, "waiting_approval", 72);
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.worker,
        "warning",
        "Duplicate lesson remediation requires an explicit action choice. Default action remains skip.",
        { allowed_actions: ["skip", "update_existing", "create_new_version"], default_action: "skip" },
      );
      return res.status(409).json({
        error: "Duplicate lesson action choice required.",
        waiting_approval: true,
        allowed_actions: ["skip", "update_existing", "create_new_version"],
      });
    }

    if (lowerTitle.includes("failed lesson generation")) {
      const { data: queueRows, error: queueError } = await supabase
        .from("lesson_gen_queue")
        .select("id, status, attempts")
        .in("status", ["failed", "retryable_failed", "permanent_failed"]);

      if (queueError) throw queueError;

      const retryableRows = (queueRows || []).filter((row: { id: string; attempts: number | null }) => Number(row.attempts || 0) < MAX_AUTOMATIC_RETRIES);
      const permanentRows = (queueRows || []).filter((row: { id: string; attempts: number | null }) => Number(row.attempts || 0) >= MAX_AUTOMATIC_RETRIES);

      if (retryableRows.length > 0) {
        const { error: retryError } = await supabase
          .from("lesson_gen_queue")
          .update({ status: "pending", claimed_at: null, last_error: null, updated_at: new Date().toISOString() })
          .in("id", retryableRows.map((row) => row.id));
        if (retryError) throw retryError;
      }

      if (permanentRows.length > 0) {
        const { error: permanentError } = await supabase
          .from("lesson_gen_queue")
          .update({ status: "permanent_failed", updated_at: new Date().toISOString() })
          .in("id", permanentRows.map((row) => row.id));
        if (permanentError) throw permanentError;
      }

      executionResult = {
        ...executionResult,
        updated_jobs: retryableRows.length,
        permanent_failed_jobs: permanentRows.length,
      };

      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.worker,
        "info",
        `Retried ${retryableRows.length} failed jobs and marked ${permanentRows.length} jobs permanent_failed.`,
        executionResult,
      );
    } else {
      await createTaskLog(
        supabase,
        task_id,
        COMMAND_CENTER_AGENTS.worker,
        "info",
        "No specialized write handler matched this task, so execution stayed in guarded no-op mode.",
        executionResult,
      );
    }

    await updateTaskStatus(supabase, task_id, "validating", 85);
    return res.status(200).json({ success: true, execution_result: executionResult });
  } catch (error) {
    return sendError(res, error, "Unable to execute task.");
  }
}

async function handleAiApproveTask(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const { task_id } = getBody(req) as { task_id?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    await fetchTaskBundle(supabase, task_id);
    const approval = await fetchLatestPendingApproval(supabase, task_id);

    if (!approval) {
      return res.status(404).json({ error: "No pending approval request found for this task." });
    }

    const { data, error } = await supabase
      .from("ai_task_approvals")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", approval.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to approve task.");
    }

    await updateTaskStatus(supabase, task_id, "pending", 60);
    await createTaskLog(
      supabase,
      task_id,
      COMMAND_CENTER_AGENTS.reporter,
      "approval",
      "Human approval granted. Worker can execute the write action.",
      { approval_id: approval.id, approved_by: user.id },
    );

    return res.status(200).json(data);
  } catch (error) {
    return sendError(res, error, "Unable to approve task.");
  }
}

async function handleAiRejectTask(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const { task_id, reason } = getBody(req) as { task_id?: string; reason?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    await fetchTaskBundle(supabase, task_id);
    const approval = await fetchLatestPendingApproval(supabase, task_id);
    const rejectionReason = reason || "Approval rejected by reviewer.";

    if (approval) {
      const { error } = await supabase
        .from("ai_task_approvals")
        .update({ status: "rejected" })
        .eq("id", approval.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    await updateTaskStatus(supabase, task_id, "blocked", 58);
    await createTaskLog(
      supabase,
      task_id,
      COMMAND_CENTER_AGENTS.reporter,
      "approval",
      rejectionReason,
      {
        approval_id: approval?.id || null,
        reviewed_by: user.id,
      },
    );

    return res.status(200).json({
      success: true,
      approval_id: approval?.id || null,
      status: approval ? "rejected" : "blocked",
    });
  } catch (error) {
    return sendError(res, error, "Unable to reject task.");
  }
}

async function handleAiRequestApproval(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { task_id, proposed_action, risk_level, sql_preview, affected_records, rollback_plan } = getBody(req) as {
      task_id?: string;
      proposed_action?: string;
      risk_level?: string;
      sql_preview?: string | null;
      affected_records?: number | null;
      rollback_plan?: string | null;
    };

    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    await fetchTaskBundle(supabase, task_id);

    const approvalPayload = {
      task_id,
      proposed_action: proposed_action || "Approve guarded write action.",
      risk_level: risk_level || "medium",
      sql_preview: sql_preview || null,
      affected_records: affected_records ?? null,
      rollback_plan: rollback_plan || "Restore from the latest execution snapshot before retrying.",
      status: "pending",
    };

    const { data: approval, error } = await supabase
      .from("ai_task_approvals")
      .insert(approvalPayload)
      .select("*")
      .single();

    if (error || !approval) {
      throw new Error(error?.message || "Unable to create approval request.");
    }

    await updateTaskStatus(supabase, task_id, "waiting_approval", 55);
    await createTaskLog(
      supabase,
      task_id,
      COMMAND_CENTER_AGENTS.sql,
      "approval",
      "Approval request created for the proposed write action.",
      approvalPayload,
    );

    return res.status(200).json(approval);
  } catch (error) {
    return sendError(res, error, "Unable to request approval.");
  }
}

async function handleAiRunAudit(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { task_id } = getBody(req) as { task_id?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    const { task, issue } = await fetchTaskBundle(supabase, task_id);

    await updateTaskStatus(supabase, task_id, "auditing", 35);
    const audit = await runAuditForTask(supabase, task, issue);

    for (const log of audit.logs) {
      await createTaskLog(supabase, task_id, log.agent_name, log.log_type, log.message, log.metadata);
    }

    const nextStatus = audit.report.recommended_status;
    await updateTaskStatus(
      supabase,
      task_id,
      nextStatus,
      nextStatus === "waiting_approval" ? 55 : nextStatus === "waiting_for_chunks" ? 45 : 50,
    );

    return res.status(200).json(audit);
  } catch (error) {
    return sendError(res, error, "Unable to run audit.");
  }
}

async function handleAiRunMonitoring(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { run_type } = getBody(req) as { run_type?: string };
    const supabase = getServerSupabase();
    const result = await runMonitoringSweep(supabase, run_type || "manual");
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, "Unable to run monitoring.");
  }
}

async function handleAiValidateTask(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { task_id } = getBody(req) as { task_id?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    const { task, issue } = await fetchTaskBundle(supabase, task_id);
    const validation = await validateTaskExecution(supabase, task, issue);

    for (const log of validation.logs) {
      await createTaskLog(supabase, task_id, log.agent_name, log.log_type, log.message, log.metadata);
    }

    await updateTaskStatus(
      supabase,
      task_id,
      validation.validation_report.final_status,
      validation.validation_report.passed ? 100 : 92,
    );
    await supabase
      .from("ai_issues")
      .update({ status: validation.validation_report.issue_status, updated_at: new Date().toISOString() })
      .eq("id", issue.id);

    return res.status(200).json(validation);
  } catch (error) {
    return sendError(res, error, "Unable to validate task.");
  }
}

async function handleAiRagCheck(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const body = getBody(req) as {
      grade_id?: string | null;
      subject_id?: string | null;
      topic_id?: string | null;
      lesson_id?: string | null;
    };

    const supabase = getServerSupabase();
    const diagnostic = await runRagDiagnostic(supabase, body);
    return res.status(200).json(diagnostic);
  } catch (error) {
    return sendError(res, error, "Unable to run RAG diagnostic.");
  }
}

async function handleAiAnalyst(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const actionPrompts = {
    insights: `Analyze these database metrics and return JSON:
{
  "summary": "2-3 sentence executive summary of the overall state",
  "highlights": [ { "type": "warning|success|info", "title": "...", "detail": "..." } ],
  "bottlenecks": [ { "area": "...", "severity": "high|medium|low", "description": "..." } ]
}`,
    tasks: `Based on these metrics, return a prioritized task list as JSON:
{
  "tasks": [
    {
      "id": 1,
      "priority": "critical|high|medium|low",
      "title": "...",
      "description": "...",
      "metric_basis": "the specific number that drives this task",
      "estimated_impact": "what improves if done",
      "action_type": "fix|generate|review|optimize"
    }
  ]
}
Return 6-8 tasks ordered by priority.`,
    strategy: `Create a strategic plan based on these metrics as JSON:
{
  "goal": "One-sentence strategic goal",
  "phases": [
    {
      "phase": 1,
      "name": "...",
      "duration": "e.g. 1 week",
      "objectives": ["...", "..."],
      "key_metric": "what to measure to know this phase is done",
      "actions": ["...", "..."]
    }
  ],
  "success_criteria": ["...", "..."],
  "risks": [ { "risk": "...", "mitigation": "..." } ]
}
Return 3 phases.`,
  } as const;

  const systemPrompt = `You are an AI analyst for HamidEduApp, a Moroccan educational platform that generates AI lessons for grades 1-12 (Primaire, College, Lycee).
You interpret database metrics and give sharp, actionable insights in clear English.
You always structure your output as valid JSON matching exactly the requested action format.
Be specific and reference actual numbers from the metrics. Be concise but complete.`;

  try {
    await requireAdminUser(req);

    const { metrics, action, provider, model, credentialMode, requestApiKey } = getBody(req) as {
      metrics: any;
      action: "insights" | "tasks" | "strategy" | "retry_failed";
      provider?: AIProviderName;
      model?: string;
      credentialMode?: AICredentialMode;
      requestApiKey?: string;
    };

    if (!metrics) {
      return res.status(400).json({ error: "metrics payload required" });
    }

    if (action === "retry_failed") {
      const supabase = getServerSupabase();
      const { error } = await supabase
        .from("lesson_gen_queue")
        .update({ status: "pending", attempts: 0, last_error: null, claimed_at: null })
        .eq("status", "failed");

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({ success: true, message: `Reset ${metrics.failedJobs} failed jobs back to pending.` });
    }

    if (!action || !(action in actionPrompts)) {
      return res.status(400).json({ error: "Unsupported analyst action." });
    }

    const userPrompt = `Here are the live metrics from the database:\n\n${JSON.stringify(metrics, null, 2)}\n\n${actionPrompts[action]}`;
    const aiResponse = await generateAIResponse({
      prompt: userPrompt,
      provider,
      model,
      credentialMode,
      requestApiKey,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    const raw = aiResponse.text || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }

    return res.json({ ok: true, result: parsed, provider: aiResponse.provider, model: aiResponse.model });
  } catch (error: any) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    const message = error?.response?.data?.detail || error?.response?.data?.message || error.message;
    console.error("[AI Analyst] provider error:", message);
    return res.status(502).json({ error: `AI provider error: ${message}` });
  }
}

async function handleCurriculumReviewList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const filters: CurriculumReviewFilters = {
      content_type: readReviewContentType(readQuery(req, "content_type")),
      grade: readQuery(req, "grade") || null,
      subject: readQuery(req, "subject") || null,
      topic: readQuery(req, "topic") || null,
      validation_status: readValidationStatus(readQuery(req, "validation_status")),
      source_confidence: readQuery(req, "source_confidence") || null,
    };

    const items = await loadCurriculumReviewItems(getServerSupabase(), filters);
    return res.status(200).json({ items });
  } catch (error) {
    return sendError(res, error, "Unable to load curriculum review items.");
  }
}

async function handleCurriculumReviewDetail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const contentType = readContentType(readQuery(req, "content_type"));
    const contentId = readQuery(req, "content_id");

    if (!contentId) {
      return res.status(400).json({ error: "content_id is required." });
    }

    const detail = await loadCurriculumReviewDetail(getServerSupabase(), contentType, contentId);
    return res.status(200).json({ detail });
  } catch (error) {
    return sendError(res, error, "Unable to load curriculum review detail.");
  }
}

async function handleCurriculumReviewAction(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const body = getBody(req);
    const contentType = readContentType(typeof body.content_type === "string" ? body.content_type : "");
    const contentId = typeof body.content_id === "string" ? body.content_id : "";
    const action = typeof body.action === "string" ? body.action : "";

    if (!contentId) {
      return res.status(400).json({ error: "content_id is required." });
    }

    if (!action) {
      return res.status(400).json({ error: "action is required." });
    }

    const detail = await applyCurriculumReviewAction(getServerSupabase(), {
      contentType,
      contentId,
      action: action as any,
      actorUserId: user.id,
      reviewNotes: typeof body.review_notes === "string" ? body.review_notes : null,
      title: typeof body.title === "string" ? body.title : null,
      content: typeof body.content === "string" ? body.content : null,
      answer: typeof body.answer === "string" ? body.answer : null,
      sourceRefId: typeof body.source_ref_id === "string" ? body.source_ref_id : null,
      sourceName: typeof body.source_name === "string" ? body.source_name : null,
      sourceUrl: typeof body.source_url === "string" ? body.source_url : null,
    });

    return res.status(200).json({ detail });
  } catch (error) {
    return sendError(res, error, "Unable to apply curriculum review action.");
  }
}

async function handleTopicsRepair(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAiAdmin(req);
    const summary = await backfillTopicsFromLessons(getServerSupabase());
    return res.status(200).json({ summary });
  } catch (error) {
    return sendError(res, error, "Unable to repair topics from lessons.");
  }
}

async function handleRagHealth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const health = await loadRagChunkHealth(getServerSupabase());
    return res.status(200).json({ health });
  } catch (error) {
    return sendError(res, error, "Unable to load RAG chunk health.");
  }
}

async function handleRagTopicRepair(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAiAdmin(req);
    const result = await repairRagTopicLinks(getServerSupabase());
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, "Unable to repair RAG topic links.");
  }
}

async function handleSeedStarterLessons(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const body = getBody(req);
    const topicIds = Array.isArray(body.topic_ids)
      ? body.topic_ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (topicIds.length === 0) {
      return res.status(400).json({ error: "topic_ids is required." });
    }

    if (topicIds.length > MAX_STARTER_TOPIC_IDS_PER_REQUEST) {
      return res.status(413).json({
        error: `Too many topic_ids. Send at most ${MAX_STARTER_TOPIC_IDS_PER_REQUEST} per request.`,
      });
    }

    const summary = await seedStarterLessonsFromTopics(getServerSupabase(), {
      topicIds,
      commit: true,
    });

    return res.status(200).json({ summary });
  } catch (error) {
    return sendError(res, error, "Unable to generate starter lessons.");
  }
}

async function handleAiRecovery(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getServerSupabase();

  try {
    await requireAdminUser(req);

    if (segments.length === 3 && segments[2] === "failed-jobs") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const jobs = await loadAiRecoveryFailedJobs(supabase);
      return res.status(200).json({ jobs });
    }

    if (segments.length === 3 && segments[2] === "logs") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const logs = await loadAiRecoveryLogs(supabase, {
        event_type: readQuery(req, "event_type") || null,
        job_id: readQuery(req, "job_id") || null,
        task_id: readQuery(req, "task_id") || null,
        lesson_id: readQuery(req, "lesson_id") || null,
        date: readQuery(req, "date") || null,
      });
      return res.status(200).json({ logs });
    }

    if (segments.length === 3 && segments[2] === "recovered-lessons") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const lessons = await loadAiRecoveryRecoveredLessons(supabase, readRecoveryStatus(readQuery(req, "status")));
      return res.status(200).json({ lessons });
    }

    if (segments.length === 5 && segments[2] === "recovered-lessons") {
      const lessonId = segments[3];
      const action = segments[4];

      if (!lessonId) {
        return res.status(400).json({ error: "lessonId is required" });
      }

      if (action === "detail") {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
        const detail = await loadAiRecoveryRecoveredLessonDetail(supabase, lessonId);
        return res.status(200).json({ detail });
      }

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      if (action === "save") {
        const body = getBody(req);
        const detail = await saveRecoveredLessonReviewEdits(supabase, lessonId, {
          lesson_title: typeof body.lesson_title === "string" ? body.lesson_title : "",
          subtitle: typeof body.subtitle === "string" ? body.subtitle : "",
          blocks: Array.isArray(body.blocks) ? body.blocks : [],
        });
        return res.status(200).json({ detail });
      }

      const { user } = await requireAdminUser(req);
      if (action === "approve") {
        const lesson = await updateRecoveredLessonReviewStatus(supabase, lessonId, "approved", user.id);
        return res.status(200).json({ lesson });
      }
      if (action === "reject") {
        const lesson = await updateRecoveredLessonReviewStatus(supabase, lessonId, "rejected", user.id);
        return res.status(200).json({ lesson });
      }
      if (action === "send-back") {
        const result = await sendRecoveredLessonToAi(supabase, lessonId, user.id);
        return res.status(200).json(result);
      }
    }

    if (segments.length === 5 && segments[2] === "jobs") {
      const jobId = segments[3];
      const action = segments[4];

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      if (action === "diagnostics") {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
        const diagnostics = await loadAiRecoveryJobDiagnostics(supabase, jobId);
        return res.status(200).json({ diagnostics });
      }

      if (action === "create-task") {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const { user } = await requireAdminUser(req);
        const result = await createAiRecoveryTaskForJob(supabase, jobId, user.id);
        return res.status(200).json(result);
      }
    }

    if (segments.length === 5 && segments[2] === "tasks") {
      const taskId = segments[3];
      const action = segments[4];

      if (!taskId) {
        return res.status(400).json({ error: "taskId is required" });
      }

      if (action === "detail") {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
        const detail = await loadAiRecoveryTaskDetail(supabase, taskId);
        return res.status(200).json({ detail });
      }

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      if (action === "generate-sql") {
        const { user } = await requireAdminUser(req);
        const result = await generateAiRecoveryRepairSql(supabase, taskId, user.id);
        return res.status(200).json(result);
      }
      if (action === "safety-check") {
        const { user } = await requireAdminUser(req);
        const result = await runAiRecoverySafetyCheck(supabase, taskId, user.id);
        return res.status(200).json(result);
      }
      if (action === "approve-execute") {
        const { user } = await requireAdminUser(req);
        const result = await approveAiRecoveryTaskExecution(supabase, taskId, user.id);
        return res.status(200).json(result);
      }
      if (action === "execute") {
        const { user } = await requireAdminUser(req);
        const result = await executeAiRecoveryTaskSql(supabase, taskId, user.id);
        return res.status(200).json(result);
      }
      if (action === "reject-sql") {
        const { user } = await requireAdminUser(req);
        const reason = typeof getBody(req).reason === "string" ? getBody(req).reason : undefined;
        const result = await rejectAiRecoveryTaskSql(supabase, taskId, user.id, reason);
        return res.status(200).json(result);
      }
      if (action === "copy-sql") {
        const result = await copyAiRecoverySqlPreview(supabase, taskId);
        return res.status(200).json(result);
      }
      if (action === "reset") {
        const { user } = await requireAdminUser(req);
        const result = await resetAiRecoveryTask(supabase, taskId, user.id);
        return res.status(200).json(result);
      }
    }

    return res.status(404).json({ error: "API route not found." });
  } catch (error) {
    return sendError(res, error, "Unable to process AI recovery request.");
  }
}

const rootRoutes: Record<string, RouteHandler> = {
  "nvidia-proxy": handleNvidiaProxy,
  "ai": handleAiRoot,
  "ai-plan-task": handleAiPlanTask,
  "ai-execute-task": handleAiExecuteTask,
  "ai-approve-task": handleAiApproveTask,
  "ai-reject-task": handleAiRejectTask,
  "ai-request-approval": handleAiRequestApproval,
  "ai-run-audit": handleAiRunAudit,
  "ai-run-monitoring": handleAiRunMonitoring,
  "ai-validate-task": handleAiValidateTask,
  "ai-rag-check": handleAiRagCheck,
  "ai-analyst": handleAiAnalyst,
  "ai/generate": handleAIGenerate,
  "ai/explain": handleAIExplain,
  "ai/lesson-blocks": handleAILessonBlocks,
  "ai/embed": handleAIEmbed,
  "ai/status": handleAIStatus,
  "config/supabase": handleSupabasePublicConfig,
  "health/supabase": handleSupabaseHealth,
  "admin/curriculum-review": handleCurriculumReviewList,
  "admin/curriculum-review-detail": handleCurriculumReviewDetail,
  "admin/curriculum-review-action": handleCurriculumReviewAction,
  "admin/topics/repair": handleTopicsRepair,
  "admin/rag/health": handleRagHealth,
  "admin/rag/repair-topic-links": handleRagTopicRepair,
  "admin/lessons/seed-starter": handleSeedStarterLessons,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const segments = getSegments(req);
  const key = routeKey(segments);

  if (segments[0] === "admin" && segments[1] === "ai-recovery") {
    return handleAiRecovery(req, res, segments);
  }

  if (segments[0] === "user" && segments[1] === "ai-keys") {
    if (segments.length === 2) return handleUserAiKeys(req, res);
    if (segments.length === 3 && segments[2] === "test") return handleTestUserAiKey(req, res);
    if (segments.length === 3) return handleDeleteUserAiKey(req, res, segments[2]);
  }

  if (segments[0] === "settings" && segments[1] === "ai-keys") {
    if (segments.length === 2) return handleUserAiKeys(req, res);
    if (segments.length === 3 && segments[2] === "test") return handleTestUserAiKey(req, res);
    if (segments.length === 3) return handleDeleteUserAiKey(req, res, segments[2]);
  }

  const routeHandler = rootRoutes[key];
  if (!routeHandler) {
    return res.status(404).json({ error: "API route not found." });
  }

  return routeHandler(req, res, segments);
}
