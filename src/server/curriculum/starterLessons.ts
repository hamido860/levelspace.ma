type SupabaseLike = {
  from: (table: string) => any;
};

type NestedRow<T> = T | T[] | null | undefined;

export interface StarterLessonSeedOptions {
  topicIds?: string[];
  commit?: boolean;
}

export interface StarterLessonSeedSummary {
  scannedTopics: number;
  existingLessons: number;
  insertedLessons: number;
  skippedLessons: number;
  dryRun: boolean;
  inserted: Array<{ topic_id: string; lesson_title: string; grade: string; subject: string }>;
  skipped: Array<{ topic_id: string; title: string; reason: string }>;
}

type TopicRow = {
  id: string;
  title: string | null;
  grades?: NestedRow<{
    name?: string | null;
    cycles?: NestedRow<{ name?: string | null }>;
  }>;
  subjects?: NestedRow<{ name?: string | null }>;
};

const first = <T>(value: NestedRow<T>): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const clean = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");

const buildStarterContent = (topicTitle: string, grade: string, subject: string) =>
  [
    `# ${topicTitle}`,
    "",
    "Starter lesson shell created from the trusted curriculum topic list.",
    "",
    `Grade: ${grade || "Unspecified"}`,
    `Subject: ${subject || "Unspecified"}`,
    "",
    "This is not a final lesson. A teacher or curriculum admin must add reviewed instructional content before student use or RAG embedding.",
  ].join("\n");

export async function seedStarterLessonsFromTopics(
  supabase: SupabaseLike,
  options: StarterLessonSeedOptions = {},
): Promise<StarterLessonSeedSummary> {
  const topicIds = Array.from(new Set((options.topicIds || []).map(clean).filter(Boolean)));
  let topicQuery = supabase
    .from("topics")
    .select("id, title, grades(name, cycles(name)), subjects(name)")
    .order("title", { ascending: true });

  if (topicIds.length > 0) {
    topicQuery = topicQuery.in("id", topicIds);
  }

  const { data: topics, error: topicsError } = await topicQuery;
  if (topicsError) throw topicsError;

  const topicRows = (topics || []) as TopicRow[];
  const allTopicIds = topicRows.map((topic) => topic.id).filter(Boolean);
  const existingTopicIds = new Set<string>();

  for (let start = 0; start < allTopicIds.length; start += 100) {
    const batch = allTopicIds.slice(start, start + 100);
    if (batch.length === 0) continue;

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("topic_id")
      .in("topic_id", batch);

    if (lessonsError) throw lessonsError;
    for (const lesson of lessons || []) {
      if (lesson.topic_id) existingTopicIds.add(lesson.topic_id);
    }
  }

  const rowsToInsert: any[] = [];
  const inserted: StarterLessonSeedSummary["inserted"] = [];
  const skipped: StarterLessonSeedSummary["skipped"] = [];

  for (const topic of topicRows) {
    const topicTitle = clean(topic.title);
    if (!topic.id || !topicTitle) {
      skipped.push({ topic_id: topic.id || "", title: topicTitle, reason: "missing topic id or title" });
      continue;
    }

    if (existingTopicIds.has(topic.id)) {
      skipped.push({ topic_id: topic.id, title: topicTitle, reason: "lesson already exists for topic_id" });
      continue;
    }

    const grade = clean(first(topic.grades)?.name) || "Unknown grade";
    const subject = clean(first(topic.subjects)?.name) || "Unknown subject";
    const cycle = clean(first(first(topic.grades)?.cycles)?.name) || "Unknown cycle";

    rowsToInsert.push({
      country: "Morocco",
      cycle,
      grade,
      subject,
      lesson_title: topicTitle,
      content: buildStarterContent(topicTitle, grade, subject),
      topic_id: topic.id,
      is_ai_generated: false,
      tags: ["starter", "needs_review"],
      teaching_contract: {
        status: "needs_review",
        student_publish_allowed: false,
        rag_embedding_allowed: false,
        source: "topic_starter_seed",
      },
      status: "draft",
    });

    inserted.push({ topic_id: topic.id, lesson_title: topicTitle, grade, subject });
  }

  if (options.commit && rowsToInsert.length > 0) {
    for (let start = 0; start < rowsToInsert.length; start += 100) {
      const batch = rowsToInsert.slice(start, start + 100);
      const { error: insertError } = await supabase.from("lessons").insert(batch);
      if (insertError) throw insertError;
    }
  }

  return {
    scannedTopics: topicRows.length,
    existingLessons: existingTopicIds.size,
    insertedLessons: options.commit ? rowsToInsert.length : 0,
    skippedLessons: skipped.length,
    dryRun: !options.commit,
    inserted,
    skipped,
  };
}
