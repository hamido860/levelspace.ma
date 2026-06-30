const LESSON_VALIDATION_COLUMNS = [
  "validation_status",
  "source_confidence",
  "source_name",
  "source_url",
  "review_notes",
  "reviewed_by",
  "reviewed_at",
] as const;

const VALIDATION_STATUS_SET = new Set([
  "unverified",
  "ai_generated",
  "source_matched",
  "teacher_reviewed",
  "official_validated",
  "rejected",
]);

type LessonSelectOptions = {
  includeTags?: boolean;
  includeValidation?: boolean;
  includeContent?: boolean;
};

export const getLessonSelectColumns = ({
  includeTags = false,
  includeValidation = true,
  includeContent = true,
}: LessonSelectOptions = {}) => {
  const columns = [
    "id",
    "topic_id",
    "instruction_option_id",
    "lesson_tracks(track_id)",
    "lesson_title",
    "subtitle",
    ...(includeTags ? ["tags"] : []),
    "status",
    "grade",
    "country",
    "subject",
    ...(includeValidation ? [...LESSON_VALIDATION_COLUMNS] : []),
    "is_ai_generated",
    ...(includeContent ? ["content", "blocks", "quizzes", "exercises", "teaching_contract"] : []),
  ];

  return columns.join(", ");
};

export const isMissingLessonValidationColumnError = (error: unknown) => {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "").toLocaleLowerCase();

  if (code !== "42703" && code !== "PGRST204") return false;

  const ALL_OPTIONAL_COLUMNS = [...LESSON_VALIDATION_COLUMNS, "source_mode", "status"];
  return ALL_OPTIONAL_COLUMNS.some((column) => message.includes(column.toLocaleLowerCase()));
};

export const stripLessonValidationFields = <T extends Record<string, unknown>>(payload: T) => {
  const nextPayload = { ...payload };

  for (const column of LESSON_VALIDATION_COLUMNS) {
    delete nextPayload[column];
  }

  return nextPayload;
};

type LegacyLessonValidationShape = {
  validation_status?: unknown;
  topic_id?: string | null;
  is_ai_generated?: boolean | null;
  source_confidence?: number | null;
  source_name?: string | null;
};

export const inferLegacyLessonValidationStatus = ({
  validation_status,
  topic_id,
  is_ai_generated,
}: LegacyLessonValidationShape) => {
  const normalizedStatus = String(validation_status || "").trim();
  if (VALIDATION_STATUS_SET.has(normalizedStatus)) {
    return normalizedStatus;
  }

  if (topic_id && !is_ai_generated) {
    return "source_matched";
  }

  if (is_ai_generated) {
    return "ai_generated";
  }

  return undefined;
};

export const inferLegacyLessonSourceConfidence = (lesson: LegacyLessonValidationShape) => {
  const explicitConfidence = Number(lesson.source_confidence);
  if (Number.isFinite(explicitConfidence) && explicitConfidence > 0) {
    return explicitConfidence;
  }

  return inferLegacyLessonValidationStatus(lesson) === "source_matched" ? 0.65 : undefined;
};

export const inferLegacyLessonSourceName = (lesson: LegacyLessonValidationShape) => {
  if (lesson.source_name) {
    return lesson.source_name;
  }

  return inferLegacyLessonValidationStatus(lesson) === "source_matched"
    ? "Trusted Curriculum Topic"
    : undefined;
};
