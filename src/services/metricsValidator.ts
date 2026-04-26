/**
 * Validates metrics snapshot before sending to AI Analyst.
 * Catches hallucinated/incorrect data that could lead to bad AI decisions.
 */

export interface MetricsSnapshot {
  totalTopics: number;
  lessonsGenerated: number;
  lessonCoverage: string;
  queuePending: number;
  failedJobs: number;
  ragChunksTotal: number;
  ragChunksEmbedded: number;
  ragCoverage: string;
  totalUsers: number;
  gradeBreakdown: Array<{
    grade: string;
    cycle: string;
    topics: number;
    lessons: number;
    coverage: string;
    queueFailed: number;
    queuePending: number;
  }>;
  tableHealth: Array<{ table: string; rows: number | null; status: string }>;
}

export interface ValidationError {
  field: string;
  error: string;
  value: any;
  expected: string;
}

/**
 * Validate metrics snapshot against known constraints.
 * Returns array of errors, or empty array if valid.
 */
export const validateMetrics = (metrics: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!metrics || typeof metrics !== "object") {
    return [{ field: "root", error: "Metrics must be an object", value: metrics, expected: "object" }];
  }

  const topicsTableHealth = Array.isArray(metrics.tableHealth)
    ? metrics.tableHealth.find((t: any) => t?.table === "topics")
    : null;
  const topicsVisibilityUncertain =
    typeof topicsTableHealth?.status === "string" &&
    (topicsTableHealth.status.startsWith("unknown") ||
      topicsTableHealth.status.startsWith("inconsistent"));

  // Basic type checks
  if (typeof metrics.totalTopics !== "number" || metrics.totalTopics < 0) {
    errors.push({
      field: "totalTopics",
      error: "Must be a non-negative number",
      value: metrics.totalTopics,
      expected: "number >= 0",
    });
  }

  if (typeof metrics.lessonsGenerated !== "number" || metrics.lessonsGenerated < 0) {
    errors.push({
      field: "lessonsGenerated",
      error: "Must be a non-negative number",
      value: metrics.lessonsGenerated,
      expected: "number >= 0",
    });
  }

  // Lessons can't exceed topics
  if (metrics.lessonsGenerated > metrics.totalTopics && !topicsVisibilityUncertain) {
    errors.push({
      field: "lessonsGenerated",
      error: `Cannot exceed totalTopics (${metrics.totalTopics})`,
      value: metrics.lessonsGenerated,
      expected: `<= ${metrics.totalTopics}`,
    });
  }

  if (typeof metrics.queuePending !== "number" || metrics.queuePending < 0) {
    errors.push({
      field: "queuePending",
      error: "Must be a non-negative number",
      value: metrics.queuePending,
      expected: "number >= 0",
    });
  }

  if (typeof metrics.failedJobs !== "number" || metrics.failedJobs < 0) {
    errors.push({
      field: "failedJobs",
      error: "Must be a non-negative number",
      value: metrics.failedJobs,
      expected: "number >= 0",
    });
  }

  if (typeof metrics.ragChunksTotal !== "number" || metrics.ragChunksTotal < 0) {
    errors.push({
      field: "ragChunksTotal",
      error: "Must be a non-negative number",
      value: metrics.ragChunksTotal,
      expected: "number >= 0",
    });
  }

  if (typeof metrics.ragChunksEmbedded !== "number" || metrics.ragChunksEmbedded < 0) {
    errors.push({
      field: "ragChunksEmbedded",
      error: "Must be a non-negative number",
      value: metrics.ragChunksEmbedded,
      expected: "number >= 0",
    });
  }

  // Embedded can't exceed total
  if (metrics.ragChunksEmbedded > metrics.ragChunksTotal) {
    errors.push({
      field: "ragChunksEmbedded",
      error: `Cannot exceed ragChunksTotal (${metrics.ragChunksTotal})`,
      value: metrics.ragChunksEmbedded,
      expected: `<= ${metrics.ragChunksTotal}`,
    });
  }

  if (typeof metrics.totalUsers !== "number" || metrics.totalUsers < 0) {
    errors.push({
      field: "totalUsers",
      error: "Must be a non-negative number",
      value: metrics.totalUsers,
      expected: "number >= 0",
    });
  }

  // Validate grade breakdown
  if (!Array.isArray(metrics.gradeBreakdown)) {
    errors.push({
      field: "gradeBreakdown",
      error: "Must be an array",
      value: metrics.gradeBreakdown,
      expected: "Array",
    });
  } else {
    metrics.gradeBreakdown.forEach((g: any, i: number) => {
      const prefix = `gradeBreakdown[${i}]`;

      if (!g.grade || typeof g.grade !== "string") {
        errors.push({
          field: `${prefix}.grade`,
          error: "Must be a non-empty string",
          value: g.grade,
          expected: "string",
        });
      }

      if (typeof g.topics !== "number" || g.topics < 0) {
        errors.push({
          field: `${prefix}.topics`,
          error: "Must be a non-negative number",
          value: g.topics,
          expected: "number >= 0",
        });
      }

      if (typeof g.lessons !== "number" || g.lessons < 0) {
        errors.push({
          field: `${prefix}.lessons`,
          error: "Must be a non-negative number",
          value: g.lessons,
          expected: "number >= 0",
        });
      }

      // Lessons can't exceed topics per grade
      if (g.lessons > g.topics) {
        errors.push({
          field: `${prefix}.lessons`,
          error: `Cannot exceed grade topics (${g.topics})`,
          value: g.lessons,
          expected: `<= ${g.topics}`,
        });
      }

      if (typeof g.queueFailed !== "number" || g.queueFailed < 0) {
        errors.push({
          field: `${prefix}.queueFailed`,
          error: "Must be a non-negative number",
          value: g.queueFailed,
          expected: "number >= 0",
        });
      }

      if (typeof g.queuePending !== "number" || g.queuePending < 0) {
        errors.push({
          field: `${prefix}.queuePending`,
          error: "Must be a non-negative number",
          value: g.queuePending,
          expected: "number >= 0",
        });
      }
    });
  }

  // Validate table health
  if (!Array.isArray(metrics.tableHealth)) {
    errors.push({
      field: "tableHealth",
      error: "Must be an array",
      value: metrics.tableHealth,
      expected: "Array",
    });
  } else {
    metrics.tableHealth.forEach((t: any, i: number) => {
      const prefix = `tableHealth[${i}]`;

      if (!t.table || typeof t.table !== "string") {
        errors.push({
          field: `${prefix}.table`,
          error: "Must be a non-empty string",
          value: t.table,
          expected: "string",
        });
      }

      // rows can be null (RLS denied) or non-negative number
      if (t.rows !== null && (typeof t.rows !== "number" || t.rows < 0)) {
        errors.push({
          field: `${prefix}.rows`,
          error: "Must be null (RLS denied) or non-negative number",
          value: t.rows,
          expected: "number >= 0 | null",
        });
      }

      if (!t.status || typeof t.status !== "string") {
        errors.push({
          field: `${prefix}.status`,
          error: "Must be a non-empty string",
          value: t.status,
          expected: "string",
        });
      }
    });
  }

  return errors;
};

/**
 * Format validation errors for display.
 */
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return "OK: Metrics valid";
  return errors
    .map(e => `ERROR ${e.field}: ${e.error}\n   Got: ${JSON.stringify(e.value)}\n   Expected: ${e.expected}`)
    .join("\n\n");
};
