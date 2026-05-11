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
  content?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TopicData = {
  outlines: TopicOutlineInput[];
  ragChunks: RagChunkInput[];
};

async function fetchTopicOutlines(supabaseAdmin: any, topicId: string | null): Promise<TopicOutlineInput[]> {
  if (!topicId) return [];

  const { data, error } = await supabaseAdmin
    .from("topic_outlines")
    .select("title, description, outline_order")
    .eq("topic_id", topicId)
    .order("outline_order", { ascending: true });

  if (error) throw new Error(`topic_outlines lookup failed: ${formatDbError(error)}`);
  return (data || []) as TopicOutlineInput[];
}

async function fetchTopicData(supabaseAdmin: any, topicId: string | null): Promise<TopicData> {
  const outlines = await fetchTopicOutlines(supabaseAdmin, topicId);
  if (!topicId) {
    console.warn("generate-lessons source fallback: no resolved topic_id; cannot fetch rag_chunks");
    return { outlines, ragChunks: [] };
  }

  const { data, error } = await supabaseAdmin
    .from("rag_chunks")
    .select("content, source_name, source_url, metadata")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(`rag_chunks lookup by topic_id failed: ${formatDbError(error)}`);

  const ragChunks = ((data || []) as RagChunkInput[]).filter((chunk) => normalizeValue(chunk.content).length > 0);
  if (ragChunks.length === 0) {
    console.warn(`generate-lessons source fallback: no rag_chunks for topic_id=${topicId}; using topic_outlines count=${outlines.length}`);
  }

  return { outlines, ragChunks };
}

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

  return "No RAG chunks or topic_outlines were found for this topic. Generate a cautious draft using the exact grade, country, subject, and topic only.";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let startedAt = Date.now();
  let queueJobId: string | null = null;
  let supabaseAdmin: any = null;
  let activeTopicId: string | null = null;

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

    const geminiKey = Deno.env.get("GEMINI_KEY_0");
    const nvidiaKey = Deno.env.get("NVIDIA_API_KEY");

    if (!geminiKey && !nvidiaKey) {
      return new Response(
        JSON.stringify({ success: false, error: "No AI API key configured (GEMINI_KEY_0 or NVIDIA_API_KEY)" }),
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
    const hasRagChunks = topicData.ragChunks.length > 0;
    const sourceName = hasRagChunks ? "rag_chunks" : "topic_outlines";
    const sourceContext = [
      existingContext ? `Existing lessons for context:\n${existingContext}` : "",
      buildSourceContext(topicData),
    ].filter(Boolean).join("\n\n");

    let lesson = await generateLesson({ topic, country, grade, subject, moduleName, referenceUrls, existingContext: sourceContext, geminiKey, nvidiaKey });
    let fallbackUsed = false;

    if (!lesson) {
      fallbackUsed = true;
      const reason = hasRagChunks
        ? "JSON parse failure: AI returned empty or invalid JSON; fallback used"
        : "Block generation fallback used: no chunks and AI returned empty or invalid JSON";
      console.warn(`generate-lessons fallback used for topic_id=${activeTopicId ?? "unresolved"}: ${reason}`);
      lesson = buildFallbackLessonFromOutlines(topicContext?.topicTitle ?? topic, topicData.outlines, reason);
    }

    // ── Persist to Supabase (service role — no RLS restriction) ───────────────
    const cycle = deriveCycleFromGrade(grade);
    let lessonBlocks = normalizeLessonBlocks(lesson.blocks);

    if (lessonBlocks.length === 0) {
      fallbackUsed = true;
      console.warn(`generate-lessons fallback used for topic_id=${activeTopicId ?? "unresolved"}: AI blocks empty or invalid; using topic_outlines count=${topicData.outlines.length}`);
      lessonBlocks = buildFallbackBlocksFromOutlines(topicContext?.topicTitle ?? topic, topicData.outlines);
    }

    const normalizedContent = normalizeValue(lesson.content)
      || lessonBlocks.map((block) => block.content).join("\n\n");

    const qualityScore = fallbackUsed || !hasRagChunks ? 0.65 : 0.85;
    const sourceConfidence = hasRagChunks ? 0.75 : 0.45;

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

      return new Response(
        JSON.stringify({ success: false, error: detailedError, lessonId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Index content chunks into rag_chunks (service role) ───────────────────
    if (normalizedContent) {
      const chunks = normalizedContent.split("\n\n").filter((c: string) => c.trim().length > 50);
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk, geminiKey);
        if (embedding.length > 0) {
          const { error: chunkErr } = await supabaseAdmin.from("rag_chunks").insert({
            source_id: lessonId,
            source_type: "lesson_block",
            lesson_id: lessonId,
            topic_id: topicContext?.topicId ?? null,
            grade_id: topicContext?.gradeId ?? null,
            content: chunk,
            embedding,
            source_name: "generated_lesson",
            source_confidence: sourceConfidence,
            metadata: {
              user_id: userId ?? null,
              subject,
              grade,
              country,
              topic,
              topic_id: topicContext?.topicId ?? null,
              grade_id: topicContext?.gradeId ?? null,
              subject_id: topicContext?.subjectId ?? null,
              lesson_id: lessonId,
            },
          });
          if (chunkErr) console.error("rag_chunks insert error:", chunkErr);
        }
      }
    }

    await writeGenerationLog(supabaseAdmin, {
      lessonId,
      topicId: topicContext?.topicId ?? null,
      blocksCount: lessonBlocks.length,
      success: true,
      error: null,
      durationMs: Date.now() - startedAt,
    });
    await saveQueueSuccess(supabaseAdmin, queueJobId);

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
}): Promise<any | null> {
  const { topic, country, grade, subject, moduleName, referenceUrls, existingContext, geminiKey, nvidiaKey } = params;

  const prompt = buildPrompt(topic, country, grade, subject, moduleName, referenceUrls, existingContext);

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
          if (parsed) return parsed;
          console.warn("Gemini JSON parse failure: response was not valid lesson JSON");
        } else {
          console.warn("Gemini empty response: no candidate text returned");
        }
      } else {
        console.warn(`Gemini request failed: status=${res.status} body=${await res.text()}`);
      }
    } catch (e) {
      console.warn("Gemini failed:", e);
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
          if (parsed) return parsed;
          console.warn("NVIDIA JSON parse failure: response was not valid lesson JSON");
        } else {
          console.warn("NVIDIA empty response: no message content returned");
        }
      } else {
        console.warn(`NVIDIA request failed: status=${res.status} body=${await res.text()}`);
      }
    } catch (e) {
      console.warn("NVIDIA fallback failed:", e);
    }
  }

  return null;
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

function buildPrompt(topic: string, country: string, grade: string, subject: string, moduleName?: string, referenceUrls?: string[], existingContext?: string): string {
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
