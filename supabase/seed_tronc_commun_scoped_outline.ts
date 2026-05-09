import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CURRICULUM_DB, type CurriculumEntry } from "../src/mcp/curriculum";

type GradeRow = {
  id: string;
  name: string;
};

type SubjectRow = {
  id: string;
  name: string;
};

type TopicRow = {
  id: string;
  grade_id: string;
  subject_id: string;
  title: string;
};

type LessonRow = {
  id: string;
  topic_id: string | null;
  subject: string | null;
  lesson_title: string | null;
};

type OutlineIssue = {
  source: string;
  grade: string;
  subject: string;
  officialRef: string;
  reason: string;
};

const TARGET_COUNTRY = "Morocco";
const TARGET_GRADE_NAMES = ["Tronc Commun", "Tronc Commun Scientifique"] as const;
const RESOLVED_GRADE_NAME = "Tronc Commun";
const TARGET_SUBJECT_ALIASES = {
  "Physique-Chimie": ["Physique-Chimie"],
  "Sciences de la Vie et de la Terre (SVT)": ["SVT", "Sciences de la Vie et de la Terre (SVT)"],
} as const;

const normalize = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const readEnv = () => {
  const envPath = path.join(process.cwd(), ".env");
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter(Boolean);

  return Object.fromEntries(
    lines.map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
    }),
  );
};

const buildClient = () => {
  const env = readEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SR_KEY || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const canWrite = Boolean(serviceRoleKey);

  return {
    canWrite,
    client: createClient(supabaseUrl, canWrite ? serviceRoleKey : anonKey),
  };
};

const getTargetSubjectNames = () => Object.keys(TARGET_SUBJECT_ALIASES);

const isTargetGrade = (grade: string) =>
  TARGET_GRADE_NAMES.some((candidate) => normalize(candidate) === normalize(grade));

const resolveTargetSubjectName = (subject: string) => {
  const normalizedSubject = normalize(subject);

  for (const [canonical, aliases] of Object.entries(TARGET_SUBJECT_ALIASES)) {
    if ([canonical, ...aliases].some((alias) => normalize(alias) === normalizedSubject)) {
      return canonical;
    }
  }

  return null;
};

const getScopedOutlineEntries = () => {
  const exactMatches: Array<{ canonicalSubject: string; entry: CurriculumEntry }> = [];
  const unmatchedOutlineEntries: OutlineIssue[] = [];
  const outOfScopeOutlineEntries: OutlineIssue[] = [];

  for (const entry of CURRICULUM_DB) {
    if (normalize(entry.country) !== normalize(TARGET_COUNTRY)) continue;

    const canonicalSubject = resolveTargetSubjectName(entry.subject);
    if (!canonicalSubject) {
      if (isTargetGrade(entry.grade)) {
        outOfScopeOutlineEntries.push({
          source: "src/mcp/curriculum.ts",
          grade: entry.grade,
          subject: entry.subject,
          officialRef: entry.officialRef,
          reason: "Subject is outside the requested Physique-Chimie / SVT scope.",
        });
      }
      continue;
    }

    if (!isTargetGrade(entry.grade)) {
      unmatchedOutlineEntries.push({
        source: "src/mcp/curriculum.ts",
        grade: entry.grade,
        subject: entry.subject,
        officialRef: entry.officialRef,
        reason: "Trusted outline exists for this subject, but the grade is outside the Tronc Commun scope.",
      });
      continue;
    }

    exactMatches.push({ canonicalSubject, entry });
  }

  return {
    exactMatches,
    unmatchedOutlineEntries,
    outOfScopeOutlineEntries,
  };
};

const lessonSupportsTrustedSource = async (client: SupabaseClient) => {
  const { error } = await client.from("lessons").select("trusted_source").limit(1);
  if (!error) return true;
  return String((error as { code?: string }).code || "") !== "42703";
};

const buildStarterContent = (entry: CurriculumEntry, topicTitle: string) =>
  [
    `Seeded from trusted local outline: ${entry.officialRef}.`,
    `Subject: ${entry.subject}.`,
    `Grade scope in outline: ${entry.grade}.`,
    `Topic: ${topicTitle}.`,
    "This starter lesson is a trusted structural placeholder and awaits fuller validated lesson content.",
  ].join(" ");

async function main() {
  const { client, canWrite } = buildClient();

  const [gradesRes, subjectsRes] = await Promise.all([
    client.from("grades").select("id, name").in("name", [...TARGET_GRADE_NAMES]),
    client.from("subjects").select("id, name").in("name", getTargetSubjectNames()),
  ]);

  if (gradesRes.error) throw gradesRes.error;
  if (subjectsRes.error) throw subjectsRes.error;

  const grades = (gradesRes.data || []) as GradeRow[];
  const subjects = (subjectsRes.data || []) as SubjectRow[];

  const resolvedGrade = grades.find((grade) => grade.name === RESOLVED_GRADE_NAME) || null;
  if (!resolvedGrade) {
    throw new Error(`Could not resolve grade_id for ${RESOLVED_GRADE_NAME}.`);
  }

  const subjectByCanonicalName = new Map<string, SubjectRow>();
  for (const subject of subjects) {
    subjectByCanonicalName.set(subject.name, subject);
  }

  const [gradeSubjectsRes, topicsRes, lessonsRes] = await Promise.all([
    client
      .from("grade_subjects")
      .select("grade_id, subject_id")
      .eq("grade_id", resolvedGrade.id)
      .in("subject_id", subjects.map((subject) => subject.id)),
    client
      .from("topics")
      .select("id, grade_id, subject_id, title")
      .eq("grade_id", resolvedGrade.id)
      .in("subject_id", subjects.map((subject) => subject.id)),
    client
      .from("lessons")
      .select("id, topic_id, subject, lesson_title")
      .eq("grade", resolvedGrade.name)
      .in("subject", subjects.map((subject) => subject.name)),
  ]);

  if (gradeSubjectsRes.error) throw gradeSubjectsRes.error;
  if (topicsRes.error) throw topicsRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const gradeSubjects = gradeSubjectsRes.data || [];
  const existingTopics = (topicsRes.data || []) as TopicRow[];
  const existingLessons = (lessonsRes.data || []) as LessonRow[];

  const { exactMatches, unmatchedOutlineEntries, outOfScopeOutlineEntries } = getScopedOutlineEntries();
  const unmatchedIssues = [...unmatchedOutlineEntries, ...outOfScopeOutlineEntries];

  let insertedTopicsCount = 0;
  let skippedTopicsCount = 0;
  let insertedLessonsCount = 0;
  let skippedLessonsCount = 0;

  if (exactMatches.length > 0 && !canWrite) {
    throw new Error("Trusted outline rows are available, but this environment has no service-role key to write them safely.");
  }

  const supportsTrustedSource = exactMatches.length > 0 ? await lessonSupportsTrustedSource(client) : false;
  const topicKeyToRow = new Map(existingTopics.map((topic) => [`${topic.subject_id}::${normalize(topic.title)}`, topic]));
  const lessonKeySet = new Set(
    existingLessons.map((lesson) => `${lesson.topic_id || ""}::${normalize(lesson.lesson_title)}`),
  );

  for (const { canonicalSubject, entry } of exactMatches) {
    const resolvedSubject = subjectByCanonicalName.get(canonicalSubject) || null;
    if (!resolvedSubject) {
      unmatchedIssues.push({
        source: "src/mcp/curriculum.ts",
        grade: entry.grade,
        subject: entry.subject,
        officialRef: entry.officialRef,
        reason: `Subject ${canonicalSubject} is not present in Supabase.`,
      });
      continue;
    }

    const subjectIsLinked = gradeSubjects.some(
      (row) => row.grade_id === resolvedGrade.id && row.subject_id === resolvedSubject.id,
    );
    if (!subjectIsLinked) {
      unmatchedIssues.push({
        source: "src/mcp/curriculum.ts",
        grade: entry.grade,
        subject: entry.subject,
        officialRef: entry.officialRef,
        reason: `Subject ${canonicalSubject} is not linked to grade ${resolvedGrade.name} in grade_subjects.`,
      });
      continue;
    }

    for (const topicTitle of entry.topics) {
      const topicKey = `${resolvedSubject.id}::${normalize(topicTitle)}`;
      let topicRow = topicKeyToRow.get(topicKey) || null;

      if (topicRow) {
        skippedTopicsCount += 1;
      } else {
        const topicPayload = {
          grade_id: resolvedGrade.id,
          subject_id: resolvedSubject.id,
          title: topicTitle,
        };

        const { data: insertedTopic, error: insertTopicError } = await client
          .from("topics")
          .insert(topicPayload)
          .select("id, grade_id, subject_id, title")
          .single();

        if (insertTopicError) throw insertTopicError;

        topicRow = insertedTopic as TopicRow;
        topicKeyToRow.set(topicKey, topicRow);
        insertedTopicsCount += 1;
      }

      const lessonKey = `${topicRow.id}::${normalize(topicTitle)}`;
      if (lessonKeySet.has(lessonKey)) {
        skippedLessonsCount += 1;
        continue;
      }

      const lessonPayload: Record<string, unknown> = {
        country: TARGET_COUNTRY,
        cycle: "Secondaire qualifiant",
        grade: resolvedGrade.name,
        subject: resolvedSubject.name,
        lesson_title: topicTitle,
        content: buildStarterContent(entry, topicTitle),
        topic_id: topicRow.id,
        is_ai_generated: false,
        tags: ["trusted-local-outline", "seed"],
      };

      if (supportsTrustedSource) {
        lessonPayload.trusted_source = true;
      }

      const { error: insertLessonError } = await client.from("lessons").insert(lessonPayload);
      if (insertLessonError) throw insertLessonError;

      lessonKeySet.add(lessonKey);
      insertedLessonsCount += 1;
    }
  }

  const finalLessonsRes = await client
    .from("lessons")
    .select("id, subject")
    .eq("grade", resolvedGrade.name)
    .in("subject", subjects.map((subject) => subject.name));

  if (finalLessonsRes.error) throw finalLessonsRes.error;

  const finalLessonCountBySubject = subjects.reduce<Record<string, number>>((accumulator, subject) => {
    accumulator[subject.name] = (finalLessonsRes.data || []).filter((lesson) => lesson.subject === subject.name).length;
    return accumulator;
  }, {});

  console.log(
    JSON.stringify(
      {
        inserted_topics_count: insertedTopicsCount,
        skipped_topics_count: skippedTopicsCount,
        inserted_lessons_count: insertedLessonsCount,
        skipped_lessons_count: skippedLessonsCount,
        unmatched_outline_entries: unmatchedIssues,
        final_lesson_count_by_subject: finalLessonCountBySubject,
        outline_entries_in_scope: exactMatches.map(({ entry, canonicalSubject }) => ({
          grade: entry.grade,
          subject: canonicalSubject,
          topics_count: entry.topics.length,
          officialRef: entry.officialRef,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
