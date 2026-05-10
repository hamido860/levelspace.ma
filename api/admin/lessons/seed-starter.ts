import type { VercelRequest, VercelResponse } from "@vercel/node";
import { seedStarterLessonsFromTopics } from "../../../src/server/curriculum/starterLessons";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  requireAdminUser,
} from "../../../src/server/api/aiCommandCenter";

const getBody = (req: VercelRequest) =>
  req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};

const sendError = (res: VercelResponse, error: unknown) => {
  if (error instanceof AiCommandCenterHttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({
    error: error instanceof Error ? error.message : "Unable to generate starter lessons.",
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const body = getBody(req);
    const topicIds = Array.isArray(body.topic_ids)
      ? body.topic_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (topicIds.length === 0) {
      return res.status(400).json({ error: "topic_ids is required." });
    }

    const summary = await seedStarterLessonsFromTopics(getServerSupabase(), {
      topicIds,
      commit: true,
    });

    return res.status(200).json({ summary });
  } catch (error) {
    return sendError(res, error);
  }
}
