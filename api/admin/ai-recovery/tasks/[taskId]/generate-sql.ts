import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  generateAiRecoveryRepairSql,
  getServerSupabase,
  requireAdminUser,
} from "../../../../_lib/aiCommandCenter";

function readTaskId(req: VercelRequest) {
  const value = req.query.taskId;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const taskId = readTaskId(req);

    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const supabase = getServerSupabase();
    const result = await generateAiRecoveryRepairSql(supabase, taskId);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to generate AI recovery SQL preview.",
    });
  }
}
