import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  COMMAND_CENTER_AGENTS,
  createTaskLog,
  fetchTaskBundle,
  getServerSupabase,
  requireAiAdmin,
  updateTaskStatus,
} from "./_lib/aiCommandCenter";

type ApprovalRequestBody = {
  task_id?: string;
  proposed_action?: string;
  risk_level?: string;
  sql_preview?: string | null;
  affected_records?: number | null;
  rollback_plan?: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAiAdmin(req);
    const { task_id, proposed_action, risk_level, sql_preview, affected_records, rollback_plan } =
      req.body as ApprovalRequestBody;

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
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to request approval." });
  }
}
