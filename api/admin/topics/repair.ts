import type { VercelRequest, VercelResponse } from "@vercel/node";
import { backfillTopicsFromLessons } from "../../../lib/topicSync";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  requireAiAdmin,
} from "../../_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAiAdmin(req);
    const summary = await backfillTopicsFromLessons(getServerSupabase());
    return res.status(200).json({ summary });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to repair topics from lessons.",
    });
  }
}
