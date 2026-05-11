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

type ExistingLessonRow = {
  topic_id?: string | null;
  lesson_title?: string | null;
  title?: string | null;
};

const OPTIONAL_LESSON_INSERT_COLUMNS = [
  "teaching_contract",
  "status",
  "tags",
  "is_ai_generated",
  "topic_id",
  "blocks",
  "subtitle",
] as const;

const first = <T>(value: NestedRow<T>): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const clean = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");
const normalizeKey = (value: unknown) => clean(value).toLocaleLowerCase();

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

const getMissingColumnName = (error: unknown) => {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "");
  if (code !== "42703" && !/column .* does not exist|could not find .* column/i.test(message)) return null;

  return OPTIONAL_LESSON_INSERT_COLUMNS.find((column) => message.toLowerCase().includes(column.toLowerCase())) || null;
};

const isMissingColumnError = (error: unknown, column?: string) => {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
  if (code !== "42703" && !/column .* does not exist|could not find .* column/i.test(message)) return false;
  return column ? message.includes(column.toLowerCase()) : true;
};

const isMissingRelationshipError = (error: unknown) => {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String((error as { message?: string } | null)?.message || "").toLowerCase();
  return code === "PGRST200" || /relationship|schema cache|foreign key/i.test(message);
};

const withoutColumn = (rows: any[], column: string) =>
  rows.map((row) => {
    const next = { ...row };
    delete next[column];
    return next;
  });

const insertStarterLessonBatch = async (supabase: SupabaseLike, rows: any[]) => {
  let remainingRows = rows;
  const strippedColumns = new Set<string>();

  for (let attempt = 0; attempt <= OPTIONAL_LESSON_INSERT_COLUMNS.length; attempt += 1) {
    const { error } = await supabase.from("lessons").insert(remainingRows);
    if (!error) return;

    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || strippedColumns.has(missingColumn)) {
      throw error;
    }

    strippedColumns.add(missingColumn);
    remainingRows = withoutColumn(remainingRows, missingColumn);
  }
};

const fetchTopicRows = async (supabase: SupabaseLike, topicIds: string[]) => {
  const applyTopicFilter = (query: any) => (topicIds.length > 0 ? query.in("id", topicIds) : query);

  let richTopicQuery = applyTopicFilter(
    supabase
      .from("topics")
      .select("id, title, grades(name, cycles(name)), subjects(name)")
      .order("title", { ascending: true }),
  );

  const richResult = await richTopicQuery;
  if (!richResult.error) return (richResult.data || []) as TopicRow[];

  if (!isMissingRelationshipError(richResult.error)) {
    throw richResult.error;
  }

  let fallbackTopicQuery = applyTopicFilter(
    supabase
      .from("topics")
      .select("id, title")
      .order("title", { ascending: true }),
  );
  const fallbackResult = await fallbackTopicQuery;
  if (fallbackResult.error) throw fallbackResult.error;

  return (fallbackResult.data || []) as TopicRow[];
};

const fetchExistingLessonRows = async (supabase: SupabaseLike, topicIds: string[]) => {
  const existingTopicIds = new Set<string>();
  const existingTitleKeys = new Set<string>();

  for (let start = 0; start < topicIds.length; start += 100) {
    const batch = topicIds.slice(start, start + 100);
    if (batch.length === 0) continue;

    const byTopic = await supabase
      .from("lessons")
      .select("topic_id, lesson_title, title")
      .in("topic_id", batch);

    if (!byTopic.error) {
      for (const lesson of (byTopic.data || []) as ExistingLessonRow[]) {
        if (lesson.topic_id) existingTopicIds.add(lesson.topic_id);
        const titleKey = normalizeKey(lesson.lesson_title || lesson.title);
        if (titleKey) existingTitleKeys.add(titleKey);
      }
      continue;
    }

    if (!isMissingColumnError(byTopic.error, "topic_id")) {
      throw byTopic.error;
    }

    const byTitle = await supabase
      .from("lessons")
      .select("lesson_title, title");

    if (byTitle.error) {
      if (isMissingColumnError(byTitle.error, "title")) {
        const legacyByTitle = await supabase.from("lessons").select("lesson_title");
        if (legacyByTitle.error) throw legacyByTitle.error;
        for (const lesson of (legacyByTitle.data || []) as ExistingLessonRow[]) {
          const titleKey = normalizeKey(lesson.lesson_title);
          if (titleKey) existingTitleKeys.add(titleKey);
        }
        continue;
      }

      throw byTitle.error;
    }

    for (const lesson of (byTitle.data || []) as ExistingLessonRow[]) {
      const titleKey = normalizeKey(lesson.lesson_title || lesson.title);
      if (titleKey) existingTitleKeys.add(titleKey);
    }
  }

  return { existingTopicIds, existingTitleKeys };
};

export async function seedStarterLessonsFromTopics(
  supabase: SupabaseLike,
  options: StarterLessonSeedOptions = {},
): Promise<StarterLessonSeedSummary> {
  const topicIds = Array.from(new Set((options.topicIds || []).map(clean).filter(Boolean)));
  const topicRows = await fetchTopicRows(supabase, topicIds);
  const allTopicIds = topicRows.map((topic) => topic.id).filter(Boolean);
  const { existingTopicIds, existingTitleKeys } = await fetchExistingLessonRows(supabase, allTopicIds);

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

    if (existingTitleKeys.has(normalizeKey(topicTitle))) {
      skipped.push({ topic_id: topic.id, title: topicTitle, reason: "lesson already exists for title" });
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
      await insertStarterLessonBatch(supabase, batch);
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
