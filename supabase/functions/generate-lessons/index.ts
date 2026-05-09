import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { topic, country, grade, subject, moduleName, userId, referenceUrls, existingContext } = body;

    if (!topic || !country || !grade || !subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: topic, country, grade, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for all DB writes — this bypasses RLS intentionally
    // SUPABASE_SERVICE_ROLE_KEY is auto-injected by Supabase into every edge function
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const geminiKey = Deno.env.get("GEMINI_KEY_0");
    const nvidiaKey = Deno.env.get("NVIDIA_API_KEY");

    if (!geminiKey && !nvidiaKey) {
      return new Response(
        JSON.stringify({ success: false, error: "No AI API key configured (GEMINI_KEY_0 or NVIDIA_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate lesson ────────────────────────────────────────────────────────
    const lesson = await generateLesson({ topic, country, grade, subject, moduleName, referenceUrls, existingContext, geminiKey, nvidiaKey });

    if (!lesson) {
      return new Response(
        JSON.stringify({ success: false, error: "Block generation failed: AI returned no content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Persist to Supabase (service role — no RLS restriction) ───────────────
    const topicContext = await resolveTopicContext(supabaseAdmin, {
      grade,
      subject,
      topic,
      lessonTitle: lesson.lesson_title,
    });
    const cycle = deriveCycleFromGrade(grade);

    const { data: inserted, error: lessonErr } = await supabaseAdmin
      .from("lessons")
      .insert({
        country,
        cycle,
        grade,
        subject,
        topic_id: topicContext?.topicId ?? null,
        lesson_title: lesson.lesson_title,
        content: lesson.content,
        exercises: lesson.exercises ?? [],
        quizzes: lesson.quizzes ?? [],
        mod: lesson.mod ?? null,
        exam: lesson.exam ?? null,
        author_id: userId ?? null,
        is_ai_generated: true,
      })
      .select("id")
      .single();

    if (lessonErr) {
      console.error("Failed to insert lesson:", lessonErr);
      return new Response(
        JSON.stringify({ success: false, error: "Block generation failed: DB insert error", detail: lessonErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lessonId = inserted.id;

    // ── Index content chunks into rag_chunks (service role) ───────────────────
    if (lesson.content) {
      const chunks = lesson.content.split("\n\n").filter((c: string) => c.trim().length > 50);
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk, geminiKey);
        if (embedding.length > 0) {
          const { error: chunkErr } = await supabaseAdmin.from("rag_chunks").insert({
            source_id: lessonId,
            source_type: "lesson_block",
            content: chunk,
            embedding,
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

    return new Response(
      JSON.stringify({ success: true, lessonId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-lessons unhandled error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        if (text) return safeJsonParse(text);
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
        if (text) return safeJsonParse(text);
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

Return ONLY valid JSON matching this exact schema:
{
  "lesson_title": "string",
  "content": "string (markdown, min 300 words)",
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
