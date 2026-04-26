import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createTaskLog,
  fetchTaskBundle,
  getServerSupabase,
  runAuditForTask,
  updateTaskStatus,
} from "./_lib/aiCommandCenter";

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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to run audit." });
  }
}
