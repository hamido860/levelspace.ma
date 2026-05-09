import type { SupabaseClient } from "@supabase/supabase-js";

type TopicSyncClient = Pick<SupabaseClient<any>, "from">;

type LessonTopicSeed = {
  grade?: string | null;
  subject?: string | null;
  lesson_title?: string | null;
  title?: string | null;
};

type TopicRow = {
  id: string;
  grade_id: string;
  subject_id: string;
  title: string | null;
};

type LookupRow = {
  id: string;
  name: string | null;
};

type TopicResolutionSkipReason =
  "missing_grade"
  | "missing_subject"
  | "missing_title"
  | "missing_grade_mapping"
  | "missing_subject_mapping";

export type TopicResolutionResult =
  | {
      status: "linked" | "created";
      topicId: string;
      topicTitle: string;
      gradeId: string;
      subjectId: string;
    }
  | {
      status: "skipped";
      reason: TopicResolutionSkipReason;
    };

export type TopicRepairSummary = {
  scannedLessons: number;
  lessonsAlreadyLinked: number;
  lessonsLinked: number;
  topicsCreated: number;
  skippedMissingGrade: number;
  skippedMissingSubject: number;
  skippedMissingTitle: number;
  skippedMissingGradeMapping: number;
  skippedMissingSubjectMapping: number;
  unresolvedLessons: Array<{
    lesson_id: string;
    grade: string | null;
    subject: string | null;
    title: string | null;
    reason: TopicResolutionSkipReason;
  }>;
};

const normalizeValue = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const makeKey = (value: string | null | undefined) => normalizeValue(value).toLocaleLowerCase();

export const getCanonicalLessonTitle = (lesson: LessonTopicSeed) => {
  const lessonTitle = normalizeValue(lesson.lesson_title);
  if (lessonTitle) return lessonTitle;
  const fallbackTitle = normalizeValue(lesson.title);
  return fallbackTitle || null;
};

async function loadLookupByName(
  supabase: TopicSyncClient,
  table: "grades" | "subjects",
  value: string,
): Promise<LookupRow | null> {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .ilike("name", normalized)
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data || [])[0] as LookupRow | undefined) || null;
}

async function loadExistingTopic(
  supabase: TopicSyncClient,
  gradeId: string,
  subjectId: string,
  title: string,
): Promise<TopicRow | null> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, grade_id, subject_id, title")
    .eq("grade_id", gradeId)
    .eq("subject_id", subjectId)
    .ilike("title", title)
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data || [])[0] as TopicRow | undefined) || null;
}

async function createTopic(
  supabase: TopicSyncClient,
  gradeId: string,
  subjectId: string,
  title: string,
): Promise<TopicRow> {
  const { data, error } = await supabase
    .from("topics")
    .insert({
      grade_id: gradeId,
      subject_id: subjectId,
      title,
    })
    .select("id, grade_id, subject_id, title")
    .single();

  if (error) {
    throw error;
  }

  return data as TopicRow;
}

export async function resolveTopicForLesson(
  supabase: TopicSyncClient,
  lesson: LessonTopicSeed,
  options: { createIfMissing?: boolean } = {},
): Promise<TopicResolutionResult> {
  const grade = normalizeValue(lesson.grade);
  if (!grade) {
    return { status: "skipped", reason: "missing_grade" };
  }

  const subject = normalizeValue(lesson.subject);
  if (!subject) {
    return { status: "skipped", reason: "missing_subject" };
  }

  const topicTitle = getCanonicalLessonTitle(lesson);
  if (!topicTitle) {
    return { status: "skipped", reason: "missing_title" };
  }

  const gradeRow = await loadLookupByName(supabase, "grades", grade);
  if (!gradeRow?.id) {
    return { status: "skipped", reason: "missing_grade_mapping" };
  }

  const subjectRow = await loadLookupByName(supabase, "subjects", subject);
  if (!subjectRow?.id) {
    return { status: "skipped", reason: "missing_subject_mapping" };
  }

  const existingTopic = await loadExistingTopic(supabase, gradeRow.id, subjectRow.id, topicTitle);
  if (existingTopic?.id) {
    return {
      status: "linked",
      topicId: existingTopic.id,
      topicTitle,
      gradeId: gradeRow.id,
      subjectId: subjectRow.id,
    };
  }

  if (!options.createIfMissing) {
    return { status: "skipped", reason: "missing_title" };
  }

  const createdTopic = await createTopic(supabase, gradeRow.id, subjectRow.id, topicTitle);
  return {
    status: "created",
    topicId: createdTopic.id,
    topicTitle,
    gradeId: gradeRow.id,
    subjectId: subjectRow.id,
  };
}

export async function backfillTopicsFromLessons(supabase: TopicSyncClient): Promise<TopicRepairSummary> {
  const [{ data: lessons, error: lessonsError }, { data: grades, error: gradesError }, { data: subjects, error: subjectsError }, { data: topics, error: topicsError }] =
    await Promise.all([
      supabase.from("lessons").select("id, grade, subject, lesson_title, title, topic_id"),
      supabase.from("grades").select("id, name"),
      supabase.from("subjects").select("id, name"),
      supabase.from("topics").select("id, grade_id, subject_id, title"),
    ]);

  if (lessonsError) throw lessonsError;
  if (gradesError) throw gradesError;
  if (subjectsError) throw subjectsError;
  if (topicsError) throw topicsError;

  const gradeMap = new Map<string, string>();
  for (const grade of (grades || []) as LookupRow[]) {
    const key = makeKey(grade.name);
    if (key && !gradeMap.has(key)) {
      gradeMap.set(key, grade.id);
    }
  }

  const subjectMap = new Map<string, string>();
  for (const subject of (subjects || []) as LookupRow[]) {
    const key = makeKey(subject.name);
    if (key && !subjectMap.has(key)) {
      subjectMap.set(key, subject.id);
    }
  }

  const topicMap = new Map<string, string>();
  for (const topic of (topics || []) as TopicRow[]) {
    const key = `${topic.grade_id}::${topic.subject_id}::${makeKey(topic.title)}`;
    if (!topicMap.has(key)) {
      topicMap.set(key, topic.id);
    }
  }

  const summary: TopicRepairSummary = {
    scannedLessons: (lessons || []).length,
    lessonsAlreadyLinked: 0,
    lessonsLinked: 0,
    topicsCreated: 0,
    skippedMissingGrade: 0,
    skippedMissingSubject: 0,
    skippedMissingTitle: 0,
    skippedMissingGradeMapping: 0,
    skippedMissingSubjectMapping: 0,
    unresolvedLessons: [],
  };

  for (const lesson of (lessons || []) as Array<Record<string, unknown>>) {
    if (lesson.topic_id) {
      summary.lessonsAlreadyLinked += 1;
      continue;
    }

    const lessonId = String(lesson.id || "");
    const grade = normalizeValue(typeof lesson.grade === "string" ? lesson.grade : null);
    const subject = normalizeValue(typeof lesson.subject === "string" ? lesson.subject : null);
    const topicTitle = getCanonicalLessonTitle({
      lesson_title: typeof lesson.lesson_title === "string" ? lesson.lesson_title : null,
      title: typeof lesson.title === "string" ? lesson.title : null,
    });

    if (!grade) {
      summary.skippedMissingGrade += 1;
      summary.unresolvedLessons.push({ lesson_id: lessonId, grade: null, subject: subject || null, title: topicTitle, reason: "missing_grade" });
      continue;
    }

    if (!subject) {
      summary.skippedMissingSubject += 1;
      summary.unresolvedLessons.push({ lesson_id: lessonId, grade, subject: null, title: topicTitle, reason: "missing_subject" });
      continue;
    }

    if (!topicTitle) {
      summary.skippedMissingTitle += 1;
      summary.unresolvedLessons.push({ lesson_id: lessonId, grade, subject, title: null, reason: "missing_title" });
      continue;
    }

    const gradeId = gradeMap.get(makeKey(grade));
    if (!gradeId) {
      summary.skippedMissingGradeMapping += 1;
      summary.unresolvedLessons.push({ lesson_id: lessonId, grade, subject, title: topicTitle, reason: "missing_grade_mapping" });
      continue;
    }

    const subjectId = subjectMap.get(makeKey(subject));
    if (!subjectId) {
      summary.skippedMissingSubjectMapping += 1;
      summary.unresolvedLessons.push({ lesson_id: lessonId, grade, subject, title: topicTitle, reason: "missing_subject_mapping" });
      continue;
    }

    const topicKey = `${gradeId}::${subjectId}::${makeKey(topicTitle)}`;
    let topicId = topicMap.get(topicKey) || null;

    if (!topicId) {
      const createdTopic = await createTopic(supabase, gradeId, subjectId, topicTitle);
      topicId = createdTopic.id;
      topicMap.set(topicKey, topicId);
      summary.topicsCreated += 1;
    }

    const { error: updateError } = await supabase
      .from("lessons")
      .update({ topic_id: topicId })
      .eq("id", lessonId);

    if (updateError) {
      throw updateError;
    }

    summary.lessonsLinked += 1;
  }

  return summary;
}
