import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  requireAdminUser,
  saveRecoveredLessonReviewEdits,
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
    await requireAdminUser(req);
    const lessonId = readLessonId(req);

    if (!lessonId) {
      return res.status(400).json({ error: "lessonId is required" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const detail = await saveRecoveredLessonReviewEdits(getServerSupabase(), lessonId, {
      lesson_title: typeof body.lesson_title === "string" ? body.lesson_title : "",
      subtitle: typeof body.subtitle === "string" ? body.subtitle : "",
      blocks: Array.isArray(body.blocks) ? body.blocks : [],
    });

    return res.status(200).json({ detail });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to save recovered lesson edits.",
    });
  }
}
