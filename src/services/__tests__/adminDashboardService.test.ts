import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("loadAdminRagMetrics uses exact count queries instead of page-limited chunk rows", () => {
  const source = readFileSync(resolve(__dirname, "../adminDashboardService.ts"), "utf8");
  const functionBody = source.slice(
    source.indexOf("export const loadAdminRagMetrics"),
    source.indexOf("export const loadAiRecoveryReviewStatusCounts"),
  );

  assert.match(functionBody, /select\("\*", \{ count: "exact", head: true \}\)/);
  assert.doesNotMatch(functionBody, /select\("embedding_status, grade_id"\)/);
  assert.doesNotMatch(functionBody, /chunks\.length/);
  assert.doesNotMatch(functionBody, /gradeChunks/);
});
