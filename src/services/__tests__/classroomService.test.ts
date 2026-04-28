import test from "node:test";
import assert from "node:assert/strict";
import {
  buildModulesFromLessons,
  buildSupabaseLessonFilters,
} from "../classroomService";

test("buildSupabaseLessonFilters keeps classroom loading independent from AI", () => {
  const filters = buildSupabaseLessonFilters("Grade 12", "Morocco");
  assert.deepEqual(filters, [
    { column: "grade", value: "Grade 12" },
    { column: "country", value: "Morocco" },
  ]);
});

test("buildModulesFromLessons deduplicates subjects for free users", () => {
  const modules = buildModulesFromLessons([
    { subject: "Mathematics", mod: "STEM" },
    { subject: "Mathematics", mod: "STEM" },
    { subject: "Physics", mod: "STEM" },
  ]);

  assert.equal(modules.length, 2);
  assert.equal(modules[0].name, "Mathematics");
  assert.equal(modules[1].name, "Physics");
});
