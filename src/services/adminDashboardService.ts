import { supabase, isSupabaseConfigured } from "../db/supabase";

export const ADMIN_CANONICAL_QUEUE_STATUSES = ["done", "pending", "failed", "processing"] as const;

const CONFIRMED_ADMIN_TABLES = [
  "profiles",
  "lessons",
  "topics",
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
  recoveredLessonsNeedsReview: number;
  studentPublishReadyLessons: number;
  ragTotal: number;
  ragDone: number;
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
  lessons_covered: number;
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
  pending: number;
  other: number;
  byStatus: Record<string, number>;
}

export interface AiReviewStatusCount {
  status: string;
  count: number;
}

export interface AiRecoveryDashboardKpis {
  failedJobs: number;
  pendingAiTasks: number;
  completedAiTasks: number;
  lessonsNeedingReview: number;
  approvedRecoveredLessons: number;
  rejectedRecoveredLessons: number;
}

const ensureConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for the admin dashboard. Add valid Supabase environment variables before loading live metrics.");
  }
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
    throw new Error(`${label}: ${error.message}`);
  }
  return count ?? 0;
};

const readRows = async <T = any>(
  label: string,
  query: Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data ?? [];
};

export const loadAdminOverviewKpis = async (): Promise<AdminOverviewKpis> => {
  ensureConfigured();

  const [
    topics,
    completedJobs,
    pendingJobs,
    failedJobs,
    recoveredLessonsNeedsReview,
    studentPublishReadyLessons,
    ragTotal,
    ragDone,
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
    readCount("rag chunk count", supabase.from("rag_chunks").select("*", { count: "exact", head: true })),
    readCount("embedded rag chunk count", supabase.from("rag_chunks").select("*", { count: "exact", head: true }).eq("embedding_status", "done")),
    readCount("profile count", supabase.from("profiles").select("*", { count: "exact", head: true })),
  ]);

  return {
    topics,
    completedJobs,
    pendingJobs,
    failedJobs,
    recoveredLessonsNeedsReview,
    studentPublishReadyLessons,
    ragTotal,
    ragDone,
    users,
  };
};

export const loadAdminTableHealth = async (): Promise<AdminTableHealth[]> => {
  ensureConfigured();

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
  ensureConfigured();

  const [grades, topics, lessons, queue] = await Promise.all([
    readRows<any>("grades", supabase.from("grades").select("id, name, grade_order, cycles(name, cycle_order)")),
    readRows<any>("topics", supabase.from("topics").select("id, grade_id")),
    readRows<any>("lessons", supabase.from("lessons").select("id, topic_id, teaching_contract")),
    readRows<any>("lesson_gen_queue", supabase.from("lesson_gen_queue").select("id, topic_id, status")),
  ]);

  return grades
    .map((grade) => {
      const gradeTopics = topics.filter((topic) => topic.grade_id === grade.id);
      const topicIds = new Set(gradeTopics.map((topic) => topic.id));
      const gradeLessons = lessons.filter((lesson) => lesson.topic_id && topicIds.has(lesson.topic_id));
      const gradeQueue = queue.filter((job) => job.topic_id && topicIds.has(job.topic_id));
      const cycle = grade.cycles;

      return {
        id: grade.id,
        cycle: cycle?.name ?? "Unknown",
        cycle_order: cycle?.cycle_order ?? 0,
        grade: grade.name,
        grade_order: grade.grade_order ?? 0,
        total_topics: gradeTopics.length,
        lessons_covered: new Set(gradeLessons.map((lesson) => lesson.topic_id)).size,
        q_done: countStatus(gradeQueue, "done"),
        q_pending: countStatus(gradeQueue, "pending"),
        q_failed: countStatus(gradeQueue, "failed"),
        needs_review: gradeLessons.filter(isNeedsReviewLesson).length,
      } satisfies AdminGradeRow;
    })
    .sort((left, right) => left.cycle_order - right.cycle_order || left.grade_order - right.grade_order);
};

export const loadAdminQueueMetrics = async (): Promise<{ stats: QueueStatusBreakdown; failedJobs: FailedQueueJob[] }> => {
  ensureConfigured();

  const [queueRows, failedJobs] = await Promise.all([
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

  const topicIds = Array.from(new Set(failedJobs.map((job) => job.topic_id).filter(Boolean)));
  let topicsById = new Map<string, string>();

  if (topicIds.length > 0) {
    const topicRows = await readRows<any>("failed job topics", supabase.from("topics").select("id, title").in("id", topicIds));
    topicsById = new Map(topicRows.map((topic) => [topic.id, topic.title]));
  }

  return {
    stats: {
      done: countsByStatus.done || 0,
      pending: countsByStatus.pending || 0,
      failed: countsByStatus.failed || 0,
      processing: countsByStatus.processing || 0,
      other: otherStatuses.reduce((sum, entry) => sum + entry.count, 0),
      unresolvedTopicJobs: queueRows.filter((row) => !row.topic_id).length,
      otherStatuses,
    },
    failedJobs: failedJobs.map((job) => ({
      ...job,
      topics: job.topic_id ? { title: topicsById.get(job.topic_id) ?? null } : null,
    })),
  };
};

export const loadAdminRagMetrics = async (): Promise<{ ragStats: RagMetrics; ragByGrade: RagByGrade[] }> => {
  ensureConfigured();

  const [chunks, grades] = await Promise.all([
    readRows<any>("rag chunks", supabase.from("rag_chunks").select("embedding_status, grade_id")),
    readRows<any>("grades for rag", supabase.from("grades").select("id, name, grade_order, cycles(cycle_order)")),
  ]);

  const byStatus = chunks.reduce<Record<string, number>>((acc, chunk) => {
    const status = String(chunk.embedding_status || "unknown");
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const ragStats: RagMetrics = {
    total: chunks.length,
    done: byStatus.done || 0,
    pending: byStatus.pending || 0,
    other: chunks.length - (byStatus.done || 0) - (byStatus.pending || 0),
    byStatus,
  };

  const ragByGrade = grades
    .map((grade) => {
      const gradeChunks = chunks.filter((chunk) => chunk.grade_id === grade.id);
      const cycle = grade.cycles;
      const done = gradeChunks.filter((chunk) => chunk.embedding_status === "done").length;
      const pending = gradeChunks.filter((chunk) => chunk.embedding_status === "pending").length;

      return {
        id: grade.id,
        grade: grade.name,
        grade_order: grade.grade_order ?? 0,
        cycle_order: cycle?.cycle_order ?? 0,
        total: gradeChunks.length,
        done,
        pending,
        other: gradeChunks.length - done - pending,
      } satisfies RagByGrade;
    })
    .sort((left, right) => left.cycle_order - right.cycle_order || left.grade_order - right.grade_order);

  return { ragStats, ragByGrade };
};

export const loadAiRecoveryReviewStatusCounts = async (): Promise<AiReviewStatusCount[]> => {
  ensureConfigured();

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

export const loadAiRecoveryDashboardKpis = async (): Promise<AiRecoveryDashboardKpis> => {
  ensureConfigured();

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
