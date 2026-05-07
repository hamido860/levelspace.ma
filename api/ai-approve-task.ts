import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  COMMAND_CENTER_AGENTS,
  createTaskLog,
  fetchLatestPendingApproval,
  fetchTaskBundle,
  getServerSupabase,
  requireAdminUser,
  updateTaskStatus,
} from "./_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const { task_id } = req.body as { task_id?: string };
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
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to approve task." });
  }
}
