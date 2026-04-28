import type { Module } from "../db/db";

type LessonRow = {
  subject?: string | null;
  mod?: string | null;
};

const normalizeModuleId = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const buildSupabaseLessonFilters = (grade: string, country: string) => {
  const filters: Array<{ column: "grade" | "country"; value: string }> = [];
  if (grade?.trim()) filters.push({ column: "grade", value: grade.trim() });
  if (country?.trim()) filters.push({ column: "country", value: country.trim() });
  return filters;
};

export const buildModulesFromLessons = (
  lessons: LessonRow[],
  now = Date.now()
): Module[] => {
  const bySubject = new Map<string, Module>();
  for (const lesson of lessons) {
    const subject = lesson.subject?.trim();
    if (!subject) continue;
    const key = subject.toLowerCase();
    if (bySubject.has(key)) continue;
    bySubject.set(key, {
      id: normalizeModuleId(subject),
      name: subject,
      code: subject.slice(0, 3).toUpperCase(),
      description: `Core lessons for ${subject}.`,
      category: lesson.mod?.trim() || subject,
      progress: 0,
      selected: false,
      createdAt: now,
    });
  }
  return [...bySubject.values()];
};
