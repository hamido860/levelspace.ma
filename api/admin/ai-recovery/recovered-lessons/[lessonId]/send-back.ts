import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  requireAdminUser,
  sendRecoveredLessonToAi,
} from "../../../../_lib/aiCommandCenter";

function readLessonId(req: VercelRequest) {
  const value = req.query.lessonId;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const lessonId = readLessonId(req);

    if (!lessonId) {
      return res.status(400).json({ error: "lessonId is required" });
    }

    const result = await sendRecoveredLessonToAi(getServerSupabase(), lessonId, user.id);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to send recovered lesson back to AI.",
    });
  }
}
