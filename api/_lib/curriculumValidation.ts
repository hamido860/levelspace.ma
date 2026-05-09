import type { SupabaseClient } from "@supabase/supabase-js";
import { AiCommandCenterHttpError, nowIso } from "./aiCommandCenter";

export const CURRICULUM_VALIDATION_STATUSES = [
  "unverified",
  "ai_generated",
  "source_matched",
  "teacher_reviewed",
  "official_validated",
  "rejected",
] as const;

export const CURRICULUM_CONTENT_TYPES = [
  "lesson",
  "topic",
  "rag_chunk",
  "rag_question",
] as const;

export type CurriculumValidationStatus = (typeof CURRICULUM_VALIDATION_STATUSES)[number];
export type CurriculumContentType = (typeof CURRICULUM_CONTENT_TYPES)[number];

export interface CurriculumReviewFilters {
  content_type?: CurriculumContentType | "all" | null;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  validation_status?: CurriculumValidationStatus | "all" | null;
  source_confidence?: string | number | null;
}

export interface CurriculumReviewItem {
  id: string;
  content_type: CurriculumContentType;
  title: string;
  preview: string;
  grade: string | null;
  subject: string | null;
  topic: string | null;
  country: string | null;
  track: string | null;
  validation_status: CurriculumValidationStatus;
  source_confidence: number;
  source_name: string | null;
  source_url: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface CurriculumReviewAudit {
  id: string;
  content_id: string;
  content_type: CurriculumContentType;
  validation_result: string;
  mismatches: Record<string, unknown>;
  recommendation: string | null;
  created_at: string | null;
}

export interface CurriculumSourceRefRecord {
  id: string;
  country: string | null;
  cycle: string | null;
  grade: string | null;
  track: string | null;
  subject: string | null;
  topic_title: string | null;
  source_name: string | null;
  source_url: string | null;
  source_type: string | null;
  confidence_weight: number;
  created_at: string | null;
}

export interface CurriculumReviewDetail {
  item: CurriculumReviewItem;
  raw: Record<string, any>;
  linked_source_ref: CurriculumSourceRefRecord | null;
  latest_audit: CurriculumReviewAudit | null;
  preview_blocks: Array<Record<string, any>>;
}

type ReviewAction =
  | "teacher_reviewed"
  | "official_validated"
  | "reject"
  | "request_regeneration"
  | "save_manual_edits";

type ReviewRow = Record<string, any>;
type ReviewContext = {
  id: string;
  contentType: CurriculumContentType;
  country: string | null;
  grade: string | null;
  subject: string | null;
  track: string | null;
  topicTitle: string | null;
  title: string;
  preview: string;
  validationStatus: CurriculumValidationStatus;
  sourceConfidence: number;
  sourceName: string | null;
  sourceUrl: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
};

const TABLE_BY_CONTENT_TYPE: Record<CurriculumContentType, string> = {
  lesson: "lessons",
  topic: "topics",
  rag_chunk: "rag_chunks",
  rag_question: "rag_questions",
};

const LESSON_SELECT =
  "id, lesson_title, title, content, blocks, grade, subject, country, topic_id, validation_status, source_confidence, source_name, source_url, review_notes, reviewed_by, reviewed_at, created_at";
const TOPIC_SELECT =
  "id, title, grade_id, subject_id, validation_status, source_confidence, source_name, source_url, review_notes, reviewed_by, reviewed_at, created_at";
const RAG_CHUNK_SELECT =
  "id, content, metadata, lesson_id, grade_id, source_type, source_url, source_name, validation_status, source_confidence, review_notes, reviewed_by, reviewed_at, created_at";
const RAG_QUESTION_SELECT =
  "id, question, answer, metadata, rag_chunk_id, lesson_id, topic_id, validation_status, source_confidence, source_name, source_url, review_notes, reviewed_by, reviewed_at, created_at";

function asString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function asStatus(value: unknown, fallback: CurriculumValidationStatus = "unverified"): CurriculumValidationStatus {
  const text = String(value || "").trim();
  return (CURRICULUM_VALIDATION_STATUSES as readonly string[]).includes(text) ? (text as CurriculumValidationStatus) : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactText(value: unknown, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max).trim()}...`;
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function parseBlocks(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === "object")
    : [];
}

function getTableName(contentType: CurriculumContentType) {
  return TABLE_BY_CONTENT_TYPE[contentType];
}

function getPreviewFromBlocks(blocks: Array<Record<string, any>>) {
  for (const block of blocks) {
    const preview = compactText(block.content || block.question || block.title || "");
    if (preview) return preview;
  }

  return "";
}

async function fetchTopicsByIds(supabase: SupabaseClient, topicIds: string[]) {
  if (topicIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, grade_id, subject_id")
    .in("id", topicIds);

  if (error) throw error;
  return new Map(((data || []) as any[]).map((row) => [String(row.id), row]));
}

async function fetchNamesByIds(supabase: SupabaseClient, table: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, string | null>();
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .in("id", ids);

  if (error) throw error;
  return new Map(((data || []) as any[]).map((row) => [String(row.id), asString(row.name)]));
}

async function fetchLessonsByIds(supabase: SupabaseClient, lessonIds: string[]) {
  if (lessonIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from("lessons")
    .select("id, lesson_title, title, grade, subject, country, topic_id, source_name, source_url, validation_status, source_confidence")
    .in("id", lessonIds);

  if (error) throw error;
  return new Map(((data || []) as any[]).map((row) => [String(row.id), row]));
}

async function fetchRagChunksByIds(supabase: SupabaseClient, chunkIds: string[]) {
  if (chunkIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from("rag_chunks")
    .select(RAG_CHUNK_SELECT)
    .in("id", chunkIds);

  if (error) throw error;
  return new Map(((data || []) as any[]).map((row) => [String(row.id), row]));
}

async function loadSourceRefs(supabase: SupabaseClient, country = "Morocco") {
  const { data, error } = await supabase
    .from("curriculum_source_refs")
    .select("*")
    .eq("country", country)
    .order("confidence_weight", { ascending: false })
    .limit(300);

  if (error) throw error;

  return ((data || []) as any[]).map((row) => ({
    ...row,
    confidence_weight: asNumber(row.confidence_weight, 0.5),
  })) as CurriculumSourceRefRecord[];
}

function calculateSourceMatchScore(
  context: ReviewContext,
  sourceRef: CurriculumSourceRefRecord,
) {
  const contextTopic = normalizeText(context.topicTitle || context.title);
  const sourceTopic = normalizeText(sourceRef.topic_title);
  if (!contextTopic || !sourceTopic) {
    return null;
  }

  let score = asNumber(sourceRef.confidence_weight, 0.5);
  let titleMatched = false;

  if (contextTopic === sourceTopic) {
    score += 0.35;
    titleMatched = true;
  } else if (contextTopic.includes(sourceTopic) || sourceTopic.includes(contextTopic)) {
    score += 0.22;
    titleMatched = true;
  } else {
    const topicWords = new Set(contextTopic.split(" ").filter(Boolean));
    const sourceWords = sourceTopic.split(" ").filter(Boolean);
    const overlap = sourceWords.filter((word) => topicWords.has(word)).length;
    if (sourceWords.length > 0 && overlap / sourceWords.length >= 0.6) {
      score += 0.18;
      titleMatched = true;
    }
  }

  if (!titleMatched) {
    return null;
  }

  if (context.grade && sourceRef.grade && normalizeText(context.grade) === normalizeText(sourceRef.grade)) {
    score += 0.12;
  }

  if (context.subject && sourceRef.subject && normalizeText(context.subject) === normalizeText(sourceRef.subject)) {
    score += 0.12;
  }

  if (context.track && sourceRef.track && normalizeText(context.track) === normalizeText(sourceRef.track)) {
    score += 0.08;
  }

  if (context.country && sourceRef.country && normalizeText(context.country) === normalizeText(sourceRef.country)) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

function findBestSourceMatch(context: ReviewContext, sourceRefs: CurriculumSourceRefRecord[]) {
  let best: { sourceRef: CurriculumSourceRefRecord; score: number } | null = null;

  for (const sourceRef of sourceRefs) {
    const score = calculateSourceMatchScore(context, sourceRef);
    if (score === null || score < 0.6) continue;

    if (!best || score > best.score) {
      best = { sourceRef, score };
    }
  }

  return best;
}

async function createValidationAudit(
  supabase: SupabaseClient,
  payload: {
    contentId: string;
    contentType: CurriculumContentType;
    validationResult: string;
    mismatches?: Record<string, unknown>;
    recommendation?: string | null;
  },
) {
  const { error } = await supabase
    .from("curriculum_validation_audits")
    .insert({
      content_id: payload.contentId,
      content_type: payload.contentType,
      validation_result: payload.validationResult,
      mismatches: payload.mismatches || {},
      recommendation: payload.recommendation || null,
      created_at: nowIso(),
    });

  if (error) throw error;
}

async function applySourceMatchIfNeeded(
  supabase: SupabaseClient,
  context: ReviewContext,
  raw: ReviewRow,
  sourceRefs: CurriculumSourceRefRecord[],
) {
  if (!["unverified", "ai_generated"].includes(context.validationStatus)) {
    return {
      raw,
      linkedSourceRef: null as CurriculumSourceRefRecord | null,
      sourceConfidence: context.sourceConfidence,
      sourceName: context.sourceName,
      sourceUrl: context.sourceUrl,
      validationStatus: context.validationStatus,
    };
  }

  const best = findBestSourceMatch(context, sourceRefs);
  if (!best) {
    return {
      raw,
      linkedSourceRef: null as CurriculumSourceRefRecord | null,
      sourceConfidence: context.sourceConfidence,
      sourceName: context.sourceName,
      sourceUrl: context.sourceUrl,
      validationStatus: context.validationStatus,
    };
  }

  const patch: Record<string, unknown> = {
    validation_status: "source_matched",
    source_confidence: best.score,
    source_name: best.sourceRef.source_name,
    source_url: best.sourceRef.source_url,
  };

  const { error } = await (supabase as any)
    .from(getTableName(context.contentType))
    .update(patch)
    .eq("id", context.id);

  if (error) throw error;

  await createValidationAudit(supabase, {
    contentId: context.id,
    contentType: context.contentType,
    validationResult: "source_matched",
    mismatches: {
      matched_topic_title: best.sourceRef.topic_title,
      matched_subject: best.sourceRef.subject,
      matched_grade: best.sourceRef.grade,
      score: best.score,
    },
    recommendation: "Matched to the closest curriculum_source_refs row.",
  });

  return {
    raw: { ...raw, ...patch },
    linkedSourceRef: best.sourceRef,
    sourceConfidence: best.score,
    sourceName: asString(best.sourceRef.source_name),
    sourceUrl: asString(best.sourceRef.source_url),
    validationStatus: "source_matched" as CurriculumValidationStatus,
  };
}

async function buildLessonContexts(supabase: SupabaseClient, lessonRows: ReviewRow[]) {
  const topicIds = Array.from(new Set(lessonRows.map((row) => asString(row.topic_id)).filter(Boolean))) as string[];
  const topicsById = await fetchTopicsByIds(supabase, topicIds);

  return lessonRows.map((row) => {
    const topic = asString(row.topic_id) ? topicsById.get(String(row.topic_id)) : null;
    const blocks = parseBlocks(row.blocks);
    const title = asString(row.lesson_title) || asString(row.title) || "Untitled lesson";
    const preview = compactText(row.content) || getPreviewFromBlocks(blocks) || title;

    return {
      id: String(row.id),
      contentType: "lesson" as const,
      country: asString(row.country),
      grade: asString(row.grade),
      subject: asString(row.subject),
      track: null,
      topicTitle: asString(topic?.title),
      title,
      preview,
      validationStatus: asStatus(row.validation_status, "unverified"),
      sourceConfidence: asNumber(row.source_confidence, 0),
      sourceName: asString(row.source_name),
      sourceUrl: asString(row.source_url),
      reviewNotes: asString(row.review_notes),
      reviewedBy: asString(row.reviewed_by),
      reviewedAt: asString(row.reviewed_at),
      createdAt: asString(row.created_at),
      raw: row,
    };
  });
}

async function buildTopicContexts(supabase: SupabaseClient, topicRows: ReviewRow[]) {
  const gradeIds = Array.from(new Set(topicRows.map((row) => asString(row.grade_id)).filter(Boolean))) as string[];
  const subjectIds = Array.from(new Set(topicRows.map((row) => asString(row.subject_id)).filter(Boolean))) as string[];
  const [gradesById, subjectsById] = await Promise.all([
    fetchNamesByIds(supabase, "grades", gradeIds),
    fetchNamesByIds(supabase, "subjects", subjectIds),
  ]);

  return topicRows.map((row) => {
    const title = asString(row.title) || "Untitled topic";
    return {
      id: String(row.id),
      contentType: "topic" as const,
      country: "Morocco",
      grade: asString(row.grade_id) ? gradesById.get(String(row.grade_id)) || null : null,
      subject: asString(row.subject_id) ? subjectsById.get(String(row.subject_id)) || null : null,
      track: null,
      topicTitle: title,
      title,
      preview: title,
      validationStatus: asStatus(row.validation_status, "unverified"),
      sourceConfidence: asNumber(row.source_confidence, 0),
      sourceName: asString(row.source_name),
      sourceUrl: asString(row.source_url),
      reviewNotes: asString(row.review_notes),
      reviewedBy: asString(row.reviewed_by),
      reviewedAt: asString(row.reviewed_at),
      createdAt: asString(row.created_at),
      raw: row,
    };
  });
}

async function buildRagChunkContexts(supabase: SupabaseClient, chunkRows: ReviewRow[]) {
  const lessonIds = Array.from(new Set(chunkRows.map((row) => asString(row.lesson_id)).filter(Boolean))) as string[];
  const gradeIds = Array.from(new Set(chunkRows.map((row) => asString(row.grade_id)).filter(Boolean))) as string[];
  const [lessonsById, gradesById] = await Promise.all([
    fetchLessonsByIds(supabase, lessonIds),
    fetchNamesByIds(supabase, "grades", gradeIds),
  ]);
  const topicsById = await fetchTopicsByIds(
    supabase,
    Array.from(
      new Set(
        Array.from(lessonsById.values())
          .map((lesson) => asString(lesson.topic_id))
          .filter(Boolean),
      ),
    ) as string[],
  );

  return chunkRows.map((row) => {
    const lesson = asString(row.lesson_id) ? lessonsById.get(String(row.lesson_id)) : null;
    const topic = asString(lesson?.topic_id) ? topicsById.get(String(lesson.topic_id)) : null;
    const metadata = parseJsonObject(row.metadata);
    const title =
      asString(lesson?.lesson_title) ||
      asString(lesson?.title) ||
      asString(metadata.title) ||
      "RAG chunk";

    return {
      id: String(row.id),
      contentType: "rag_chunk" as const,
      country: asString(lesson?.country) || "Morocco",
      grade: asString(lesson?.grade) || (asString(row.grade_id) ? gradesById.get(String(row.grade_id)) || null : null),
      subject: asString(lesson?.subject) || asString(metadata.subject),
      track: null,
      topicTitle: asString(topic?.title) || asString(metadata.topic_title),
      title,
      preview: compactText(row.content) || title,
      validationStatus: asStatus(row.validation_status, "unverified"),
      sourceConfidence: asNumber(row.source_confidence, 0),
      sourceName: asString(row.source_name),
      sourceUrl: asString(row.source_url),
      reviewNotes: asString(row.review_notes),
      reviewedBy: asString(row.reviewed_by),
      reviewedAt: asString(row.reviewed_at),
      createdAt: asString(row.created_at),
      raw: row,
    };
  });
}

async function buildRagQuestionContexts(supabase: SupabaseClient, questionRows: ReviewRow[]) {
  const lessonIds = Array.from(new Set(questionRows.map((row) => asString(row.lesson_id)).filter(Boolean))) as string[];
  const topicIds = Array.from(new Set(questionRows.map((row) => asString(row.topic_id)).filter(Boolean))) as string[];
  const chunkIds = Array.from(new Set(questionRows.map((row) => asString(row.rag_chunk_id)).filter(Boolean))) as string[];
  const [lessonsById, topicsById, chunksById] = await Promise.all([
    fetchLessonsByIds(supabase, lessonIds),
    fetchTopicsByIds(supabase, topicIds),
    fetchRagChunksByIds(supabase, chunkIds),
  ]);

  return questionRows.map((row) => {
    const lesson = asString(row.lesson_id) ? lessonsById.get(String(row.lesson_id)) : null;
    const topic = asString(row.topic_id) ? topicsById.get(String(row.topic_id)) : null;
    const chunk = asString(row.rag_chunk_id) ? chunksById.get(String(row.rag_chunk_id)) : null;
    const metadata = parseJsonObject(row.metadata);
    const title = asString(row.question) || asString(metadata.title) || "RAG question";

    return {
      id: String(row.id),
      contentType: "rag_question" as const,
      country: asString(lesson?.country) || "Morocco",
      grade: asString(lesson?.grade),
      subject: asString(lesson?.subject) || asString(metadata.subject),
      track: null,
      topicTitle: asString(topic?.title) || asString(metadata.topic_title),
      title,
      preview: compactText(row.answer) || compactText(chunk?.content) || title,
      validationStatus: asStatus(row.validation_status, "unverified"),
      sourceConfidence: asNumber(row.source_confidence, 0),
      sourceName: asString(row.source_name) || asString(chunk?.source_name),
      sourceUrl: asString(row.source_url) || asString(chunk?.source_url),
      reviewNotes: asString(row.review_notes),
      reviewedBy: asString(row.reviewed_by),
      reviewedAt: asString(row.reviewed_at),
      createdAt: asString(row.created_at),
      raw: row,
    };
  });
}

async function fetchRowsForType(supabase: SupabaseClient, contentType: CurriculumContentType) {
  const table = getTableName(contentType);
  const select =
    contentType === "lesson"
      ? LESSON_SELECT
      : contentType === "topic"
        ? TOPIC_SELECT
        : contentType === "rag_chunk"
          ? RAG_CHUNK_SELECT
          : RAG_QUESTION_SELECT;

  const { data, error } = await (supabase as any)
    .from(table)
    .select(select)
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) throw error;
  return (data || []) as ReviewRow[];
}

function matchesFilter(value: string | null, filterValue: string | null | undefined) {
  const filter = String(filterValue || "").trim().toLowerCase();
  if (!filter || filter === "all") return true;
  return String(value || "").toLowerCase().includes(filter);
}

function matchesStatus(status: CurriculumValidationStatus, filterValue: string | null | undefined) {
  const filter = String(filterValue || "").trim();
  if (!filter || filter === "all") return true;
  return status === filter;
}

function matchesConfidence(confidence: number, filterValue: string | number | null | undefined) {
  if (filterValue === null || filterValue === undefined || filterValue === "") return true;
  const threshold = Number(filterValue);
  if (!Number.isFinite(threshold)) return true;
  return confidence >= threshold;
}

async function buildContextsForType(
  supabase: SupabaseClient,
  contentType: CurriculumContentType,
  rows: ReviewRow[],
) {
  if (contentType === "lesson") return buildLessonContexts(supabase, rows);
  if (contentType === "topic") return buildTopicContexts(supabase, rows);
  if (contentType === "rag_chunk") return buildRagChunkContexts(supabase, rows);
  return buildRagQuestionContexts(supabase, rows);
}

function toReviewItem(context: ReviewContext) {
  return {
    id: context.id,
    content_type: context.contentType,
    title: context.title,
    preview: context.preview,
    grade: context.grade,
    subject: context.subject,
    topic: context.topicTitle,
    country: context.country,
    track: context.track,
    validation_status: context.validationStatus,
    source_confidence: context.sourceConfidence,
    source_name: context.sourceName,
    source_url: context.sourceUrl,
    review_notes: context.reviewNotes,
    reviewed_by: context.reviewedBy,
    reviewed_at: context.reviewedAt,
    created_at: context.createdAt,
  } satisfies CurriculumReviewItem;
}

export async function loadCurriculumReviewItems(
  supabase: SupabaseClient,
  filters: CurriculumReviewFilters = {},
) {
  const contentTypes =
    filters.content_type && filters.content_type !== "all"
      ? [filters.content_type]
      : [...CURRICULUM_CONTENT_TYPES];

  const sourceRefs = await loadSourceRefs(supabase);
  const items: CurriculumReviewItem[] = [];

  for (const contentType of contentTypes) {
    const rows = await fetchRowsForType(supabase, contentType);
    const contexts = await buildContextsForType(supabase, contentType, rows);

    for (const contextWithRaw of contexts as Array<ReviewContext & { raw: ReviewRow }>) {
      const autoMatched = await applySourceMatchIfNeeded(
        supabase,
        contextWithRaw,
        contextWithRaw.raw,
        sourceRefs,
      );

      const nextContext: ReviewContext = {
        ...contextWithRaw,
        validationStatus: autoMatched.validationStatus,
        sourceConfidence: autoMatched.sourceConfidence,
        sourceName: autoMatched.sourceName,
        sourceUrl: autoMatched.sourceUrl,
      };

      if (!matchesFilter(nextContext.grade, filters.grade)) continue;
      if (!matchesFilter(nextContext.subject, filters.subject)) continue;
      if (!matchesFilter(nextContext.topicTitle || nextContext.title, filters.topic)) continue;
      if (!matchesStatus(nextContext.validationStatus, filters.validation_status)) continue;
      if (!matchesConfidence(nextContext.sourceConfidence, filters.source_confidence)) continue;

      items.push(toReviewItem(nextContext));
    }
  }

  items.sort((left, right) => {
    if (left.validation_status !== right.validation_status) {
      const leftRank = CURRICULUM_VALIDATION_STATUSES.indexOf(left.validation_status);
      const rightRank = CURRICULUM_VALIDATION_STATUSES.indexOf(right.validation_status);
      return leftRank - rightRank;
    }

    return (right.source_confidence || 0) - (left.source_confidence || 0);
  });

  return items;
}

async function fetchRawDetailRow(
  supabase: SupabaseClient,
  contentType: CurriculumContentType,
  contentId: string,
) {
  const table = getTableName(contentType);
  const select =
    contentType === "lesson"
      ? LESSON_SELECT
      : contentType === "topic"
        ? TOPIC_SELECT
        : contentType === "rag_chunk"
          ? RAG_CHUNK_SELECT
          : RAG_QUESTION_SELECT;

  const { data, error } = await (supabase as any)
    .from(table)
    .select(select)
    .eq("id", contentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AiCommandCenterHttpError(404, "Curriculum review item not found.");
  }

  return data as ReviewRow;
}

async function fetchLatestAudit(
  supabase: SupabaseClient,
  contentType: CurriculumContentType,
  contentId: string,
) {
  const { data, error } = await supabase
    .from("curriculum_validation_audits")
    .select("*")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as CurriculumReviewAudit | null) || null;
}

export async function loadCurriculumReviewDetail(
  supabase: SupabaseClient,
  contentType: CurriculumContentType,
  contentId: string,
) {
  const raw = await fetchRawDetailRow(supabase, contentType, contentId);
  const contexts = await buildContextsForType(supabase, contentType, [raw]);
  const context = (contexts[0] as ReviewContext & { raw: ReviewRow }) || null;

  if (!context) {
    throw new AiCommandCenterHttpError(404, "Curriculum review item context could not be built.");
  }

  const sourceRefs = await loadSourceRefs(supabase, context.country || "Morocco");
  const autoMatched = await applySourceMatchIfNeeded(supabase, context, raw, sourceRefs);
  const latestAudit = await fetchLatestAudit(supabase, contentType, contentId);
  const linkedSourceRef =
    autoMatched.linkedSourceRef ||
    sourceRefs.find((row) => asString(row.source_url) && asString(row.source_url) === autoMatched.sourceUrl) ||
    null;

  const detailContext: ReviewContext = {
    ...context,
    validationStatus: autoMatched.validationStatus,
    sourceConfidence: autoMatched.sourceConfidence,
    sourceName: autoMatched.sourceName,
    sourceUrl: autoMatched.sourceUrl,
  };

  const previewBlocks =
    contentType === "lesson"
      ? parseBlocks(autoMatched.raw.blocks)
      : [];

  return {
    item: toReviewItem(detailContext),
    raw: autoMatched.raw,
    linked_source_ref: linkedSourceRef,
    latest_audit: latestAudit,
    preview_blocks: previewBlocks,
  } satisfies CurriculumReviewDetail;
}

async function resolveSourceRefForSave(
  supabase: SupabaseClient,
  sourceRefId: string | null | undefined,
) {
  if (!sourceRefId) return null;

  const { data, error } = await supabase
    .from("curriculum_source_refs")
    .select("*")
    .eq("id", sourceRefId)
    .maybeSingle();

  if (error) throw error;
  return (data as CurriculumSourceRefRecord | null) || null;
}

async function updateContentRow(
  supabase: SupabaseClient,
  contentType: CurriculumContentType,
  contentId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await (supabase as any)
    .from(getTableName(contentType))
    .update(patch)
    .eq("id", contentId);

  if (error) throw error;
}

export async function applyCurriculumReviewAction(
  supabase: SupabaseClient,
  params: {
    contentType: CurriculumContentType;
    contentId: string;
    action: ReviewAction;
    actorUserId: string;
    reviewNotes?: string | null;
    title?: string | null;
    content?: string | null;
    answer?: string | null;
    sourceRefId?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
  },
) {
  const detail = await loadCurriculumReviewDetail(supabase, params.contentType, params.contentId);
  const sourceRef = await resolveSourceRefForSave(supabase, params.sourceRefId);
  const reviewNotes = asString(params.reviewNotes) || detail.item.review_notes;
  const patch: Record<string, unknown> = {
    review_notes: reviewNotes,
  };
  const auditMismatches: Record<string, unknown> = {};
  let validationResult = detail.item.validation_status;
  let recommendation: string | null = null;

  if (sourceRef) {
    patch.source_name = sourceRef.source_name;
    patch.source_url = sourceRef.source_url;
    patch.source_confidence = Math.max(detail.item.source_confidence || 0, asNumber(sourceRef.confidence_weight, 0.5));
    auditMismatches.linked_source_ref_id = sourceRef.id;
    auditMismatches.linked_source_ref = {
      topic_title: sourceRef.topic_title,
      subject: sourceRef.subject,
      grade: sourceRef.grade,
    };

    if (["unverified", "ai_generated"].includes(detail.item.validation_status)) {
      patch.validation_status = "source_matched";
      validationResult = "source_matched";
    }
  } else {
    if (asString(params.sourceName)) patch.source_name = asString(params.sourceName);
    if (asString(params.sourceUrl)) patch.source_url = asString(params.sourceUrl);
  }

  switch (params.action) {
    case "teacher_reviewed":
      patch.validation_status = "teacher_reviewed";
      patch.reviewed_by = params.actorUserId;
      patch.reviewed_at = nowIso();
      validationResult = "teacher_reviewed";
      recommendation = "Teacher review accepted this content for classroom use.";
      break;
    case "official_validated":
      patch.validation_status = "official_validated";
      patch.reviewed_by = params.actorUserId;
      patch.reviewed_at = nowIso();
      validationResult = "official_validated";
      recommendation = "Marked as officially validated against trusted curriculum sources.";
      break;
    case "reject":
      patch.validation_status = "rejected";
      patch.reviewed_by = params.actorUserId;
      patch.reviewed_at = nowIso();
      validationResult = "rejected";
      recommendation = "Rejected pending content from student-facing use.";
      break;
    case "request_regeneration":
      patch.validation_status = "ai_generated";
      patch.source_confidence = 0;
      patch.reviewed_by = params.actorUserId;
      patch.reviewed_at = nowIso();
      validationResult = "ai_generated";
      recommendation = "Regeneration requested; item remains draft AI-assisted content.";
      break;
    case "save_manual_edits":
      if (params.contentType === "lesson" && asString(params.title)) {
        patch.lesson_title = asString(params.title);
        patch.title = asString(params.title);
      }
      if (params.contentType === "topic" && asString(params.title)) {
        patch.title = asString(params.title);
      }
      if (params.contentType === "rag_chunk" && asString(params.content)) {
        patch.content = asString(params.content);
      }
      if (params.contentType === "rag_question") {
        if (asString(params.title)) {
          patch.question = asString(params.title);
        }
        if (asString(params.answer)) {
          patch.answer = asString(params.answer);
        }
      }
      validationResult = patch.validation_status
        ? asStatus(patch.validation_status, detail.item.validation_status)
        : detail.item.validation_status;
      recommendation = "Manual edits were saved for reviewer follow-up.";
      break;
    default:
      throw new AiCommandCenterHttpError(400, "Unsupported curriculum review action.");
  }

  if (Object.keys(patch).length === 0) {
    throw new AiCommandCenterHttpError(400, "No changes were supplied for this curriculum review action.");
  }

  await updateContentRow(supabase, params.contentType, params.contentId, patch);
  await createValidationAudit(supabase, {
    contentId: params.contentId,
    contentType: params.contentType,
    validationResult,
    mismatches: auditMismatches,
    recommendation,
  });

  return loadCurriculumReviewDetail(supabase, params.contentType, params.contentId);
}
