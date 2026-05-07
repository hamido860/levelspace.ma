import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  loadAiRecoveryRecoveredLessonDetail,
  requireAdminUser,
} from "../../../../_lib/aiCommandCenter";

function readLessonId(req: VercelRequest) {
  const value = req.query.lessonId;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const lessonId = readLessonId(req);

    if (!lessonId) {
      return res.status(400).json({ error: "lessonId is required" });
    }

    const supabase = getServerSupabase();
    const detail = await loadAiRecoveryRecoveredLessonDetail(supabase, lessonId);
    return res.status(200).json({ detail });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load recovered lesson detail.",
    });
  }
}
