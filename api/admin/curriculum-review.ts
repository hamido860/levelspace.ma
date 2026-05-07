import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AiCommandCenterHttpError, getServerSupabase, requireAdminUser } from "../_lib/aiCommandCenter";
import {
  CURRICULUM_CONTENT_TYPES,
  CURRICULUM_VALIDATION_STATUSES,
  type CurriculumContentType,
  type CurriculumReviewFilters,
  type CurriculumValidationStatus,
  loadCurriculumReviewItems,
} from "../_lib/curriculumValidation";

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readContentType(value: string | undefined): CurriculumContentType | "all" | null {
  if (!value || value === "all") return "all";
  if ((CURRICULUM_CONTENT_TYPES as readonly string[]).includes(value)) {
    return value as CurriculumContentType;
  }
  throw new AiCommandCenterHttpError(400, "Unsupported content_type filter.");
}

function readValidationStatus(value: string | undefined): CurriculumValidationStatus | "all" | null {
  if (!value || value === "all") return "all";
  if ((CURRICULUM_VALIDATION_STATUSES as readonly string[]).includes(value)) {
    return value as CurriculumValidationStatus;
  }
  throw new AiCommandCenterHttpError(400, "Unsupported validation_status filter.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const filters: CurriculumReviewFilters = {
      content_type: readContentType(readString(req.query.content_type)),
      grade: readString(req.query.grade) || null,
      subject: readString(req.query.subject) || null,
      topic: readString(req.query.topic) || null,
      validation_status: readValidationStatus(readString(req.query.validation_status)),
      source_confidence: readString(req.query.source_confidence) || null,
    };

    const items = await loadCurriculumReviewItems(getServerSupabase(), filters);
    return res.status(200).json({ items });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load curriculum review items.",
    });
  }
}
