import { supabase } from "../../db/supabase";
import {
  McpMaterialRequirement,
  McpPipelineType,
  McpPromptTopic,
  McpTopicOutline,
  McpTrustedSource,
} from "./buildMcpLessonPrompt";

const PROFILE_BY_PIPELINE: Record<McpPipelineType, string> = {
  admin_heavy: "admin_heavy_curriculum_builder",
  learner_light: "learner_quick_explainer",
  remedial_micro_lesson: "learner_quick_explainer",
  exam_practice: "admin_heavy_curriculum_builder",
};

const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

const usableChunk = (chunk: Record<string, any>) =>
  String(chunk.content || "").trim().length > 100 &&
  Boolean(chunk.topic_id || chunk.grade_id) &&
  chunk.embedding_status === "done";

const uniqueById = (rows: Array<Record<string, any>>) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = String(row.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const readMaybe = async <T>(query: any): Promise<{ data: T | null; error: any | null }> => {
  try {
    const result = await query;
    return { data: result.data as T, error: result.error ?? null };
  } catch (error) {
    return { data: null, error };
  }
};

export interface LoadedMcpContext {
  pipelineType: McpPipelineType;
  profile: Record<string, any> | null;
  topic: McpPromptTopic;
  topicOutlines: McpTopicOutline[];
  trustedSources: McpTrustedSource[];
  materialRequirements: McpMaterialRequirement[];
  ragChunks: Array<Record<string, any>>;
  sourcePack: McpTrustedSource[];
  materialPack: McpMaterialRequirement[];
}

export const loadMcpContext = async (
  topicId: string,
  pipelineType: McpPipelineType,
): Promise<LoadedMcpContext> => {
  const { data: topicRows, error: topicError } = await supabase
    .from("topics")
    .select(`
      id,
      title,
      domain_id,
      domain_code,
      domain_name,
      grades:grade_id(id, name, cycle),
      subjects:subject_id(id, name)
    `)
    .eq("id", topicId)
    .limit(1);

  if (topicError) throw new Error(`Unable to load MCP topic: ${topicError.message}`);

  const topicRow = asArray<Record<string, any>>(topicRows)[0];
  if (!topicRow) throw new Error(`Topic not found for MCP context: ${topicId}`);

  const gradeRow = Array.isArray(topicRow.grades) ? topicRow.grades[0] : topicRow.grades;
  const subjectRow = Array.isArray(topicRow.subjects) ? topicRow.subjects[0] : topicRow.subjects;

  const topic: McpPromptTopic = {
    id: topicRow.id,
    title: firstString(topicRow.title),
    grade: firstString(gradeRow?.name, topicRow.grade),
    cycle: firstString(gradeRow?.cycle, topicRow.cycle),
    subject: firstString(subjectRow?.name, topicRow.subject),
    domain: firstString(topicRow.domain_name, topicRow.domain_code, topicRow.domain),
  };
  const gradeId = firstString(gradeRow?.id, topicRow.grade_id);
  const subjectId = firstString(subjectRow?.id, topicRow.subject_id);

  const [
    outlineResult,
    profileResult,
    materialResult,
    trustedSourceResult,
  ] = await Promise.all([
    supabase
      .from("topic_outlines")
      .select("title, description, outline_order")
      .eq("topic_id", topicId)
      .order("outline_order", { ascending: true }),
    supabase
      .from("mcp_profiles")
      .select("*")
      .eq("code", PROFILE_BY_PIPELINE[pipelineType])
      .maybeSingle(),
    supabase
      .from("topic_material_requirements")
      .select("*")
      .eq("topic_id", topicId),
    supabase
      .from("trusted_sources")
      .select("*")
      .limit(25),
  ]);

  if (outlineResult.error) throw new Error(`Unable to load topic_outlines: ${outlineResult.error.message}`);
  if (profileResult.error) throw new Error(`Unable to load MCP profile: ${profileResult.error.message}`);
  if (materialResult.error) throw new Error(`Unable to load material requirements: ${materialResult.error.message}`);

  const ragSelect = "id, topic_id, grade_id, content, source_name, source_type, source_url, source_confidence, metadata, embedding_status";
  const exactTopic = await readMaybe<Record<string, any>[]>(
    supabase
      .from("rag_chunks")
      .select(ragSelect)
      .eq("topic_id", topicId)
      .eq("embedding_status", "done")
      .not("embedding", "is", null)
      .not("grade_id", "is", null)
      .not("content", "is", null)
      .limit(12),
  );

  let ragChunks = asArray<Record<string, any>>(exactTopic.data).filter(usableChunk);

  if (ragChunks.length < 6 && gradeId && subjectId) {
    const sameSubject = await readMaybe<Record<string, any>[]>(
      supabase
        .from("rag_chunks")
        .select(`${ragSelect}, topics:topic_id!inner(id, grade_id, subject_id)`)
        .eq("topics.grade_id", gradeId)
        .eq("topics.subject_id", subjectId)
        .eq("embedding_status", "done")
        .not("embedding", "is", null)
        .not("content", "is", null)
        .limit(12),
    );
    ragChunks = uniqueById([...ragChunks, ...asArray<Record<string, any>>(sameSubject.data).filter(usableChunk)]).slice(0, 12);
  }

  if (ragChunks.length < 6 && gradeId) {
    const sameGrade = await readMaybe<Record<string, any>[]>(
      supabase
        .from("rag_chunks")
        .select(ragSelect)
        .eq("grade_id", gradeId)
        .eq("embedding_status", "done")
        .not("embedding", "is", null)
        .not("content", "is", null)
        .limit(24),
    );
    ragChunks = uniqueById([...ragChunks, ...asArray<Record<string, any>>(sameGrade.data).filter(usableChunk)]).slice(0, 12);
  }

  if (ragChunks.length < 6 && gradeId) {
    const metadataFallback = await readMaybe<Record<string, any>[]>(
      supabase
        .from("rag_chunks")
        .select(ragSelect)
        .is("topic_id", null)
        .eq("grade_id", gradeId)
        .eq("embedding_status", "done")
        .not("embedding", "is", null)
        .not("content", "is", null)
        .limit(50),
    );
    const normalizedTitle = topic.title.toLowerCase();
    const normalizedSubject = topic.subject.toLowerCase();
    const metadataMatches = asArray<Record<string, any>>(metadataFallback.data).filter((chunk) => {
      const metadata = chunk.metadata || {};
      const title = firstString(metadata.topic_title, metadata.topic_name, metadata.topic, metadata.title).toLowerCase();
      const subject = firstString(metadata.subject, metadata.subject_name, metadata.source?.subject, metadata.source?.subject_name).toLowerCase();
      return usableChunk(chunk) && (
        (title && (title.includes(normalizedTitle) || normalizedTitle.includes(title))) ||
        (subject && normalizedSubject && subject === normalizedSubject)
      );
    });
    ragChunks = uniqueById([...ragChunks, ...metadataMatches]).slice(0, 12);
  }
  const materialRequirements = asArray<McpMaterialRequirement>(materialResult.data);
  const trustedSources = [
    ...ragChunks.map((chunk): McpTrustedSource => ({
      source_name: firstString(chunk.source_name, chunk.metadata?.source_name, "rag_chunks"),
      source_type: firstString(chunk.source_type, chunk.metadata?.source_type, "rag_chunk"),
      trust_tier: firstString(chunk.metadata?.trust_tier, "approved_rag"),
      source_url: firstString(chunk.source_url, chunk.metadata?.source_url),
      license_type: firstString(chunk.metadata?.license_type),
      excerpt: firstString(chunk.content),
      used_for: "lesson_source_grounding",
      confidence: Number(chunk.source_confidence ?? chunk.metadata?.confidence ?? 0.75),
    })),
    ...asArray<Record<string, any>>(trustedSourceResult.data).map((source): McpTrustedSource => ({
      source_name: firstString(source.source_name, source.name, source.title),
      source_type: firstString(source.source_type, source.type),
      trust_tier: source.trust_tier ?? source.tier ?? null,
      source_url: firstString(source.source_url, source.url),
      license_type: firstString(source.license_type, source.license),
      excerpt: firstString(source.excerpt, source.description),
      used_for: firstString(source.used_for, "trusted_source_registry"),
      confidence: Number(source.confidence ?? source.source_confidence ?? 0.65),
    })),
  ];

  return {
    pipelineType,
    profile: profileResult.data ?? null,
    topic,
    topicOutlines: asArray<McpTopicOutline>(outlineResult.data),
    trustedSources,
    materialRequirements,
    ragChunks,
    sourcePack: trustedSources,
    materialPack: materialRequirements,
  };
};
