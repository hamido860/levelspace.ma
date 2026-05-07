import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AiCommandCenterHttpError, getServerSupabase, requireAdminUser } from "../_lib/aiCommandCenter";
import {
  CURRICULUM_CONTENT_TYPES,
  type CurriculumContentType,
  loadCurriculumReviewDetail,
} from "../_lib/curriculumValidation";

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readContentType(value: string | undefined): CurriculumContentType {
  if (value && (CURRICULUM_CONTENT_TYPES as readonly string[]).includes(value)) {
    return value as CurriculumContentType;
  }
  throw new AiCommandCenterHttpError(400, "content_type is required.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const contentType = readContentType(readString(req.query.content_type));
    const contentId = readString(req.query.content_id);

    if (!contentId) {
      return res.status(400).json({ error: "content_id is required." });
    }

    const detail = await loadCurriculumReviewDetail(getServerSupabase(), contentType, contentId);
    return res.status(200).json({ detail });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load curriculum review detail.",
    });
  }
}
