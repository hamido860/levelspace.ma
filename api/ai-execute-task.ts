import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  COMMAND_CENTER_AGENTS,
  buildExecutionPlan,
  createExecutionSnapshot,
  createTaskLog,
  fetchTaskBundle,
  getServerSupabase,
  isWriteMode,
  MAX_AUTOMATIC_RETRIES,
  updateTaskStatus,
} from "./_lib/aiCommandCenter";

type QueueJob = {
  id: string;
  status: string;
  attempts: number | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { task_id } = req.body as { task_id?: string };
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

      const retryableRows = (queueRows || []).filter((row: QueueJob) => Number(row.attempts || 0) < MAX_AUTOMATIC_RETRIES);
      const permanentRows = (queueRows || []).filter((row: QueueJob) => Number(row.attempts || 0) >= MAX_AUTOMATIC_RETRIES);

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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to execute task." });
  }
}
