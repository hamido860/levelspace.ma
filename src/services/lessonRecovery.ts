export type LessonBlockUiType = "text" | "example" | "formula" | "summary";

const BLOCK_UI_TYPE_MAP: Record<string, LessonBlockUiType> = {
  text: "text",
  intro: "text",
  theory: "text",
  definition: "text",
  content: "text",
  rules: "text",
  exercise: "text",
  quiz: "text",
  exam: "text",
  example: "example",
  examples: "example",
  formula: "formula",
  summary: "summary",
};

const parseObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const isTrue = (value: unknown) => value === true || value === "true";

export const getTeachingContract = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  parseObject(lesson?.teaching_contract);

export const lessonNeedsReview = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  getTeachingContract(lesson)?.status === "needs_review";

export const lessonAllowsStudentPublish = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  isTrue(getTeachingContract(lesson)?.student_publish_allowed);

export const isStudentVisibleLesson = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  !lessonNeedsReview(lesson) || lessonAllowsStudentPublish(lesson);

export const filterStudentVisibleLessons = <T extends { teaching_contract?: unknown }>(lessons: T[] | null | undefined) =>
  (lessons || []).filter(isStudentVisibleLesson);

export const normalizeLessonBlockUiType = (type: string | null | undefined): LessonBlockUiType =>
  BLOCK_UI_TYPE_MAP[String(type || "").trim().toLowerCase()] || "text";
