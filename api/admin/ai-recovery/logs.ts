import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  loadAiRecoveryLogs,
  requireAdminUser,
} from "../../_lib/aiCommandCenter";

function readQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return typeof value === "string" && value.trim() ? value : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const logs = await loadAiRecoveryLogs(getServerSupabase(), {
      event_type: readQueryParam(req.query.event_type),
      job_id: readQueryParam(req.query.job_id),
      task_id: readQueryParam(req.query.task_id),
      lesson_id: readQueryParam(req.query.lesson_id),
      date: readQueryParam(req.query.date),
    });

    return res.status(200).json({ logs });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load AI recovery logs.",
    });
  }
}
