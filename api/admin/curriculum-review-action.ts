import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AiCommandCenterHttpError, getServerSupabase, requireAdminUser } from "../_lib/aiCommandCenter";
import {
  CURRICULUM_CONTENT_TYPES,
  type CurriculumContentType,
  applyCurriculumReviewAction,
} from "../_lib/curriculumValidation";

function readContentType(value: unknown): CurriculumContentType {
  const text = typeof value === "string" ? value : "";
  if ((CURRICULUM_CONTENT_TYPES as readonly string[]).includes(text)) {
    return text as CurriculumContentType;
  }
  throw new AiCommandCenterHttpError(400, "content_type is required.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const contentType = readContentType((body as Record<string, unknown>).content_type);
    const contentId = typeof (body as Record<string, unknown>).content_id === "string"
      ? (body as Record<string, string>).content_id
      : "";
    const action = typeof (body as Record<string, unknown>).action === "string"
      ? (body as Record<string, string>).action
      : "";

    if (!contentId) {
      return res.status(400).json({ error: "content_id is required." });
    }

    if (!action) {
      return res.status(400).json({ error: "action is required." });
    }

    const detail = await applyCurriculumReviewAction(getServerSupabase(), {
      contentType,
      contentId,
      action: action as any,
      actorUserId: user.id,
      reviewNotes: typeof (body as Record<string, unknown>).review_notes === "string"
        ? (body as Record<string, string>).review_notes
        : null,
      title: typeof (body as Record<string, unknown>).title === "string"
        ? (body as Record<string, string>).title
        : null,
      content: typeof (body as Record<string, unknown>).content === "string"
        ? (body as Record<string, string>).content
        : null,
      answer: typeof (body as Record<string, unknown>).answer === "string"
        ? (body as Record<string, string>).answer
        : null,
      sourceRefId: typeof (body as Record<string, unknown>).source_ref_id === "string"
        ? (body as Record<string, string>).source_ref_id
        : null,
      sourceName: typeof (body as Record<string, unknown>).source_name === "string"
        ? (body as Record<string, string>).source_name
        : null,
      sourceUrl: typeof (body as Record<string, unknown>).source_url === "string"
        ? (body as Record<string, string>).source_url
        : null,
    });

    return res.status(200).json({ detail });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to apply curriculum review action.",
    });
  }
}
