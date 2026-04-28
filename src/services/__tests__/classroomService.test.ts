import test from "node:test";
import assert from "node:assert";
import { loadClassroomModulesSupabaseFirst } from "../classroomService.ts";

test("free users can load classroom modules without AI calls", async () => {
  const supabaseClient = {
    from: (table: string) => {
      if (table === "grades") {
        return { select: () => ({ ilike: () => ({ limit: async () => ({ data: [{ id: "grade-1" }], error: null }) }) }) };
      }
      if (table === "grade_subjects") {
        return { select: () => ({ eq: async () => ({ data: [{ subject_id: "subject-1" }], error: null }) }) };
      }
      if (table === "subjects") {
        return { select: () => ({ in: async () => ({ data: [{ id: "subject-1", name: "Mathematics", code: "MATH" }], error: null }) }) };
      }
      return { select: () => ({}) };
    },
  };

  let aiCalled = false;
  const modules = await loadClassroomModulesSupabaseFirst({
    gradeName: "Grade 12",
    includeAiSuggestions: false,
    supabaseClient,
    loadAiSuggestions: async () => {
      aiCalled = true;
      return [];
    },
  });

  assert.strictEqual(aiCalled, false);
  assert.strictEqual(modules.length, 1);
  assert.strictEqual(modules[0].name, "Mathematics");
});

test("classroom loading never throws when Supabase errors and AI is off", async () => {
  const supabaseClient = {
    from: () => ({
      select: () => ({
        ilike: () => ({
          limit: async () => ({ data: null, error: new Error("supabase offline") }),
        }),
      }),
    }),
  };

  const modules = await loadClassroomModulesSupabaseFirst({
    gradeName: "Grade 12",
    includeAiSuggestions: false,
    supabaseClient,
  });

  assert.deepStrictEqual(modules, []);
});

test("AI suggestion failures are non-blocking for classroom access", async () => {
  const supabaseClient = {
    from: (table: string) => {
      if (table === "grades") {
        return { select: () => ({ ilike: () => ({ limit: async () => ({ data: [{ id: "grade-1" }], error: null }) }) }) };
      }
      if (table === "grade_subjects") {
        return { select: () => ({ eq: async () => ({ data: [{ subject_id: "subject-1" }], error: null }) }) };
      }
      if (table === "subjects") {
        return { select: () => ({ in: async () => ({ data: [{ id: "subject-1", name: "Mathematics", code: "MATH" }], error: null }) }) };
      }
      return { select: () => ({}) };
    },
  };

  const modules = await loadClassroomModulesSupabaseFirst({
    gradeName: "Grade 12",
    includeAiSuggestions: true,
    supabaseClient,
    loadAiSuggestions: async () => {
      throw new Error("quota");
    },
  });

  assert.strictEqual(modules.length, 1);
  assert.strictEqual(modules[0].name, "Mathematics");
});
