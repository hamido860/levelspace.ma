import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackBlocksFromOutlines,
  normalizeLessonBlocks,
} from "./lessonBlocks.ts";

test("normalizes unsupported AI block types and skips empty content", () => {
  const blocks = normalizeLessonBlocks([
    { type: "intro", content: "Welcome to the topic." },
    { type: "definition", title: "Key idea", content: "A force changes motion." },
    { type: "objective", points: ["Recognize force effects", "Use vocabulary precisely"] },
    { type: "exercise", content: "Solve a simple application." },
    { type: "diagram", content: "" },
    { type: "formula", label: "Newton", content: "F = m a" },
  ]);

  assert.deepEqual(blocks.map((block) => block.type), [
    "text",
    "text",
    "summary",
    "example",
    "formula",
  ]);
  assert.equal(blocks.length, 5);
  assert.ok(blocks.every((block) => block.content.trim().length > 0));
});

test("builds fallback blocks from topic outlines when AI blocks are unusable", () => {
  const aiBlocks = normalizeLessonBlocks([
    { type: "objective", content: "   " },
    { type: "exercise", points: [] },
  ]);
  const fallback = aiBlocks.length > 0 ? aiBlocks : buildFallbackBlocksFromOutlines("Forces", [
    { title: "Meaning of force", description: "Contact and distance actions.", outline_order: 1 },
    { title: "Effects of a force", description: "Motion and deformation.", outline_order: 2 },
  ]);

  assert.deepEqual(fallback.map((block) => block.type), ["summary", "text", "text"]);
  assert.match(fallback[0].content, /Forces/);
  assert.match(fallback[1].content, /Meaning of force/);
});
