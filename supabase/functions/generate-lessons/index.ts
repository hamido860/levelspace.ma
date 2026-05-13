import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildFallbackBlocksFromOutlines,
  normalizeLessonBlocks,
  type NormalizedLessonBlock,
  type TopicOutlineInput,
} from "./lessonBlocks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeValue = (value: string | null | undefined) =>
  String(value || "").trim().replace(/\s+/g, " ");

const getCanonicalTopicTitle = (topic: string, lessonTitle?: string | null) => {
  const requestedTopic = normalizeValue(topic);
  if (requestedTopic) return requestedTopic;

  const generatedTitle = normalizeValue(lessonTitle);
  return generatedTitle || null;
};

const deriveCycleFromGrade = (grade: string) => {
  const normalizedGrade = normalizeValue(grade).toLowerCase();

  if (
    normalizedGrade.includes("primaire") ||
    normalizedGrade.startsWith("primary") ||
    normalizedGrade.includes("elementary")
  ) {
    return "primary";
  }

  if (
    normalizedGrade.includes("college") ||
    normalizedGrade.includes("collège") ||
    normalizedGrade.startsWith("middle")
  ) {
    return "college";
  }

  if (
    normalizedGrade.includes("tronc commun") ||
    normalizedGrade.includes("bac") ||
    normalizedGrade.includes("seconde") ||
    normalizedGrade.includes("premiere") ||
    normalizedGrade.includes("terminale") ||
    normalizedGrade.startsWith("grade 10") ||
    normalizedGrade.startsWith("grade 11") ||
    normalizedGrade.startsWith("grade 12")
  ) {
    return "lycee";
  }

  return "higher";
};

async function resolveTopicContext(
  supabaseAdmin: any,
  lessonContext: { grade: string; subject: string; topic: string; lessonTitle?: string | null }
) {
  const gradeName = normalizeValue(lessonContext.grade);
  const subjectName = normalizeValue(lessonContext.subject);
  const topicTitle = getCanonicalTopicTitle(lessonContext.topic, lessonContext.lessonTitle);

  if (!gradeName || !subjectName || !topicTitle) {
    return null;
  }

  const [{ data: grades, error: gradeError }, { data: subjects, error: subjectError }] = await Promise.all([
    supabaseAdmin.from("grades").select("id, name").ilike("name", gradeName).limit(1),
    supabaseAdmin.from("subjects").select("id, name").ilike("name", subjectName).limit(1),
  ]);

  if (gradeError) throw gradeError;
  if (subjectError) throw subjectError;

  const gradeRows = (grades || []) as Array<{ id: string }>;
  const subjectRows = (subjects || []) as Array<{ id: string }>;
  const gradeId = gradeRows[0]?.id;
  const subjectId = subjectRows[0]?.id;

  if (!gradeId || !subjectId) {
    return null;
  }

  const { data: existingTopics, error: topicLookupError } = await supabaseAdmin
    .from("topics")
    .select("id, title")
    .eq("grade_id", gradeId)
    .eq("subject_id", subjectId)
    .ilike("title", topicTitle)
    .limit(1);

  if (topicLookupError) throw topicLookupError;

  const existingTopicRows = (existingTopics || []) as Array<{ id: string }>;
  const existingTopicId = existingTopicRows[0]?.id;
  if (existingTopicId) {
    return { topicId: existingTopicId, gradeId, subjectId, topicTitle };
  }

  const { data: createdTopic, error: createTopicError } = await supabaseAdmin
    .from("topics")
    .insert({
      grade_id: gradeId,
      subject_id: subjectId,
      title: topicTitle,
    })
    .select("id")
    .single();

  if (createTopicError) throw createTopicError;

  const createdTopicId = (createdTopic as { id?: string } | null)?.id;
  if (!createdTopicId) {
    return null;
  }

  return { topicId: createdTopicId, gradeId, subjectId, topicTitle };
}

const getRequestQueueJobId = (body: Record<string, unknown>) =>
  normalizeValue(
    typeof body.queueJobId === "string" ? body.queueJobId
      : typeof body.queue_job_id === "string" ? body.queue_job_id
        : typeof body.jobId === "string" ? body.jobId
          : typeof body.job_id === "string" ? body.job_id
            : ""
  ) || null;

const formatDbError = (error: any) =>
  [
    error?.message,
    error?.details,
    error?.hint,
    error?.code ? `code=${error.code}` : null,
  ].filter(Boolean).join(" | ") || "Unknown database error";

type RagChunkInput = {
  id?: string | null;
  content?: string | null;
  source_name?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  source_confidence?: number | null;
  metadata?: Record<string, unknown> | null;
};

type TopicData = {
  outlines: TopicOutlineInput[];
  ragChunks: RagChunkInput[];
  fallbackReason: string | null;
};

type LessonGenerationResult = {
  lesson: any | null;
  error: string | null;
};

const APPROVED_OUTLINE_STATUSES = new Set(["approved", "published", "done", "valid", "passed"]);

const isApprovedTopicOutline = (outline: TopicOutlineInput & Record<string, unknown>) => {
  const hasApprovalFields = [
    "approved",
    "is_approved",
    "status",
    "validation_status",
    "review_status",
  ].some((key) => Object.prototype.hasOwnProperty.call(outline, key));

  if (!hasApprovalFields) return true;
  if (outline["approved"] === true || outline["is_approved"] === true) return true;

  const statuses = [
    outline["status"],
    outline["validation_status"],
    outline["review_status"],
  ].map((value) => normalizeValue(String(value || "")).toLowerCase());

  return statuses.some((status) => APPROVED_OUTLINE_STATUSES.has(status));
};

type MaterialRequirementInput = {
  id?: string | null;
  material_type?: string | null;
  title?: string | null;
  purpose?: string | null;
  required?: boolean | null;
  search_query?: string | null;
  status?: string | null;
};

type McpQualityCheckInput = {
  check_category: string;
  status: "pass" | "warning" | "fail";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  evidence: Record<string, unknown>;
};

async function fetchTopicOutlines(supabaseAdmin: any, topicId: string | null): Promise<TopicOutlineInput[]> {
  if (!topicId) return [];

  const { data, error } = await supabaseAdmin
    .from("topic_outlines")
    .select("*")
    .eq("topic_id", topicId)
    .order("outline_order", { ascending: true });

  if (error) throw new Error(`topic_outlines lookup failed: ${formatDbError(error)}`);
  return ((data || []) as Array<TopicOutlineInput & Record<string, unknown>>).filter(isApprovedTopicOutline);
}

async function fetchTopicData(supabaseAdmin: any, topicId: string | null): Promise<TopicData> {
  const outlines = await fetchTopicOutlines(supabaseAdmin, topicId);
  if (!topicId) {
    const fallbackReason = "no resolved topic_id; cannot fetch topic-linked rag_chunks";
    console.warn(`generate-lessons source fallback: topic_id=unresolved reason=${fallbackReason}`);
    return { outlines, ragChunks: [], fallbackReason };
  }

  const { data, error } = await supabaseAdmin
    .from("rag_embeddings")
    .select(`
      id,
      embedding_model,
      rag_chunks!inner(
        id,
        content,
        cleaned_content,
        source_name,
        source_type,
        source_url,
        source_confidence,
        metadata,
        topic_id,
        status,
        created_at
      )
    `)
    .eq("rag_chunks.topic_id", topicId)
    .in("rag_chunks.status", ["clean", "embedded"])
    .order("created_at", { referencedTable: "rag_chunks", ascending: false })
    .limit(10);

  if (error) throw new Error(`rag_embeddings lookup by topic_id failed: ${formatDbError(error)}`);

  const ragChunks = ((data || []) as Array<Record<string, any>>)
    .map((row) => {
      const chunk = Array.isArray(row.rag_chunks) ? row.rag_chunks[0] : row.rag_chunks;
      return {
        ...(chunk || {}),
        content: chunk?.cleaned_content || chunk?.content,
        metadata: {
          ...(chunk?.metadata || {}),
          embedding_id: row.id,
          embedding_model: row.embedding_model,
        },
      } as RagChunkInput;
    })
    .filter((chunk) => normalizeValue(chunk.content).length > 0);
  let fallbackReason: string | null = null;
  if (ragChunks.length === 0) {
    fallbackReason = `no usable RAG embeddings for topic_id=${topicId} (requires rag_embeddings row joined to clean/embedded rag_chunks.topic_id); approved topic_outlines count=${outlines.length}`;
    console.warn(`generate-lessons source fallback: topic_id=${topicId} reason=${fallbackReason}`);
  }

  return { outlines, ragChunks, fallbackReason };
}

async function fetchMaterialRequirements(supabaseAdmin: any, topicId: string | null): Promise<MaterialRequirementInput[]> {
  if (!topicId) return [];
  const { data, error } = await supabaseAdmin
    .from("topic_material_requirements")
    .select("*")
    .eq("topic_id", topicId);

  if (error) throw new Error(`topic_material_requirements lookup failed: ${formatDbError(error)}`);
  return (data || []) as MaterialRequirementInput[];
}

async function fetchMcpProfile(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from("mcp_profiles")
    .select("*")
    .eq("code", "admin_heavy_curriculum_builder")
    .single();

  if (error) throw new Error(`mcp_profiles lookup failed: ${formatDbError(error)}`);
  return data;
}

async function fetchTrustedSources(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from("trusted_sources")
    .select("*")
    .limit(20);

  if (error) {
    console.warn(`trusted_sources lookup failed: ${formatDbError(error)}`);
    return [];
  }
  return data || [];
}

const buildSourcePack = (topicData: TopicData, trustedSources: any[]) => {
  if (topicData.ragChunks.length > 0) {
    return topicData.ragChunks.map((chunk: any) => ({
      rag_chunk_id: chunk.id ?? null,
      source_name: normalizeValue(chunk.source_name || chunk.metadata?.source_name || "rag_chunks"),
      source_type: normalizeValue(chunk.source_type || chunk.metadata?.source_type || "rag_chunk"),
      trust_tier: normalizeValue(chunk.metadata?.trust_tier || "approved_rag"),
      source_url: normalizeValue(chunk.source_url || chunk.metadata?.source_url),
      license_type: normalizeValue(chunk.metadata?.license_type),
      excerpt: normalizeValue(chunk.content).slice(0, 1200),
      used_for: "lesson_source_grounding",
      confidence: Number(chunk.source_confidence ?? chunk.metadata?.confidence ?? 0.75),
    }));
  }

  if (topicData.outlines.length > 0) {
    return topicData.outlines.map((outline: any, index) => ({
      rag_chunk_id: null,
      source_name: "topic_outlines",
      source_type: "topic_outline",
      trust_tier: "curriculum_outline",
      source_url: "",
      license_type: "",
      excerpt: [normalizeValue(outline.title), normalizeValue(outline.description)].filter(Boolean).join("\n\n").slice(0, 1200),
      used_for: `fallback_outline_${index + 1}`,
      confidence: 0.45,
    }));
  }

  return trustedSources.slice(0, 10).map((source: any) => ({
    source_name: normalizeValue(source.source_name || source.name || source.title || "trusted_source"),
    source_type: normalizeValue(source.source_type || source.type || "trusted_source"),
    trust_tier: source.trust_tier ?? source.tier ?? null,
    source_url: normalizeValue(source.source_url || source.url),
    license_type: normalizeValue(source.license_type || source.license),
    excerpt: normalizeValue(source.excerpt || source.description).slice(0, 1200),
    used_for: "trusted_source_registry",
    confidence: Number(source.confidence ?? source.source_confidence ?? 0.65),
  }));
};

const buildMaterialPack = (requirements: MaterialRequirementInput[]) =>
  requirements.map((requirement) => ({
    id: requirement.id ?? null,
    material_type: requirement.material_type ?? null,
    title: requirement.title ?? null,
    purpose: requirement.purpose ?? null,
    required: requirement.required !== false,
    search_query: requirement.search_query ?? null,
    status: requirement.status ?? null,
  }));

const buildSourceContext = (topicData: TopicData) => {
  if (topicData.ragChunks.length > 0) {
    return [
      "Certified RAG chunks for this exact topic:",
      ...topicData.ragChunks.map((chunk, index) => `Chunk ${index + 1}:\n${normalizeValue(chunk.content)}`),
    ].join("\n\n");
  }

  if (topicData.outlines.length > 0) {
    return [
      "No RAG chunks exist for this topic. Use these topic_outlines as the lesson skeleton:",
      ...topicData.outlines.map((outline, index) => {
        const title = normalizeValue(String(outline.title ?? ""));
        const description = normalizeValue(String(outline.description ?? ""));
        return `Outline ${index + 1}: ${[title, description].filter(Boolean).join(" - ")}`;
      }),
    ].join("\n");
  }

  return "No usable RAG chunks or approved topic_outlines were found for this topic.";
};

const buildFallbackLessonFromOutlines = (
  topicTitle: string,
  outlines: TopicOutlineInput[],
  reason: string
) => {
  const blocks = buildFallbackBlocksFromOutlines(topicTitle, outlines);
  return {
    lesson_title: normalizeValue(topicTitle) || "Generated lesson",
    content: blocks.map((block) => block.content).join("\n\n"),
    blocks,
    exercises: [],
    quizzes: [],
    exam: null,
    fallback_reason: reason,
  };
};

async function createMcpGenerationRun(
  supabaseAdmin: any,
  input: {
    topicId: string | null;
    profileId: string | null;
    sourcePack: unknown[];
    materialPack: unknown[];
  }
) {
  const { data, error } = await supabaseAdmin
    .from("mcp_generation_runs")
    .insert({
      status: "generating",
      pipeline_type: "admin_heavy",
      topic_id: input.topicId,
      mcp_profile_id: input.profileId,
      source_pack: input.sourcePack,
      material_pack: input.materialPack,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`mcp_generation_runs insert failed: ${formatDbError(error)}`);
  return data?.id ?? null;
}

async function updateMcpGenerationRun(
  supabaseAdmin: any,
  runId: string | null,
  patch: Record<string, unknown>
) {
  if (!runId) return;
  const { error } = await supabaseAdmin
    .from("mcp_generation_runs")
    .update({
      ...patch,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) console.error("mcp_generation_runs update error:", error);
}

async function insertSourceEvidence(
  supabaseAdmin: any,
  input: {
    lessonId: string;
    topicId: string | null;
    sourcePack: any[];
  }
) {
  const rows = input.sourcePack.map((source) => ({
    lesson_id: input.lessonId,
    topic_id: input.topicId,
    rag_chunk_id: source.rag_chunk_id ?? null,
    source_name: source.source_name || "unknown_source",
    source_type: source.source_type || "unknown",
    trust_tier: source.trust_tier ?? null,
    excerpt: source.excerpt ?? null,
    used_for: source.used_for || "lesson_generation",
    confidence: Number(source.confidence ?? 0.5),
  }));

  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("lesson_source_evidence").insert(rows);
  if (error) console.error("lesson_source_evidence insert error:", error);
}

async function insertLessonMaterials(
  supabaseAdmin: any,
  input: {
    lessonId: string;
    topicId: string | null;
    materialPack: any[];
    materialRequests: any[];
  }
) {
  const requirementRows = input.materialPack
    .filter((requirement) => requirement.required !== false)
    .map((requirement) => ({
      lesson_id: input.lessonId,
      topic_id: input.topicId,
      material_type: "material_request",
      title: requirement.title || `${requirement.material_type || "material"} request`,
      purpose: requirement.purpose || `Attach verified ${requirement.material_type || "material"} material.`,
      required: true,
      approved: false,
      license_type: "pending",
      attribution: "",
      source_url: null,
      metadata: {
        requested_material_type: requirement.material_type ?? null,
        search_query: requirement.search_query ?? null,
        requirement_status: requirement.status ?? null,
      },
    }));

  const alignmentRows = input.materialRequests.map((request) => ({
    lesson_id: input.lessonId,
    topic_id: input.topicId,
    material_type: "material_request",
    title: request.title || "Material request",
    purpose: request.purpose || "Material required by MCP quality check.",
    required: true,
    approved: false,
    license_type: "pending",
    attribution: "",
    source_url: null,
    metadata: request.metadata ?? {},
  }));

  const rows = [...requirementRows, ...alignmentRows];
  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("lesson_materials").insert(rows);
  if (error) console.error("lesson_materials insert error:", error);
}

async function insertQualityChecks(
  supabaseAdmin: any,
  input: {
    lessonId?: string | null;
    topicId: string | null;
    runId: string | null;
    checks: McpQualityCheckInput[];
  }
) {
  if (input.checks.length === 0) return;

  const rows = input.checks.map((check) => ({
    lesson_id: input.lessonId ?? null,
    topic_id: input.topicId,
    mcp_generation_run_id: input.runId,
    check_category: check.check_category,
    status: check.status,
    severity: check.severity,
    message: check.message,
    evidence: check.evidence,
  }));

  const { error } = await supabaseAdmin.from("mcp_quality_checks").insert(rows);
  if (error) console.error("mcp_quality_checks insert error:", error);
}

async function writeGenerationLog(
  supabaseAdmin: any,
  input: {
    lessonId?: string | null;
    topicId?: string | null;
    blocksCount?: number | null;
    success: boolean;
    error?: string | null;
    durationMs: number;
  }
) {
  const { error } = await supabaseAdmin.from("lesson_gen_log").insert({
    lesson_id: input.lessonId ?? null,
    topic_id: input.topicId ?? null,
    api_key_idx: 0,
    blocks_count: input.blocksCount ?? null,
    duration_ms: input.durationMs,
    success: input.success,
    error: input.error ?? null,
  });

  if (error) console.error("lesson_gen_log insert error:", error);
}

async function saveQueueError(supabaseAdmin: any, queueJobId: string | null, detailedError: string) {
  if (!queueJobId) return;

  const now = new Date().toISOString();
  const { error: lastErrorUpdateError } = await supabaseAdmin
    .from("lesson_gen_queue")
    .update({ last_error: detailedError })
    .eq("id", queueJobId);

  if (lastErrorUpdateError) {
    console.error("lesson_gen_queue last_error update error:", lastErrorUpdateError);
    return;
  }

  const { error: failedUpdateError } = await supabaseAdmin
    .from("lesson_gen_queue")
    .update({ status: "failed", last_error: detailedError, completed_at: now, claimed_at: null })
    .eq("id", queueJobId);

  if (failedUpdateError) console.error("lesson_gen_queue failed status update error:", failedUpdateError);
}

async function saveQueueSuccess(supabaseAdmin: any, queueJobId: string | null) {
  if (!queueJobId) return;

  const { error } = await supabaseAdmin
    .from("lesson_gen_queue")
    .update({
      status: "done",
      last_error: null,
      completed_at: new Date().toISOString(),
      claimed_at: null,
    })
    .eq("id", queueJobId);

  if (error) console.error("lesson_gen_queue success update error:", error);
}

async function persistLessonBlocks(
  supabaseAdmin: any,
  lessonId: string,
  blocks: NormalizedLessonBlock[]
) {
  const { error: deleteError } = await supabaseAdmin.from("lesson_blocks").delete().eq("lesson_id", lessonId);
  if (deleteError) throw new Error(`lesson_blocks cleanup failed: ${formatDbError(deleteError)}`);

  const rows = blocks.map((block, index) => ({
    lesson_id: lessonId,
    type: block.type,
    content: block.content,
    order_index: index + 1,
  }));

  const { error } = await supabaseAdmin.from("lesson_blocks").insert(rows);
  if (error) throw new Error(`lesson_blocks insert failed: ${formatDbError(error)}`);
}

const stringifyBlocks = (blocks: unknown) =>
  Array.isArray(blocks)
    ? blocks.map((block) => {
      if (!block || typeof block !== "object") return String(block ?? "");
      const record = block as Record<string, unknown>;
      return [record.type, record.title, record.label, record.content, record.text, record.body].map((item) => String(item ?? "")).join(" ");
    }).join("\n").toLowerCase()
    : String(blocks ?? "").toLowerCase();

const hasMaterialType = (materials: any[], types: string[]) => {
  const wanted = new Set(types.map((type) => type.toLowerCase()));
  return materials.some((material) => wanted.has(normalizeValue(material.material_type).toLowerCase()));
};

function validateMaterialAlignment(
  blocks: unknown,
  materialRequirements: MaterialRequirementInput[],
  lessonMaterials: any[],
): { checks: McpQualityCheckInput[]; materialRequests: any[] } {
  const text = stringifyBlocks(blocks);
  const checks: McpQualityCheckInput[] = [];
  const materialRequests: any[] = [];
  const availableMaterials = [...materialRequirements, ...lessonMaterials];

  const addMaterialRequest = (materialType: string, purpose: string, searchQuery?: string | null) => {
    materialRequests.push({
      title: `${materialType} needed`,
      purpose,
      metadata: {
        requested_material_type: materialType,
        search_query: searchQuery ?? null,
      },
    });
  };

  if (/(^|\W)(map|carte|خريطة)(\W|$)/i.test(text) && !hasMaterialType(availableMaterials, ["map"])) {
    const requirement = materialRequirements.find((item) => normalizeValue(item.material_type).toLowerCase() === "map");
    addMaterialRequest("map", "Lesson references a map and needs an approved map material.", requirement?.search_query);
    checks.push({
      check_category: "material_alignment",
      status: "warning",
      severity: "high",
      message: "Lesson references a map but no map material is attached.",
      evidence: { required_material_type: "map" },
    });
  }

  if (/(diagram|schéma|schema|رسم|مبيان)/i.test(text) && !hasMaterialType(availableMaterials, ["diagram", "chart"])) {
    const requirement = materialRequirements.find((item) => ["diagram", "chart"].includes(normalizeValue(item.material_type).toLowerCase()));
    addMaterialRequest("diagram", "Lesson references a diagram/chart and needs an approved visual material.", requirement?.search_query);
    checks.push({
      check_category: "material_alignment",
      status: "warning",
      severity: "high",
      message: "Lesson references a diagram or chart but no diagram/chart material is attached.",
      evidence: { required_material_type: "diagram_or_chart" },
    });
  }

  const hasFormulaMention = /(formula|formule|équation|equation|صيغة|معادلة)/i.test(text);
  const hasFormulaBlock = Array.isArray(blocks) && blocks.some((block) => block && typeof block === "object" && normalizeValue((block as any).type).toLowerCase() === "formula");
  if (hasFormulaMention && !hasFormulaBlock) {
    checks.push({
      check_category: "schema_validity",
      status: "warning",
      severity: "medium",
      message: "Lesson references a formula but does not include a formula block.",
      evidence: { required_block_type: "formula" },
    });
  }

  const hasExperimentMention = /(experiment|expérience|experience|تجربة)/i.test(text);
  const hasSafetyNote = /(safety|sécurité|securite|سلامة)/i.test(text);
  if (hasExperimentMention && !hasMaterialType(availableMaterials, ["experiment_protocol"]) && !hasSafetyNote) {
    addMaterialRequest("experiment_protocol", "Lesson references an experiment and needs a protocol or safety note.");
    checks.push({
      check_category: "material_alignment",
      status: "fail",
      severity: "high",
      message: "Lesson references an experiment but no experiment protocol or safety note is attached.",
      evidence: { required_material_type: "experiment_protocol" },
    });
  }

  if (!checks.some((check) => check.check_category === "material_alignment")) {
    checks.push({
      check_category: "material_alignment",
      status: "pass",
      severity: "low",
      message: "Lesson materials align with referenced maps, diagrams, formulas, and experiments.",
      evidence: { checked_rules: ["map", "diagram", "formula", "experiment"] },
    });
  }

  return { checks, materialRequests };
}

function buildQualityChecks(input: {
  lessonBlocks: NormalizedLessonBlock[];
  topicData: TopicData;
  materialRequirements: MaterialRequirementInput[];
  materialAlignmentChecks: McpQualityCheckInput[];
  fallbackUsed: boolean;
  hasRagChunks: boolean;
  grade: string;
  lesson: any;
}): McpQualityCheckInput[] {
  const baseChecks: McpQualityCheckInput[] = [
    {
      check_category: "curriculum_alignment",
      status: input.topicData.outlines.length > 0 ? "pass" : "warning",
      severity: input.topicData.outlines.length > 0 ? "low" : "medium",
      message: input.topicData.outlines.length > 0 ? "Lesson generated with ordered topic outlines." : "No topic outlines were available.",
      evidence: { outline_count: input.topicData.outlines.length },
    },
    {
      check_category: "source_grounding",
      status: input.hasRagChunks ? "pass" : "warning",
      severity: input.hasRagChunks ? "low" : "high",
      message: input.hasRagChunks ? "Lesson used topic_id RAG chunks as source evidence." : "No RAG chunks were available; topic_outlines fallback used.",
      evidence: { rag_chunk_count: input.topicData.ragChunks.length, fallback_used: input.fallbackUsed },
    },
    {
      check_category: "grade_alignment",
      status: normalizeValue(input.grade) ? "pass" : "warning",
      severity: normalizeValue(input.grade) ? "low" : "medium",
      message: "Prompt required exact grade adaptation and no Bac assumption unless grade is Bac.",
      evidence: { grade: input.grade },
    },
    {
      check_category: "language_quality",
      status: "warning",
      severity: "medium",
      message: "AI language output requires human review before publication.",
      evidence: { validation_status: "needs_review" },
    },
    {
      check_category: "pedagogical_quality",
      status: input.lessonBlocks.length >= 2 ? "pass" : "warning",
      severity: input.lessonBlocks.length >= 2 ? "low" : "medium",
      message: input.lessonBlocks.length >= 2 ? "Lesson contains multiple pedagogical blocks." : "Lesson has limited pedagogical structure.",
      evidence: { block_count: input.lessonBlocks.length },
    },
    {
      check_category: "schema_validity",
      status: input.lessonBlocks.length > 0 ? "pass" : "fail",
      severity: input.lessonBlocks.length > 0 ? "low" : "critical",
      message: input.lessonBlocks.length > 0 ? "Lesson JSON normalized into valid blocks." : "Lesson JSON did not produce valid blocks.",
      evidence: { block_count: input.lessonBlocks.length, fallback_used: input.fallbackUsed },
    },
  ];

  return [...baseChecks, ...input.materialAlignmentChecks];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let startedAt = Date.now();
  let queueJobId: string | null = null;
  let supabaseAdmin: any = null;
  let activeTopicId: string | null = null;
  let activeMcpRunId: string | null = null;

  try {
    startedAt = Date.now();
    const body = await req.json();
    const { topic, country, grade, subject, moduleName, userId, referenceUrls, existingContext } = body;
    queueJobId = getRequestQueueJobId(body);

    if (!topic || !country || !grade || !subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: topic, country, grade, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for all DB writes — this bypasses RLS intentionally
    // SUPABASE_SERVICE_ROLE_KEY is auto-injected by Supabase into every edge function
    supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_KEY_0");
    const nvidiaKey = Deno.env.get("NVIDIA_API_KEY");

    if (!geminiKey && !nvidiaKey) {
      return new Response(
        JSON.stringify({ success: false, error: "No AI API key configured (GEMINI_API_KEY or NVIDIA_API_KEY)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate lesson ────────────────────────────────────────────────────────
    const topicContext = await resolveTopicContext(supabaseAdmin, {
      grade,
      subject,
      topic,
    });
    activeTopicId = topicContext?.topicId ?? null;
    const topicData = await fetchTopicData(supabaseAdmin, activeTopicId);
    if (topicData.ragChunks.length === 0 && topicData.outlines.length === 0) {
      const detailedError = [
        "Source grounding failed",
        `topic_id=${activeTopicId ?? "unresolved"}`,
        topicData.fallbackReason || "no usable topic-linked RAG and no approved topic_outlines",
        "Refusing to generate lesson from AI guesses.",
      ].join(": ");
      console.error("generate-lessons source grounding error:", detailedError);
      await writeGenerationLog(supabaseAdmin, {
        topicId: activeTopicId,
        blocksCount: 0,
        success: false,
        error: detailedError,
        durationMs: Date.now() - startedAt,
      });
      await saveQueueError(supabaseAdmin, queueJobId, detailedError);

      return new Response(
        JSON.stringify({ success: false, error: detailedError, topicId: activeTopicId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const materialRequirements = await fetchMaterialRequirements(supabaseAdmin, activeTopicId);
    const [mcpProfile, trustedSources] = await Promise.all([
      fetchMcpProfile(supabaseAdmin),
      fetchTrustedSources(supabaseAdmin),
    ]);
    const hasRagChunks = topicData.ragChunks.length > 0;
    const sourcePack = buildSourcePack(topicData, trustedSources);
    const materialPack = buildMaterialPack(materialRequirements);
    activeMcpRunId = await createMcpGenerationRun(supabaseAdmin, {
      topicId: activeTopicId,
      profileId: mcpProfile?.id ?? null,
      sourcePack,
      materialPack,
    });
    const sourceContext = [
      existingContext ? `Existing lessons for context:\n${existingContext}` : "",
      buildSourceContext(topicData),
      materialPack.length > 0 ? `Required materials:\n${materialPack.map((item) => `- ${item.material_type}: ${item.title || "untitled"} | required=${item.required} | purpose=${item.purpose || ""} | search=${item.search_query || ""}`).join("\n")}` : "No explicit topic_material_requirements were found.",
      mcpProfile ? `MCP profile: ${mcpProfile.code || "admin_heavy_curriculum_builder"}\n${mcpProfile.instructions || mcpProfile.description || ""}` : "",
    ].filter(Boolean).join("\n\n");

    const generation = await generateLesson({ topic, country, grade, subject, moduleName, referenceUrls, existingContext: sourceContext, geminiKey, nvidiaKey });
    let lesson = generation.lesson;
    let fallbackUsed = false;

    if (!lesson) {
      fallbackUsed = true;
      const reason = hasRagChunks
        ? `Block generation failed: ${generation.error || "AI returned empty or invalid JSON"}; fallback used`
        : `Block generation failed without linked RAG: ${generation.error || "AI returned empty or invalid JSON"}; using approved topic_outlines count=${topicData.outlines.length}`;
      console.warn(`generate-lessons fallback used for topic_id=${activeTopicId ?? "unresolved"}: ${reason}`);
      lesson = buildFallbackLessonFromOutlines(topicContext?.topicTitle ?? topic, topicData.outlines, reason);
    }

    // ── Persist to Supabase (service role — no RLS restriction) ───────────────
    const cycle = deriveCycleFromGrade(grade);
    let lessonBlocks = normalizeLessonBlocks(lesson.blocks);

    if (lessonBlocks.length === 0) {
      fallbackUsed = true;
      console.warn(`generate-lessons fallback used for topic_id=${activeTopicId ?? "unresolved"}: AI blocks empty or invalid; approved topic_outlines count=${topicData.outlines.length}`);
      lessonBlocks = buildFallbackBlocksFromOutlines(topicContext?.topicTitle ?? topic, topicData.outlines);
    }

    if (lessonBlocks.length === 0) {
      const detailedError = [
        "Block generation failed",
        `topic_id=${activeTopicId ?? "unresolved"}`,
        generation.error || "AI returned no valid lesson blocks and no approved topic_outlines could be used as fallback",
      ].join(": ");
      console.error("generate-lessons block generation error:", detailedError);
      await writeGenerationLog(supabaseAdmin, {
        topicId: topicContext?.topicId ?? null,
        blocksCount: 0,
        success: false,
        error: detailedError,
        durationMs: Date.now() - startedAt,
      });
      await saveQueueError(supabaseAdmin, queueJobId, detailedError);
      await updateMcpGenerationRun(supabaseAdmin, activeMcpRunId, {
        status: "failed",
        output_summary: { error: detailedError, phase: "block_generation" },
      });

      return new Response(
        JSON.stringify({ success: false, error: detailedError, topicId: activeTopicId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedContent = normalizeValue(lesson.content)
      || lessonBlocks.map((block) => block.content).join("\n\n");

    const alignment = validateMaterialAlignment(lessonBlocks, materialRequirements, []);
    const mcpQualityChecks = buildQualityChecks({
      lessonBlocks,
      topicData,
      materialRequirements,
      materialAlignmentChecks: alignment.checks,
      fallbackUsed,
      hasRagChunks,
      grade,
      lesson,
    });
    const qualityScore = fallbackUsed || !hasRagChunks ? 0.65 : 0.8;
    const sourceConfidence = fallbackUsed || !hasRagChunks ? 0.45 : 0.75;
    const sourceName = fallbackUsed || !hasRagChunks ? "topic_outlines" : "rag_chunks";
    const mcpQualityReport = {
      pipeline_type: "admin_heavy",
      checks: mcpQualityChecks,
      fallback_used: fallbackUsed,
      source_name: sourceName,
      material_request_count: alignment.materialRequests.length + materialPack.filter((item) => item.required !== false).length,
    };

    const { data: inserted, error: lessonErr } = await supabaseAdmin
      .from("lessons")
      .upsert({
        country,
        cycle,
        grade,
        subject,
        topic_id: topicContext?.topicId ?? null,
        lesson_title: lesson.lesson_title,
        content: normalizedContent,
        status: "draft",
        validation_status: "needs_review",
        quality_score: qualityScore,
        source_confidence: sourceConfidence,
        source_name: sourceName,
        generation_pipeline: "admin_heavy",
        mcp_profile_id: mcpProfile?.id ?? null,
        mcp_generation_run_id: activeMcpRunId,
        source_pack: sourcePack,
        material_pack: materialPack,
        mcp_quality_report: mcpQualityReport,
        exercises: lesson.exercises ?? [],
        quizzes: lesson.quizzes ?? [],
        mod: lesson.mod ?? null,
        exam: lesson.exam ?? null,
        author_id: userId ?? null,
        is_ai_generated: true,
        blocks: lessonBlocks,
      }, { onConflict: "topic_id,lesson_title" })
      .select("id")
      .single();

    if (lessonErr) {
      const detailedError = `save error: lessons upsert failed: ${formatDbError(lessonErr)}`;
      console.error("generate-lessons save error:", lessonErr);
      await writeGenerationLog(supabaseAdmin, {
        topicId: topicContext?.topicId ?? null,
        blocksCount: lessonBlocks.length,
        success: false,
        error: detailedError,
        durationMs: Date.now() - startedAt,
      });
      await saveQueueError(supabaseAdmin, queueJobId, detailedError);
      await updateMcpGenerationRun(supabaseAdmin, activeMcpRunId, {
        status: "failed",
        output_summary: { error: detailedError, phase: "lesson_upsert" },
      });

      return new Response(
        JSON.stringify({ success: false, error: detailedError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lessonId = inserted.id;

    try {
      await persistLessonBlocks(supabaseAdmin, lessonId, lessonBlocks);
    } catch (blockErr: any) {
      const detailedError = blockErr?.message || "lesson_blocks insert failed: unknown error";
      console.error("Failed to insert lesson blocks:", blockErr);
      await writeGenerationLog(supabaseAdmin, {
        lessonId,
        topicId: topicContext?.topicId ?? null,
        blocksCount: lessonBlocks.length,
        success: false,
        error: detailedError,
        durationMs: Date.now() - startedAt,
      });
      await saveQueueError(supabaseAdmin, queueJobId, detailedError);
      await updateMcpGenerationRun(supabaseAdmin, activeMcpRunId, {
        status: "failed",
        lesson_id: lessonId,
        output_summary: { error: detailedError, phase: "lesson_blocks" },
      });

      return new Response(
        JSON.stringify({ success: false, error: detailedError, lessonId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await insertSourceEvidence(supabaseAdmin, {
      lessonId,
      topicId: topicContext?.topicId ?? null,
      sourcePack,
    });
    await insertLessonMaterials(supabaseAdmin, {
      lessonId,
      topicId: topicContext?.topicId ?? null,
      materialPack,
      materialRequests: alignment.materialRequests,
    });
    await insertQualityChecks(supabaseAdmin, {
      lessonId,
      topicId: topicContext?.topicId ?? null,
      runId: activeMcpRunId,
      checks: mcpQualityChecks,
    });

    await writeGenerationLog(supabaseAdmin, {
      lessonId,
      topicId: topicContext?.topicId ?? null,
      blocksCount: lessonBlocks.length,
      success: true,
      error: null,
      durationMs: Date.now() - startedAt,
    });
    await saveQueueSuccess(supabaseAdmin, queueJobId);
    await updateMcpGenerationRun(supabaseAdmin, activeMcpRunId, {
      status: "needs_review",
      lesson_id: lessonId,
      output_summary: {
        lesson_id: lessonId,
        blocks_count: lessonBlocks.length,
        fallback_used: fallbackUsed,
        source_name: sourceName,
        source_confidence: sourceConfidence,
        quality_score: qualityScore,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        lessonId,
        blocksCount: lessonBlocks.length,
        fallbackUsed,
        sourceName,
        sourceConfidence,
        qualityScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const detailedError = err?.message || "generate-lessons unhandled error: unknown error";
    console.error("generate-lessons unhandled error:", err);

    if (supabaseAdmin) {
      await writeGenerationLog(supabaseAdmin, {
        topicId: activeTopicId,
        blocksCount: null,
        success: false,
        error: detailedError,
        durationMs: Date.now() - startedAt,
      });
      await saveQueueError(supabaseAdmin, queueJobId, detailedError);
      await updateMcpGenerationRun(supabaseAdmin, activeMcpRunId, {
        status: "failed",
        output_summary: { error: detailedError, phase: "unhandled" },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: detailedError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function generateLesson(params: {
  topic: string; country: string; grade: string; subject: string;
  moduleName?: string; referenceUrls?: string[]; existingContext?: string;
  geminiKey?: string; nvidiaKey?: string;
}): Promise<LessonGenerationResult> {
  const { topic, country, grade, subject, moduleName, referenceUrls, existingContext, geminiKey, nvidiaKey } = params;

  const prompt = buildMcpLessonPrompt(topic, country, grade, subject, moduleName, referenceUrls, existingContext);
  const errors: string[] = [];

  // Primary: Gemini
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: 5000 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = safeJsonParse(text);
          if (parsed) return { lesson: parsed, error: null };
          const reason = `Gemini JSON parse failure: response was not valid lesson JSON; excerpt=${text.slice(0, 240)}`;
          errors.push(reason);
          console.warn(reason);
        } else {
          const reason = "Gemini empty response: no candidate text returned";
          errors.push(reason);
          console.warn(reason);
        }
      } else {
        const reason = `Gemini request failed: status=${res.status} body=${(await res.text()).slice(0, 500)}`;
        errors.push(reason);
        console.warn(reason);
      }
    } catch (e) {
      const reason = `Gemini failed: ${formatThrownError(e)}`;
      errors.push(reason);
      console.warn(reason);
    }
  }

  // Fallback: NVIDIA NIM
  if (nvidiaKey) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nvidiaKey}` },
        body: JSON.stringify({
          model: "google/gemma-3-27b-it",
          messages: [{ role: "user", content: prompt + "\n\nRespond with valid JSON only." }],
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: "json_object" },
          stream: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          const parsed = safeJsonParse(text);
          if (parsed) return { lesson: parsed, error: null };
          const reason = `NVIDIA JSON parse failure: response was not valid lesson JSON; excerpt=${text.slice(0, 240)}`;
          errors.push(reason);
          console.warn(reason);
        } else {
          const reason = "NVIDIA empty response: no message content returned";
          errors.push(reason);
          console.warn(reason);
        }
      } else {
        const reason = `NVIDIA request failed: status=${res.status} body=${(await res.text()).slice(0, 500)}`;
        errors.push(reason);
        console.warn(reason);
      }
    } catch (e) {
      const reason = `NVIDIA fallback failed: ${formatThrownError(e)}`;
      errors.push(reason);
      console.warn(reason);
    }
  }

  return { lesson: null, error: errors.join(" | ") || "No model provider returned valid lesson JSON" };
}

function formatThrownError(error: unknown) {
  if (error instanceof Error) return [error.name, error.message].filter(Boolean).join(": ");
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function generateEmbedding(text: string, geminiKey?: string): Promise<number[]> {
  if (!geminiKey) return [];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "models/gemini-embedding-2-preview", content: { parts: [{ text }] } }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data?.embedding?.values ?? [];
  } catch {
    return [];
  }
}

function buildMcpLessonPrompt(topic: string, country: string, grade: string, subject: string, moduleName?: string, referenceUrls?: string[], existingContext?: string): string {
  return `You are an expert educational content creator for ${country}.
Generate a complete lesson for:
- Topic: ${topic}
- Country: ${country}
- Grade: ${grade}
- Subject: ${subject}${moduleName ? `\n- Module: ${moduleName}` : ""}${existingContext ? `\n\nExisting lessons for context:\n${existingContext}` : ""}${referenceUrls?.length ? `\n\nReference URLs: ${referenceUrls.join(", ")}` : ""}

Adapt to the exact grade above. Do not assume the learner is a Bac student unless the grade explicitly says Bac. Adjust vocabulary, pacing, examples, exercises, and exam style for primary, college, Tronc Commun, 1ere Bac, or 2eme Bac as appropriate.

Return ONLY valid JSON matching this exact schema:
{
  "lesson_title": "string",
  "content": "string (markdown, min 300 words)",
  "blocks": [{"type": "text|example|formula|summary", "content": "string"}],
  "exercises": [{"question": "string", "solution": "string"}],
  "quizzes": [{"question": "string", "options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "string"}],
  "exam": {"question": "string", "hint": "string", "solution": "string"}
}`;
}

function safeJsonParse(text: string): any | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}
