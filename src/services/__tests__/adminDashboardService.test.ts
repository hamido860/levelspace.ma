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

test("admin RAG metrics use rag_chunk_health instead of rag_embeddings usability counts", () => {
  const source = readFileSync(resolve(__dirname, "../adminDashboardService.ts"), "utf8");
  const overviewBody = source.slice(
    source.indexOf("export const loadAdminOverviewKpis"),
    source.indexOf("export const loadAdminTableHealth"),
  );
  const ragBody = source.slice(
    source.indexOf("export const loadAdminRagMetrics"),
    source.indexOf("export const loadAiRecoveryReviewStatusCounts"),
  );

  assert.match(source, /loadRagChunkHealthViaAdminApi/);
  assert.match(overviewBody, /ragHealth\.total_chunks/);
  assert.match(overviewBody, /ragHealth\.embedding_done/);
  assert.match(overviewBody, /ragHealth\.usable_chunks/);
  assert.match(ragBody, /health\.total_chunks/);
  assert.match(ragBody, /health\.embedding_done/);
  assert.match(ragBody, /health\.usable_chunks/);
  assert.doesNotMatch(overviewBody, /from\("rag_embeddings"\)/);
  assert.doesNotMatch(ragBody, /from\("rag_embeddings"\)/);
});

test("RAG repair migration defines strict usable chunks and safe topic linking", () => {
  const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/20260517183000_rag_chunk_topic_health_and_repair.sql"), "utf8");

  assert.match(migration, /add column if not exists topic_id uuid references public\.topics\(id\)/);
  assert.match(migration, /create index if not exists idx_rag_chunks_topic_id/);
  assert.match(migration, /create index if not exists idx_rag_chunks_grade_topic_status/);
  assert.match(migration, /create index if not exists idx_rag_chunks_metadata_gin/);
  assert.match(migration, /repair_rag_chunk_topic_links/);
  assert.match(migration, /join public\.lessons l on l\.id = rc\.lesson_id/);
  assert.match(migration, /public\.rag_link_is_uuid\(rc\.raw_topic_id\)/);
  assert.match(migration, /having count\(distinct topic_id\) = 1/);
  assert.match(migration, /'topic_link_status', 'unmatched'/);
  assert.match(migration, /create or replace view public\.rag_chunk_health/);
  assert.match(migration, /length\(content\) > 100/);
  assert.match(migration, /topic_id is not null/);
  assert.match(migration, /grade_id is not null/);
  assert.match(migration, /embedding_status = 'done'/);
  assert.match(migration, /embedding is not null/);
});

test("MCP context retrieves RAG chunks by topic, subject, grade, then metadata fallback", () => {
  const source = readFileSync(resolve(__dirname, "../../lib/mcp/loadMcpContext.ts"), "utf8");
  const exactTopicIndex = source.indexOf("const exactTopic");
  const sameSubjectIndex = source.indexOf("const sameSubject");
  const sameGradeIndex = source.indexOf("const sameGrade");
  const metadataFallbackIndex = source.indexOf("const metadataFallback");

  assert.ok(exactTopicIndex > -1, "missing exact topic retrieval");
  assert.ok(sameSubjectIndex > exactTopicIndex, "same subject fallback must run after exact topic retrieval");
  assert.ok(sameGradeIndex > sameSubjectIndex, "same grade fallback must run after same subject retrieval");
  assert.ok(metadataFallbackIndex > sameGradeIndex, "metadata fallback must run last");
  assert.match(source, /\.eq\("topic_id", topicId\)/);
  assert.match(source, /topics:topic_id!inner/);
  assert.match(source, /\.eq\("topics\.grade_id", gradeId\)/);
  assert.match(source, /\.eq\("topics\.subject_id", subjectId\)/);
  assert.match(source, /\.eq\("grade_id", gradeId\)/);
  assert.match(source, /\.is\("topic_id", null\)/);
  assert.match(source, /\.eq\("embedding_status", "done"\)/);
  assert.match(source, /\.not\("embedding", "is", null\)/);
});
