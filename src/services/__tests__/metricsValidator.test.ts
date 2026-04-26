import { describe, it, expect } from "vitest";
import { validateMetrics, formatValidationErrors } from "../metricsValidator";

describe("metricsValidator", () => {
  const validMetrics = {
    totalTopics: 831,
    lessonsGenerated: 100,
    lessonCoverage: "12%",
    queuePending: 50,
    failedJobs: 5,
    ragChunksTotal: 2880,
    ragChunksEmbedded: 2800,
    ragCoverage: "97%",
    totalUsers: 3,
    gradeBreakdown: [
      {
        grade: "1ère année primaire",
        cycle: "Primaire",
        topics: 50,
        lessons: 10,
        coverage: "20%",
        queueFailed: 0,
        queuePending: 5,
      },
    ],
    tableHealth: [
      { table: "topics", rows: 831, status: "populated" },
      { table: "lessons", rows: 100, status: "partial" },
      { table: "rag_chunks", rows: 2880, status: "populated" },
    ],
  };

  it("accepts valid metrics", () => {
    const errors = validateMetrics(validMetrics);
    expect(errors).toHaveLength(0);
  });

  it("rejects non-object metrics", () => {
    const errors = validateMetrics(null);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe("root");
  });

  it("catches negative numbers", () => {
    const invalid = { ...validMetrics, totalTopics: -5 };
    const errors = validateMetrics(invalid);
    expect(errors.some(e => e.field === "totalTopics")).toBe(true);
  });

  it("catches lessons > topics (global)", () => {
    const invalid = { ...validMetrics, lessonsGenerated: 900, totalTopics: 831 };
    const errors = validateMetrics(invalid);
    expect(errors.some(e => e.field === "lessonsGenerated" && e.error.includes("Cannot exceed"))).toBe(true);
  });

  it("catches RAG embedded > total", () => {
    const invalid = { ...validMetrics, ragChunksEmbedded: 3000, ragChunksTotal: 2880 };
    const errors = validateMetrics(invalid);
    expect(errors.some(e => e.field === "ragChunksEmbedded" && e.error.includes("Cannot exceed"))).toBe(true);
  });

  it("catches per-grade lessons > topics", () => {
    const invalid = {
      ...validMetrics,
      gradeBreakdown: [
        { ...validMetrics.gradeBreakdown[0], lessons: 100, topics: 50 },
      ],
    };
    const errors = validateMetrics(invalid);
    expect(errors.some(e => e.field.includes("lessons") && e.error.includes("Cannot exceed grade topics"))).toBe(true);
  });

  it("warns when 'empty' tables should have data", () => {
    const invalid = {
      ...validMetrics,
      tableHealth: [
        { table: "topics", rows: 0, status: "empty" },
      ],
    };
    const errors = validateMetrics(invalid);
    expect(errors.some(e => e.field.includes("status") && e.error.includes("marked \"empty\""))).toBe(true);
  });

  it("allows null rows (RLS denied)", () => {
    const metrics = {
      ...validMetrics,
      tableHealth: [
        { table: "topics", rows: null, status: "unknown (no read access)" },
      ],
    };
    const errors = validateMetrics(metrics);
    expect(errors.filter(e => e.field.includes("rows") && e.error.includes("Must be"))).toHaveLength(0);
  });

  it("formats errors for display", () => {
    const invalid = { ...validMetrics, totalTopics: -5 };
    const errors = validateMetrics(invalid);
    const formatted = formatValidationErrors(errors);
    expect(formatted).toContain("❌");
    expect(formatted).toContain("totalTopics");
  });

  it("returns success message for valid metrics", () => {
    const errors = validateMetrics(validMetrics);
    const formatted = formatValidationErrors(errors);
    expect(formatted).toBe("✓ Metrics valid");
  });
});
