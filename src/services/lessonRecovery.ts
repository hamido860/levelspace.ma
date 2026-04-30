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
const hasOwn = (object: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key);

export const getTeachingContract = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  parseObject(lesson?.teaching_contract);

export const lessonNeedsReview = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  getTeachingContract(lesson)?.status === "needs_review";

export const lessonAllowsStudentPublish = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  isTrue(getTeachingContract(lesson)?.student_publish_allowed);

export const isStudentVisibleLesson = (lesson: { teaching_contract?: unknown } | null | undefined) =>
  (() => {
    const teachingContract = getTeachingContract(lesson);

    // Legacy lessons without a teaching contract stay visible.
    if (!teachingContract || Object.keys(teachingContract).length === 0) {
      return true;
    }

    // Recovered / gated lessons are only student-visible when explicitly allowed.
    if (hasOwn(teachingContract, "student_publish_allowed")) {
      return isTrue(teachingContract.student_publish_allowed);
    }

    // Non-empty contracts without an explicit publish flag are hidden conservatively.
    return false;
  })();

export const filterStudentVisibleLessons = <T extends { teaching_contract?: unknown }>(lessons: T[] | null | undefined) =>
  (lessons || []).filter(isStudentVisibleLesson);

export const normalizeLessonBlockUiType = (type: string | null | undefined): LessonBlockUiType =>
  BLOCK_UI_TYPE_MAP[String(type || "").trim().toLowerCase()] || "text";
