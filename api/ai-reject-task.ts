import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  COMMAND_CENTER_AGENTS,
  createTaskLog,
  fetchLatestPendingApproval,
  fetchTaskBundle,
  getServerSupabase,
  requireAiAdmin,
  updateTaskStatus,
} from "./_lib/aiCommandCenter";

type RejectTaskBody = {
  task_id?: string;
  reason?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAiAdmin(req);
    const { task_id, reason } = req.body as RejectTaskBody;
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
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to reject task." });
  }
}
