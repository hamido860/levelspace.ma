import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  type AiRecoveryRecoveredLessonStatus,
  getServerSupabase,
  loadAiRecoveryRecoveredLessons,
  requireAdminUser,
} from "../../_lib/aiCommandCenter";

function readStatus(req: VercelRequest): AiRecoveryRecoveredLessonStatus {
  const raw = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const value = String(raw || "needs_review");
  return value === "approved" || value === "rejected" ? value : "needs_review";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const supabase = getServerSupabase();
    const lessons = await loadAiRecoveryRecoveredLessons(supabase, readStatus(req));
    return res.status(200).json({ lessons });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load recovered lessons.",
    });
  }
}
