import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  createTaskLog,
  fetchTaskBundle,
  getServerSupabase,
  requireAdminUser,
  updateTaskStatus,
  validateTaskExecution,
} from "./_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const { task_id } = req.body as { task_id?: string };
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
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to validate task." });
  }
}
