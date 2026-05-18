import { checkSupabaseConnection, supabase } from "../db/supabase";

export const ADMIN_CANONICAL_QUEUE_STATUSES = ["done", "pending", "failed", "processing"] as const;
const ADMIN_CANONICAL_RAG_STATUSES = ["done", "pending", "processing", "failed"] as const;

const CONFIRMED_ADMIN_TABLES = [
  "profiles",
  "lessons",
  "topics",
  "subject_domains",
  "grades",
  "subjects",
  "cycles",
  "lesson_gen_queue",
  "rag_chunks",
  "app_settings",
  "bac_sections",
  "bac_tracks",
  "bac_exams",
  "bac_track_subjects",
  "grade_subjects",
  "ai_issues",
  "ai_tasks",
  "ai_task_logs",
  "ai_task_approvals",
  "ai_execution_snapshots",
  "ai_issue_patterns",
  "ai_monitoring_runs",
  "ai_rag_health_reports",
] as const;

export interface AdminOverviewKpis {
  topics: number;
  completedJobs: number;
  pendingJobs: number;
  failedJobs: number;
  lessonQueueDone: number;
  lessonQueuePending: number;
  lessonQueueFailed: number;
  recoveredLessonsNeedsReview: number;
  studentPublishReadyLessons: number;
  ragTotal: number;
  ragDone: number;
  ragEmbedded: number;
  ragLinkedToTopic: number;
  ragUsable: number;
  users: number;
}

export interface AdminTableHealth {
  table_name: string;
  row_count: number | null;
  health_status: "present" | "empty" | "missing" | "restricted";
  error_message?: string;
}

export interface AdminGradeRow {
  id: string;
  cycle: string;
  cycle_order: number;
  grade: string;
  grade_order: number;
  total_topics: number;
  lesson_rows: number;
  lessons_covered: number;
  topic_coverage: number;
  linked_lessons: number;
  unlinked_lessons: number;
  coverage_source: "none" | "topic_id" | "lesson_grade" | "mixed";
  data_notes: string[];
  q_done: number;
  q_pending: number;
  q_failed: number;
  needs_review: number;
}

export interface QueueStatusBreakdown {
  done: number;
  pending: number;
  failed: number;
  processing: number;
  other: number;
  unresolvedTopicJobs: number;
  otherStatuses: Array<{ status: string; count: number }>;
}

export interface FailedQueueJob {
  id: string;
  topic_id: string | null;
  track_id: string | null;
  attempts: number | null;
  last_error: string | null;
  created_at: string;
  topics: { title: string | null } | null;
}

export interface RagByGrade {
  id: string;
  grade: string;
  grade_order: number;
  cycle_order: number;
  total: number;
  done: number;
  pending: number;
  other: number;
}

export interface RagMetrics {
  total: number;
  done: number;
  embedded: number;
  withEmbedding?: number;
  missingEmbedding?: number;
  linkedToTopic: number;
  withGrade?: number;
  usable: number;
  unlinkedToTopic?: number;
  shortContent?: number;
  failed?: number;
  pending: number;
  other: number;
  linkedByLesson?: number;
  linkedByMetadata?: number;
  unmatched?: number;
  byStatus: Record<string, number>;
}

export interface RagChunkHealth {
  total_chunks: number;
  usable_chunks: number;
  with_topic_id: number;
  with_grade_id: number;
  without_topic_id: number;
  with_embedding: number;
  embedding_done: number;
  embedding_pending: number;
  embedding_failed: number;
  short_content: number;
  linked_by_lesson: number;
  linked_by_metadata: number;
  unmatched: number;
}

export interface RagTopicRepairResult {
  before: RagChunkHealth;
  after: RagChunkHealth;
  methods: {
    lesson_id: number;
    metadata_topic_id: number;
    title_match: number;
    single_topic_for_grade_subject: number;
    unmatched: number;
  };
  unmatchedSamples: Array<{
    id: string;
    grade_id: string | null;
    embedding_status: string | null;
    reason: string;
    content_preview: string;
    metadata_title: string | null;
  }>;
}

export interface AiReviewStatusCount {
  status: string;
  count: number;
}

export interface AiTaskLogDebugRow {
  id: string;
  task_id: string;
  agent_name: string;
  log_type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AiExecutionSnapshotDebugRow {
  id: string;
  task_id: string;
  snapshot_type: string;
  target_table: string | null;
  record_count: number | null;
  snapshot_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AiObservabilityDebugData {
  logs: AiTaskLogDebugRow[];
  snapshots: AiExecutionSnapshotDebugRow[];
}

export interface AiRecoveryDashboardKpis {
  failedJobs: number;
  pendingAiTasks: number;
  completedAiTasks: number;
  lessonsNeedingReview: number;
  approvedRecoveredLessons: number;
  rejectedRecoveredLessons: number;
}

export interface TopicRepairSummary {
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
    reason: string;
  }>;
}

const ensureConfigured = async () => {
  const configured = await checkSupabaseConnection();
  if (!configured) {
    throw new Error("Supabase is not configured for the admin dashboard. Add valid Supabase environment variables before loading live metrics.");
  }
};

const getAdminApiHeaders = async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (typeof localStorage !== "undefined" && localStorage.getItem("demo_admin_logged_in") === "true") {
    headers["x-levelspace-demo-admin"] = "true";
  }

  return headers;
};

const parseApiError = async (response: Response) => {
  try {
    const payload = await response.json();
    return payload.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const loadRagChunkHealthViaAdminApi = async (): Promise<RagChunkHealth> => {
  const headers = await getAdminApiHeaders();
  const response = await fetch("/api/admin/rag/health", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const { health } = await response.json() as { health: RagChunkHealth };
  return health;
};

const parseObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const countStatus = (rows: Array<{ status?: string | null }>, status: string) =>
  rows.filter((row) => row.status === status).length;

const isNeedsReviewLesson = (lesson: { teaching_contract?: unknown }) =>
  parseObject(lesson.teaching_contract)?.status === "needs_review";

const normalizeMetricText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();

const GRADE_TEXT_ALIASES_BY_KEY: Record<string, string[]> = {
  "tronc commun": [
    "Tronc Commun Scientifique",
    "Tronc Commun Sciences",
    "Common Core",
    "Common Core Science",
    "TCS",
  ],
  "1ere annee bac": [
    "Premiere",
    "1ere Bac",
    "1 Bac",
    "Grade 11",
  ],
  "2eme annee bac": [
    "Terminale",
    "2eme Bac",
    "2 Bac",
    "Baccalaureat",
    "Grade 12",
  ],
};

const gradeMatchKeys = (gradeName: string) =>
  new Set([gradeName, ...(GRADE_TEXT_ALIASES_BY_KEY[normalizeMetricText(gradeName)] || [])].map(normalizeMetricText).filter(Boolean));

const rowMatchesGradeName = (rowGrade: unknown, keys: Set<string>) => {
  const normalized = normalizeMetricText(rowGrade);
  return normalized ? keys.has(normalized) : false;
};

const isMissingTableError = (error: { code?: string; message?: string } | null) => {
  const message = String(error?.message || "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
};

const readCount = async (label: string, query: Promise<{ count: number | null; error: { message: string } | null }>) => {
  const { count, error } = await query;
  if (error) {
    console.warn(`[Admin metrics] ${label} unavailable: ${error.message}`);
    return 0;
  }
  return count ?? 0;
};

const readRows = async <T = any>(
  label: string,
  query: Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    console.warn(`[Admin metrics] ${label} unavailable: ${error.message}`);
    return [];
  }
  return data ?? [];
};

export const loadAdminOverviewKpis = async (): Promise<AdminOverviewKpis> => {
  await ensureConfigured();

  const [
    topics,
    completedJobs,
    pendingJobs,
    failedJobs,
    recoveredLessonsNeedsReview,
    studentPublishReadyLessons,
    ragHealth,
    users,
  ] = await Promise.all([
    readCount("topics count", supabase.from("topics").select("*", { count: "exact", head: true })),
    readCount("completed queue jobs", supabase.from("lesson_gen_queue").select("*", { count: "exact", head: true }).eq("status", "done")),
    readCount("pending queue jobs", supabase.from("lesson_gen_queue").select("*", { count: "exact", head: true }).eq("status", "pending")),
    readCount("failed queue jobs", supabase.from("lesson_gen_queue").select("*", { count: "exact", head: true }).eq("status", "failed")),
    readCount(
      "recovered lessons needing review",
      supabase.from("lessons").select("*", { count: "exact", head: true }).eq("teaching_contract->>status", "needs_review")
    ),
    readCount(
      "student publish ready lessons",
      supabase
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("teaching_contract->>status", "needs_review")
        .eq("teaching_contract->>student_publish_allowed", "true")
    ),
    loadRagChunkHealthViaAdminApi(),
    readCount("profile count", supabase.from("profiles").select("*", { count: "exact", head: true })),
  ]);

  return {
    topics,
    completedJobs,
    pendingJobs,
    failedJobs,
    lessonQueueDone: completedJobs,
    lessonQueuePending: pendingJobs,
    lessonQueueFailed: failedJobs,
    recoveredLessonsNeedsReview,
    studentPublishReadyLessons,
    ragTotal: ragHealth.total_chunks,
    ragDone: ragHealth.embedding_done,
    ragEmbedded: ragHealth.embedding_done,
    ragLinkedToTopic: ragHealth.with_topic_id,
    ragUsable: ragHealth.usable_chunks,
    users,
  };
};

export const loadAdminTableHealth = async (): Promise<AdminTableHealth[]> => {
  await ensureConfigured();

  const results = await Promise.all(
    CONFIRMED_ADMIN_TABLES.map(async (table_name) => {
      const { count, error } = await supabase.from(table_name as any).select("*", { count: "exact", head: true });
      if (error) {
        return {
          table_name,
          row_count: null,
          health_status: isMissingTableError(error) ? "missing" : "restricted",
          error_message: error.message,
        } satisfies AdminTableHealth;
      }

      return {
        table_name,
        row_count: count ?? 0,
        health_status: (count ?? 0) > 0 ? "present" : "empty",
      } satisfies AdminTableHealth;
    })
  );

  return results.sort((left, right) => {
    const leftWeight = left.health_status === "present" ? 3 : left.health_status === "empty" ? 2 : left.health_status === "restricted" ? 1 : 0;
    const rightWeight = right.health_status === "present" ? 3 : right.health_status === "empty" ? 2 : right.health_status === "restricted" ? 1 : 0;
    if (leftWeight !== rightWeight) return rightWeight - leftWeight;
    if ((left.row_count ?? -1) !== (right.row_count ?? -1)) return (right.row_count ?? -1) - (left.row_count ?? -1);
    return left.table_name.localeCompare(right.table_name);
  });
};

export const loadAdminGradeMetrics = async (): Promise<AdminGradeRow[]> => {
  await ensureConfigured();

  const [grades, topics, lessons, queue] = await Promise.all([
    readRows<any>("grades", supabase.from("grades").select("id, name, grade_order, cycles(name, cycle_order)")),
    readRows<any>("topics", supabase.from("topics").select("id, grade_id")),
    readRows<any>("lessons", supabase.from("lessons").select("id, topic_id, grade, teaching_contract")),
    readRows<any>("lesson_gen_queue", supabase.from("lesson_gen_queue").select("id, topic_id, status")),
  ]);

  return grades
    .map((grade) => {
      const gradeTopics = topics.filter((topic) => topic.grade_id === grade.id);
      const topicIds = new Set(gradeTopics.map((topic) => topic.id));
      const matchKeys = gradeMatchKeys(grade.name);
      const linkedLessons = lessons.filter((lesson) => lesson.topic_id && topicIds.has(lesson.topic_id));
      const gradeTextLessons = lessons.filter((lesson) => rowMatchesGradeName(lesson.grade, matchKeys));
      const gradeLessonsById = new Map<string, any>();

      for (const lesson of linkedLessons) gradeLessonsById.set(lesson.id, lesson);
      for (const lesson of gradeTextLessons) gradeLessonsById.set(lesson.id, lesson);

      const gradeLessons = Array.from(gradeLessonsById.values());
      const coveredTopicIds = new Set(linkedLessons.map((lesson) => lesson.topic_id).filter(Boolean));
      const linkedLessonIds = new Set(linkedLessons.map((lesson) => lesson.id));
      const unlinkedLessons = gradeLessons.filter((lesson) => !lesson.topic_id || !topicIds.has(lesson.topic_id));
      const gradeQueue = queue.filter((job) => job.topic_id && topicIds.has(job.topic_id));
      const cycle = grade.cycles;
      const coverageSource =
        linkedLessons.length > 0 && gradeTextLessons.length > linkedLessons.length
          ? "mixed"
          : linkedLessons.length > 0
            ? "topic_id"
            : gradeTextLessons.length > 0
              ? "lesson_grade"
              : "none";
      const dataNotes: string[] = [];

      if (gradeTopics.length === 0 && gradeLessons.length > 0) {
        dataNotes.push("No topic rows for this grade; showing direct lesson.grade matches.");
      } else if (unlinkedLessons.length > 0) {
        dataNotes.push(`${unlinkedLessons.length} lesson rows are not linked to this grade through topics.`);
      }

      return {
        id: grade.id,
        cycle: cycle?.name ?? "Unknown",
        cycle_order: cycle?.cycle_order ?? 0,
        grade: grade.name,
        grade_order: grade.grade_order ?? 0,
        total_topics: gradeTopics.length,
        lesson_rows: gradeLessons.length,
        lessons_covered: gradeLessons.length,
        topic_coverage: coveredTopicIds.size,
        linked_lessons: linkedLessonIds.size,
        unlinked_lessons: unlinkedLessons.length,
        coverage_source: coverageSource,
        data_notes: dataNotes,
        q_done: countStatus(gradeQueue, "done"),
        q_pending: countStatus(gradeQueue, "pending"),
        q_failed: countStatus(gradeQueue, "failed"),
        needs_review: gradeLessons.filter(isNeedsReviewLesson).length,
      } satisfies AdminGradeRow;
    })
    .sort((left, right) => left.cycle_order - right.cycle_order || left.grade_order - right.grade_order);
};

export const loadAdminQueueMetrics = async (): Promise<{ stats: QueueStatusBreakdown; failedJobs: FailedQueueJob[] }> => {
  await ensureConfigured();

  const [queueRows, failedJobs, topics] = await Promise.all([
    readRows<any>("queue statuses", supabase.from("lesson_gen_queue").select("status, topic_id")),
    readRows<any>(
      "recent failed queue jobs",
      supabase
        .from("lesson_gen_queue")
        .select("id, topic_id, track_id, attempts, last_error, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(10)
    ),
    readRows<any>("queue topic anchors", supabase.from("topics").select("id")),
  ]);

  const countsByStatus = queueRows.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status || "unknown");
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const otherStatuses = Object.entries(countsByStatus)
    .filter(([status]) => !ADMIN_CANONICAL_QUEUE_STATUSES.includes(status as (typeof ADMIN_CANONICAL_QUEUE_STATUSES)[number]))
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));

  const knownTopicIds = new Set(topics.map((topic) => topic.id).filter(Boolean));
  const failedTopicIds = Array.from(new Set(failedJobs.map((job) => job.topic_id).filter(Boolean)));
  let topicsById = new Map<string, string>();

  if (failedTopicIds.length > 0) {
    const topicRows = await readRows<any>("failed job topics", supabase.from("topics").select("id, title").in("id", failedTopicIds));
    topicsById = new Map(topicRows.map((topic) => [topic.id, topic.title]));
  }

  return {
    stats: {
      done: countsByStatus.done || 0,
      pending: countsByStatus.pending || 0,
      failed: countsByStatus.failed || 0,
      processing: countsByStatus.processing || 0,
      other: otherStatuses.reduce((sum, entry) => sum + entry.count, 0),
      unresolvedTopicJobs: queueRows.filter((row) => !row.topic_id || !knownTopicIds.has(row.topic_id)).length,
      otherStatuses,
    },
    failedJobs: failedJobs.map((job) => ({
      ...job,
      topics: job.topic_id ? { title: topicsById.get(job.topic_id) ?? null } : null,
    })),
  };
};

export const loadAdminRagMetrics = async (): Promise<{ ragStats: RagMetrics; ragByGrade: RagByGrade[] }> => {
  await ensureConfigured();

  const health = await loadRagChunkHealthViaAdminApi();

  const [processing, grades] = await Promise.all([
    // Use exact head counts here. Plain selects are page-limited by PostgREST and cap dashboard metrics at ~1,000 rows.
    readCount("processing rag chunk count", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("embedding_status", "processing")),
    readRows<any>("grades for rag", supabase.from("grades").select("id, name, grade_order, cycles(cycle_order)")),
  ]);

  const byStatus: Record<string, number> = {
    done: health.embedding_done,
    pending: health.embedding_pending,
    processing,
    failed: health.embedding_failed,
  };
  const knownStatusTotal = ADMIN_CANONICAL_RAG_STATUSES.reduce((sum, status) => sum + (byStatus[status] || 0), 0);

  const ragStats: RagMetrics = {
    total: health.total_chunks,
    done: health.embedding_done,
    embedded: health.embedding_done,
    withEmbedding: health.with_embedding,
    missingEmbedding: Math.max(0, health.total_chunks - health.with_embedding),
    linkedToTopic: health.with_topic_id,
    withGrade: health.with_grade_id,
    usable: health.usable_chunks,
    unlinkedToTopic: health.without_topic_id,
    shortContent: health.short_content,
    failed: health.embedding_failed,
    pending: health.embedding_pending,
    other: Math.max(0, health.total_chunks - knownStatusTotal),
    linkedByLesson: health.linked_by_lesson,
    linkedByMetadata: health.linked_by_metadata,
    unmatched: health.unmatched,
    byStatus,
  };

  const ragByGrade = await Promise.all(
    grades.map(async (grade) => {
      const [gradeTotal, gradeDone, gradePending, gradeProcessing, gradeFailed] = await Promise.all([
        readCount("rag chunks by grade", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("grade_id", grade.id)),
        readCount("done rag chunks by grade", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("grade_id", grade.id).eq("embedding_status", "done")),
        readCount("pending rag chunks by grade", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("grade_id", grade.id).eq("embedding_status", "pending")),
        readCount("processing rag chunks by grade", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("grade_id", grade.id).eq("embedding_status", "processing")),
        readCount("failed rag chunks by grade", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("grade_id", grade.id).eq("embedding_status", "failed")),
      ]);
      const cycle = grade.cycles;
      const gradeKnownStatusTotal = gradeDone + gradePending + gradeProcessing + gradeFailed;

      return {
        id: grade.id,
        grade: grade.name,
        grade_order: grade.grade_order ?? 0,
        cycle_order: cycle?.cycle_order ?? 0,
        total: gradeTotal,
        done: gradeDone,
        pending: gradePending,
        other: Math.max(0, gradeTotal - gradeKnownStatusTotal),
      } satisfies RagByGrade;
    })
  );

  ragByGrade
    .sort((left, right) => left.cycle_order - right.cycle_order || left.grade_order - right.grade_order);

  return { ragStats, ragByGrade };
};

export const loadAiRecoveryReviewStatusCounts = async (): Promise<AiReviewStatusCount[]> => {
  await ensureConfigured();

  const tasks = await readRows<any>("ai task review statuses", supabase.from("ai_tasks").select("id, target_area, result"));
  const counts = tasks
    .filter((task) => task.target_area === "lesson_generation")
    .reduce<Record<string, number>>((acc, task) => {
      const result = parseObject(task.result);
      const status = typeof result?.review_status === "string" && result.review_status.trim()
        ? result.review_status.trim()
        : "unreviewed";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));
};

export const loadAiObservabilityDebugData = async (): Promise<AiObservabilityDebugData> => {
  await ensureConfigured();

  const [logs, snapshots] = await Promise.all([
    readRows<AiTaskLogDebugRow>(
      "latest ai task logs",
      supabase
        .from("ai_task_logs")
        .select("id, task_id, agent_name, log_type, message, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ),
    readRows<AiExecutionSnapshotDebugRow>(
      "latest ai execution snapshots",
      supabase
        .from("ai_execution_snapshots")
        .select("id, task_id, snapshot_type, target_table, record_count, snapshot_data, created_at")
        .order("created_at", { ascending: false })
        .limit(20)
    ),
  ]);

  return { logs, snapshots };
};

export const loadAiRecoveryDashboardKpis = async (): Promise<AiRecoveryDashboardKpis> => {
  await ensureConfigured();

  const [
    failedJobs,
    pendingAiTasks,
    completedAiTasks,
    lessonsNeedingReview,
    approvedRecoveredLessons,
    rejectedRecoveredLessons,
  ] = await Promise.all([
    readCount(
      "failed lesson generation jobs",
      supabase.from("lesson_gen_queue").select("*", { count: "exact", head: true }).eq("status", "failed")
    ),
    readCount(
      "pending lesson generation AI tasks",
      supabase
        .from("ai_tasks")
        .select("*", { count: "exact", head: true })
        .eq("target_area", "lesson_generation")
        .eq("status", "pending")
    ),
    readCount(
      "completed lesson generation AI tasks",
      supabase
        .from("ai_tasks")
        .select("*", { count: "exact", head: true })
        .eq("target_area", "lesson_generation")
        .eq("status", "completed")
    ),
    readCount(
      "lessons needing recovery review",
      supabase.from("lessons").select("*", { count: "exact", head: true }).eq("teaching_contract->>status", "needs_review")
    ),
    readCount(
      "approved recovered lessons",
      supabase.from("lessons").select("*", { count: "exact", head: true }).eq("teaching_contract->>status", "approved")
    ),
    readCount(
      "rejected recovered lessons",
      supabase.from("lessons").select("*", { count: "exact", head: true }).eq("teaching_contract->>status", "rejected")
    ),
  ]);

  return {
    failedJobs,
    pendingAiTasks,
    completedAiTasks,
    lessonsNeedingReview,
    approvedRecoveredLessons,
    rejectedRecoveredLessons,
  };
};

export const repairTopicsFromLessons = async (): Promise<TopicRepairSummary> => {
  const headers = await getAdminApiHeaders();
  const response = await fetch("/api/admin/topics/repair", {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = await response.json() as { summary: TopicRepairSummary };
  return payload.summary;
};

export const repairRagTopicLinks = async (): Promise<RagTopicRepairResult> => {
  const headers = await getAdminApiHeaders();
  const response = await fetch("/api/admin/rag/repair-topic-links", {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return await response.json() as RagTopicRepairResult;
};
