import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import {
  AiRecoveryDashboardKpis,
  loadAiRecoveryDashboardKpis,
} from "../services/adminDashboardService";
import {
  AiRecoveryFailedJobSummary,
  AiRecoveryJobDiagnostics,
  AiRecoveryLogEntry,
  AiRecoveryRecoveredLessonDetail,
  AiRecoveryRecoveredLessonSummary,
  RecoveredLessonStatus,
  approveRecoveredLesson,
  createAiRecoveryTask,
  getAiRecoveryLogs,
  getAiRecoveryFailedJobs,
  getAiRecoveryJobDiagnostics,
  getAiRecoveryRecoveredLessonDetail,
  getAiRecoveryRecoveredLessons,
  rejectRecoveredLesson,
} from "../services/adminAiRecoveryService";

type RecoveryRouteKey = "dashboard" | "failed-jobs" | "ai-tasks" | "recovered-lessons" | "logs";

interface RecoveryTabConfig {
  key: RecoveryRouteKey;
  label: string;
  path: string;
  description: string;
}

const RECOVERY_TABS: RecoveryTabConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/admin/ai-recovery",
    description: "Live recovery KPIs pulled from Supabase.",
  },
  {
    key: "failed-jobs",
    label: "Failed Jobs",
    path: "/admin/ai-recovery/failed-jobs",
    description: "Queue failures from public.lesson_gen_queue where status = 'failed'.",
  },
  {
    key: "ai-tasks",
    label: "AI Tasks",
    path: "/admin/ai-recovery/ai-tasks",
    description: "Lesson generation AI task pipeline status from public.ai_tasks.",
  },
  {
    key: "recovered-lessons",
    label: "Recovered Lessons",
    path: "/admin/ai-recovery/recovered-lessons",
    description: "Lesson recovery review states from public.lessons teaching_contract JSON.",
  },
  {
    key: "logs",
    label: "Logs",
    path: "/admin/ai-recovery/logs",
    description: "Reserved shell for recovery logs and audit trails.",
  },
];

const EMPTY_KPIS: AiRecoveryDashboardKpis = {
  failedJobs: 0,
  pendingAiTasks: 0,
  completedAiTasks: 0,
  lessonsNeedingReview: 0,
  approvedRecoveredLessons: 0,
  rejectedRecoveredLessons: 0,
};

const Spinner: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div className="flex items-center justify-center gap-3 rounded-3xl border border-ink/10 bg-paper px-6 py-12 text-sm text-muted shadow-sm">
    <RefreshCw className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

const StatePanel: React.FC<{
  title: string;
  body: string;
  tone?: "neutral" | "danger";
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, body, tone = "neutral", actionLabel, onAction }) => {
  const toneClasses =
    tone === "danger"
      ? "border-destructive/20 bg-destructive/5 text-destructive"
      : "border-ink/10 bg-paper text-ink";

  return (
    <div className={`rounded-3xl border px-6 py-8 shadow-sm ${toneClasses}`}>
      <div className="flex items-start gap-3">
        {tone === "danger" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted">{body}</p>
          {actionLabel && onAction ? (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: number;
  description: string;
  tone?: "default" | "warning" | "success" | "danger";
}> = ({ label, value, description, tone = "default" }) => {
  const valueClasses =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-emerald-600"
          : "text-ink";

  return (
    <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className={`mt-3 text-4xl font-black tracking-tight ${valueClasses}`}>{value}</div>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatNullable = (value: string | null | undefined) => {
  const text = String(value || "").trim();
  return text || "—";
};

const outlineHeadline = (outline: Record<string, unknown>, index: number) => {
  const candidates = [
    outline.title,
    outline.name,
    outline.heading,
    outline.label,
    outline.summary,
  ];
  const match = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof match === "string" ? match : `Outline ${index + 1}`;
};

const JsonPreview: React.FC<{ value: Record<string, unknown> }> = ({ value }) => (
  <pre className="overflow-x-auto rounded-2xl bg-surface-low p-3 text-xs leading-6 text-ink/80">
    {JSON.stringify(value, null, 2)}
  </pre>
);

const RECOVERY_EVENT_TYPES = [
  "task_created",
  "sql_generated",
  "safety_check_passed",
  "safety_check_failed",
  "execution_started",
  "execution_success",
  "execution_failed",
  "lesson_approved",
  "lesson_rejected",
] as const;

export const AdminAiRecovery: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [kpis, setKpis] = useState<AiRecoveryDashboardKpis>(EMPTY_KPIS);

  const [failedJobs, setFailedJobs] = useState<AiRecoveryFailedJobSummary[]>([]);
  const [failedJobsLoading, setFailedJobsLoading] = useState(false);
  const [failedJobsLoaded, setFailedJobsLoaded] = useState(false);
  const [failedJobsError, setFailedJobsError] = useState("");

  const [selectedDiagnostics, setSelectedDiagnostics] = useState<AiRecoveryJobDiagnostics | null>(null);
  const [diagnosticsJobId, setDiagnosticsJobId] = useState<string | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState("");

  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});

  const [recoveredLessons, setRecoveredLessons] = useState<AiRecoveryRecoveredLessonSummary[]>([]);
  const [recoveredLessonsLoading, setRecoveredLessonsLoading] = useState(false);
  const [recoveredLessonsLoaded, setRecoveredLessonsLoaded] = useState(false);
  const [recoveredLessonsError, setRecoveredLessonsError] = useState("");
  const [recoveredStatusFilter, setRecoveredStatusFilter] = useState<RecoveredLessonStatus>("needs_review");
  const [selectedRecoveredLesson, setSelectedRecoveredLesson] = useState<AiRecoveryRecoveredLessonDetail | null>(null);
  const [reviewLessonId, setReviewLessonId] = useState<string | null>(null);
  const [recoveredLessonLoading, setRecoveredLessonLoading] = useState(false);
  const [recoveredLessonError, setRecoveredLessonError] = useState("");
  const [busyRecoveredLessonIds, setBusyRecoveredLessonIds] = useState<Record<string, boolean>>({});
  const [recoveryLogs, setRecoveryLogs] = useState<AiRecoveryLogEntry[]>([]);
  const [recoveryLogsLoading, setRecoveryLogsLoading] = useState(false);
  const [recoveryLogsLoaded, setRecoveryLogsLoaded] = useState(false);
  const [recoveryLogsError, setRecoveryLogsError] = useState("");
  const [recoveryLogFilters, setRecoveryLogFilters] = useState({
    event_type: "",
    job_id: "",
    task_id: "",
    lesson_id: "",
    date: "",
  });

  const activeTab = useMemo<RecoveryTabConfig>(() => {
    return RECOVERY_TABS.find((tab) => location.pathname === tab.path) ?? RECOVERY_TABS[0];
  }, [location.pathname]);

  const totalSignals =
    kpis.failedJobs +
    kpis.pendingAiTasks +
    kpis.completedAiTasks +
    kpis.lessonsNeedingReview +
    kpis.approvedRecoveredLessons +
    kpis.rejectedRecoveredLessons;

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const nextKpis = await loadAiRecoveryDashboardKpis();
      setKpis(nextKpis);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load AI Recovery metrics.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFailedJobs = useCallback(async () => {
    setFailedJobsLoading(true);
    setFailedJobsError("");

    try {
      const jobs = await getAiRecoveryFailedJobs();
      setFailedJobs(jobs);
      setFailedJobsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load failed jobs.";
      setFailedJobsError(message);
    } finally {
      setFailedJobsLoading(false);
    }
  }, []);

  const loadDiagnostics = useCallback(async (jobId: string) => {
    setDiagnosticsLoading(true);
    setDiagnosticsError("");

    try {
      const diagnostics = await getAiRecoveryJobDiagnostics(jobId);
      setSelectedDiagnostics(diagnostics);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load job diagnostics.";
      setDiagnosticsError(message);
      setSelectedDiagnostics(null);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  const loadRecoveredLessons = useCallback(async (status: RecoveredLessonStatus) => {
    setRecoveredLessonsLoading(true);
    setRecoveredLessonsError("");

    try {
      const lessons = await getAiRecoveryRecoveredLessons(status);
      setRecoveredLessons(lessons);
      setRecoveredLessonsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load recovered lessons.";
      setRecoveredLessonsError(message);
    } finally {
      setRecoveredLessonsLoading(false);
    }
  }, []);

  const loadRecoveredLessonDetail = useCallback(async (lessonId: string) => {
    setRecoveredLessonLoading(true);
    setRecoveredLessonError("");

    try {
      const detail = await getAiRecoveryRecoveredLessonDetail(lessonId);
      setSelectedRecoveredLesson(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load recovered lesson review detail.";
      setRecoveredLessonError(message);
      setSelectedRecoveredLesson(null);
    } finally {
      setRecoveredLessonLoading(false);
    }
  }, []);

  const loadRecoveryLogs = useCallback(async (filters: typeof recoveryLogFilters) => {
    setRecoveryLogsLoading(true);
    setRecoveryLogsError("");

    try {
      const logs = await getAiRecoveryLogs(filters);
      setRecoveryLogs(logs);
      setRecoveryLogsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load recovery logs.";
      setRecoveryLogsError(message);
    } finally {
      setRecoveryLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (activeTab.key === "failed-jobs" && !failedJobsLoaded && !failedJobsLoading) {
      void loadFailedJobs();
    }
  }, [activeTab.key, failedJobsLoaded, failedJobsLoading, loadFailedJobs]);

  useEffect(() => {
    if (activeTab.key === "recovered-lessons") {
      void loadRecoveredLessons(recoveredStatusFilter);
    }
  }, [activeTab.key, loadRecoveredLessons, recoveredStatusFilter]);

  useEffect(() => {
    if (activeTab.key === "logs") {
      void loadRecoveryLogs(recoveryLogFilters);
    }
  }, [activeTab.key, loadRecoveryLogs, recoveryLogFilters]);

  const handleRefresh = useCallback(async () => {
    await loadMetrics();

    if (activeTab.key === "failed-jobs" || failedJobsLoaded) {
      await loadFailedJobs();
    }

    if (selectedDiagnostics?.job_id) {
      await loadDiagnostics(selectedDiagnostics.job_id);
    }

    if (activeTab.key === "recovered-lessons" || recoveredLessonsLoaded) {
      await loadRecoveredLessons(recoveredStatusFilter);
    }

    if (selectedRecoveredLesson?.lesson.id) {
      await loadRecoveredLessonDetail(selectedRecoveredLesson.lesson.id);
    }

    if (activeTab.key === "logs" || recoveryLogsLoaded) {
      await loadRecoveryLogs(recoveryLogFilters);
    }
  }, [
    activeTab.key,
    failedJobsLoaded,
    loadDiagnostics,
    loadFailedJobs,
    loadMetrics,
    loadRecoveryLogs,
    loadRecoveredLessonDetail,
    loadRecoveredLessons,
    recoveredLessonsLoaded,
    recoveryLogFilters,
    recoveryLogsLoaded,
    recoveredStatusFilter,
    selectedDiagnostics,
    selectedRecoveredLesson,
  ]);

  const handleOpenDiagnostics = useCallback(async (jobId: string) => {
    setDiagnosticsJobId(jobId);
    setSelectedDiagnostics(null);
    setDiagnosticsError("");
    await loadDiagnostics(jobId);
  }, [loadDiagnostics]);

  const handleCloseDiagnostics = useCallback(() => {
    setDiagnosticsJobId(null);
    setSelectedDiagnostics(null);
    setDiagnosticsError("");
    setDiagnosticsLoading(false);
  }, []);

  const handleOpenRecoveredLesson = useCallback(async (lessonId: string) => {
    setReviewLessonId(lessonId);
    setSelectedRecoveredLesson(null);
    setRecoveredLessonError("");
    await loadRecoveredLessonDetail(lessonId);
  }, [loadRecoveredLessonDetail]);

  const handleCloseRecoveredLesson = useCallback(() => {
    setReviewLessonId(null);
    setSelectedRecoveredLesson(null);
    setRecoveredLessonError("");
    setRecoveredLessonLoading(false);
  }, []);

  const handleCreateTask = useCallback(async (jobId: string) => {
    setBusyTaskIds((current) => ({ ...current, [jobId]: true }));

    try {
      const result = await createAiRecoveryTask(jobId);

      setFailedJobs((current) =>
        current.map((job) =>
          job.job_id === jobId
            ? { ...job, existing_task: result.task }
            : job,
        ),
      );

      setSelectedDiagnostics((current) =>
        current && current.job_id === jobId
          ? { ...current, existing_task: result.task }
          : current,
      );

      if (result.already_exists) {
        toast.info("Task already exists", {
          description: `Task ${result.task.id} is already linked to this failed job.`,
        });
      } else {
        toast.success("AI recovery task created", {
          description: `Task ${result.task.id} is now queued for admin review.`,
        });
      }

      navigate(`/admin/ai-recovery/ai-tasks/${result.task.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create AI task.";
      toast.error("Unable to create AI task", { description: message });
    } finally {
      setBusyTaskIds((current) => ({ ...current, [jobId]: false }));
    }
  }, []);

  const handleRecoveredLessonStatusChange = useCallback(async (lessonId: string, nextStatus: "approved" | "rejected") => {
    setBusyRecoveredLessonIds((current) => ({ ...current, [lessonId]: true }));

    try {
      const updatedLesson = nextStatus === "approved"
        ? await approveRecoveredLesson(lessonId)
        : await rejectRecoveredLesson(lessonId);

      setRecoveredLessons((current) => {
        if (recoveredStatusFilter === "needs_review") {
          return current.filter((lesson) => lesson.id !== lessonId);
        }
        return current.map((lesson) => (lesson.id === lessonId ? updatedLesson.lesson : lesson));
      });

      setSelectedRecoveredLesson((current) =>
        current && current.lesson.id === lessonId
          ? { ...current, lesson: updatedLesson.lesson }
          : current,
      );

      toast.success(nextStatus === "approved" ? "Recovered lesson approved" : "Recovered lesson rejected", {
        description:
          nextStatus === "approved"
            ? "Student publish is now allowed for this recovered lesson."
            : "Student publish stays blocked for this recovered lesson.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update recovered lesson review status.";
      toast.error("Recovered lesson update failed", { description: message });
    } finally {
      setBusyRecoveredLessonIds((current) => ({ ...current, [lessonId]: false }));
    }
  }, [recoveredStatusFilter]);

  const renderFailedJobsTable = () => {
    if (failedJobsLoading) {
      return <Spinner label="Loading failed jobs..." />;
    }

    if (failedJobsError) {
      return (
        <StatePanel
          title="Unable to load failed jobs"
          body={failedJobsError}
          tone="danger"
          actionLabel="Retry"
          onAction={() => void loadFailedJobs()}
        />
      );
    }

    if (failedJobs.length === 0) {
      return (
        <StatePanel
          title="No failed lesson jobs"
          body="Supabase currently returns zero rows from public.lesson_gen_queue where status = 'failed'."
        />
      );
    }

    return (
      <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Failed lesson generation jobs</h2>
            <p className="mt-1 text-sm text-muted">
              Ordered by `created_at desc` from `public.lesson_gen_queue`.
            </p>
          </div>
          <div className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
            {failedJobs.length} rows
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-low text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              <tr>
                <th className="px-4 py-3">Topic title</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Last error</th>
                <th className="px-4 py-3">Outlines count</th>
                <th className="px-4 py-3">Created at</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {failedJobs.map((job) => {
                const isBusy = !!busyTaskIds[job.job_id];
                return (
                  <tr key={job.job_id} className="border-t border-ink/10 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">{formatNullable(job.topic_title)}</div>
                      <div className="mt-1 font-mono text-xs text-muted">{job.topic_id || "No topic_id"}</div>
                    </td>
                    <td className="px-4 py-4 text-muted">{formatNullable(job.grade_name)}</td>
                    <td className="px-4 py-4 text-muted">{formatNullable(job.subject_name)}</td>
                    <td className="px-4 py-4 text-ink">{job.attempts ?? 0}</td>
                    <td className="px-4 py-4">
                      <div className="max-w-[280px] whitespace-pre-wrap break-words text-xs leading-6 text-destructive" title={job.last_error || ""}>
                        {formatNullable(job.last_error)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {job.outlines_status === "available" ? (
                        <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                          {job.outlines_count ?? 0}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          Missing table
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-muted">{formatDateTime(job.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <button
                          onClick={() => void handleOpenDiagnostics(job.job_id)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/10 px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          View Diagnostics
                        </button>
                        <button
                          onClick={() => void handleCreateTask(job.job_id)}
                          disabled={isBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-3 py-2 text-xs font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {isBusy ? "Creating..." : "Create AI Task"}
                        </button>
                        {job.existing_task ? (
                          <button
                            onClick={() => navigate(`/admin/ai-recovery/ai-tasks/${job.existing_task?.id}`)}
                            className="rounded-2xl bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            Existing task {job.existing_task.id} ({job.existing_task.status}) · Open task
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRecoveredLessonsTable = () => {
    if (recoveredLessonsLoading) {
      return <Spinner label="Loading recovered lessons..." />;
    }

    if (recoveredLessonsError) {
      return (
        <StatePanel
          title="Unable to load recovered lessons"
          body={recoveredLessonsError}
          tone="danger"
          actionLabel="Retry"
          onAction={() => void loadRecoveredLessons(recoveredStatusFilter)}
        />
      );
    }

    if (recoveredLessons.length === 0) {
      return (
        <StatePanel
          title="No recovered lessons found"
          body={`Supabase currently returns zero lessons where teaching_contract->>'status' = '${recoveredStatusFilter}'.`}
        />
      );
    }

    return (
      <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm">
        <div className="flex flex-col gap-4 border-b border-ink/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recovered lessons review queue</h2>
            <p className="mt-1 text-sm text-muted">
              Real lessons from `public.lessons` filtered by `teaching_contract-&gt;&gt;status`.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["needs_review", "approved", "rejected"] as RecoveredLessonStatus[]).map((status) => {
              const isActive = recoveredStatusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setRecoveredStatusFilter(status)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                    isActive
                      ? "border-accent bg-accent text-white"
                      : "border-ink/10 bg-paper text-muted hover:border-accent/40 hover:text-ink"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-low text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              <tr>
                <th className="px-4 py-3">Lesson title</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Blocks count</th>
                <th className="px-4 py-3">Source type</th>
                <th className="px-4 py-3">Repair reason</th>
                <th className="px-4 py-3">Student publish allowed</th>
                <th className="px-4 py-3">Created at</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recoveredLessons.map((lesson) => {
                const isBusy = !!busyRecoveredLessonIds[lesson.id];
                return (
                  <tr key={lesson.id} className="border-t border-ink/10 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">{formatNullable(lesson.lesson_title)}</div>
                      <div className="mt-1 text-xs text-muted">{formatNullable(lesson.subtitle)}</div>
                    </td>
                    <td className="px-4 py-4 text-muted">{formatNullable(lesson.grade)}</td>
                    <td className="px-4 py-4 text-muted">{formatNullable(lesson.subject)}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                        {lesson.blocks_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-muted">{formatNullable(lesson.source_type)}</td>
                    <td className="px-4 py-4">
                      <div className="max-w-[220px] whitespace-pre-wrap break-words text-xs leading-6 text-muted">
                        {formatNullable(lesson.repair_reason)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          lesson.student_publish_allowed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {lesson.student_publish_allowed ? "true" : "false"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-muted">{formatDateTime(lesson.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <button
                          onClick={() => navigate(`/admin/ai-recovery/recovered-lessons/${lesson.id}`)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/10 px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => void handleRecoveredLessonStatusChange(lesson.id, "approved")}
                          disabled={isBusy || recoveredStatusFilter === "approved"}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void handleRecoveredLessonStatusChange(lesson.id, "rejected")}
                          disabled={isBusy || recoveredStatusFilter === "rejected"}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => void handleOpenRecoveredLesson(lesson.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/10 px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
                        >
                          View Blocks
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDiagnosticsDrawer = () => {
    if (!diagnosticsLoading && !diagnosticsError && !selectedDiagnostics) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
        <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-ink/10 bg-paper shadow-2xl">
          <div className="sticky top-0 flex items-start justify-between border-b border-ink/10 bg-paper px-6 py-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Diagnostics</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Failed job details</h2>
            </div>
            <button
              onClick={handleCloseDiagnostics}
              className="rounded-full border border-ink/10 p-2 text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            {diagnosticsLoading ? <Spinner label="Loading diagnostics..." /> : null}

            {!diagnosticsLoading && diagnosticsError ? (
              <StatePanel
                title="Unable to load diagnostics"
                body={diagnosticsError}
                tone="danger"
                actionLabel="Retry"
                onAction={() => diagnosticsJobId ? void loadDiagnostics(diagnosticsJobId) : undefined}
              />
            ) : null}

            {!diagnosticsLoading && selectedDiagnostics ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Job ID</div>
                    <div className="mt-2 font-mono text-sm text-ink">{selectedDiagnostics.job_id}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Topic ID</div>
                    <div className="mt-2 font-mono text-sm text-ink">{selectedDiagnostics.topic_id || "—"}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Topic title</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedDiagnostics.topic_title)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Grade</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedDiagnostics.grade_name)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Subject</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedDiagnostics.subject_name)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Attempts</div>
                    <div className="mt-2 text-sm text-ink">{selectedDiagnostics.attempts ?? 0}</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-destructive/15 bg-destructive/5 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-destructive">Last error</div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-destructive">
                    {formatNullable(selectedDiagnostics.last_error)}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Existing lessons count</div>
                    <div className="mt-3 text-3xl font-black text-ink">{selectedDiagnostics.existing_lessons_count}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Existing lesson_blocks count</div>
                    <div className="mt-3 text-3xl font-black text-ink">
                      {selectedDiagnostics.existing_lesson_blocks_count ?? "—"}
                    </div>
                    {selectedDiagnostics.lesson_blocks_status === "missing_table" ? (
                      <p className="mt-2 text-xs text-amber-700">`lesson_blocks` table is not available in the connected database.</p>
                    ) : null}
                  </div>
                </div>

                {selectedDiagnostics.existing_task ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
                    Existing recovery task: {selectedDiagnostics.existing_task.id} ({selectedDiagnostics.existing_task.status})
                  </div>
                ) : null}

                <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">Ordered topic outlines</h3>
                      <p className="mt-1 text-sm text-muted">
                        Read-only outline data for this topic, sorted by the first available order field.
                      </p>
                    </div>
                    {selectedDiagnostics.topic_outlines_status === "available" ? (
                      <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                        {selectedDiagnostics.ordered_topic_outlines.length} rows
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Missing table
                      </span>
                    )}
                  </div>

                  {selectedDiagnostics.topic_outlines_status === "missing_table" ? (
                    <p className="mt-4 text-sm text-amber-700">
                      `topic_outlines` is not present in the connected database, so outline diagnostics are unavailable for this job.
                    </p>
                  ) : selectedDiagnostics.ordered_topic_outlines.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No topic outlines were returned for this topic.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {selectedDiagnostics.ordered_topic_outlines.map((outline, index) => (
                        <div key={`${selectedDiagnostics.job_id}-outline-${index}`} className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                          <div className="mb-3 text-sm font-semibold text-ink">
                            {outlineHeadline(outline as Record<string, unknown>, index)}
                          </div>
                          <JsonPreview value={outline as Record<string, unknown>} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-ink">Timestamps</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Created</div>
                      <div className="mt-2 text-sm text-ink">{formatDateTime(selectedDiagnostics.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Claimed</div>
                      <div className="mt-2 text-sm text-ink">{formatDateTime(selectedDiagnostics.claimed_at)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Completed</div>
                      <div className="mt-2 text-sm text-ink">{formatDateTime(selectedDiagnostics.completed_at)}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderRecoveryLogsTable = () => {
    if (recoveryLogsLoading) {
      return <Spinner label="Loading recovery logs..." />;
    }

    if (recoveryLogsError) {
      return (
        <StatePanel
          title="Unable to load recovery logs"
          body={recoveryLogsError}
          tone="danger"
          actionLabel="Retry"
          onAction={() => void loadRecoveryLogs(recoveryLogFilters)}
        />
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Event type</span>
              <select
                value={recoveryLogFilters.event_type}
                onChange={(event) => setRecoveryLogFilters((current) => ({ ...current, event_type: event.target.value }))}
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
              >
                <option value="">All events</option>
                {RECOVERY_EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">job_id</span>
              <input
                value={recoveryLogFilters.job_id}
                onChange={(event) => setRecoveryLogFilters((current) => ({ ...current, job_id: event.target.value }))}
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                placeholder="Queue job id"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">task_id</span>
              <input
                value={recoveryLogFilters.task_id}
                onChange={(event) => setRecoveryLogFilters((current) => ({ ...current, task_id: event.target.value }))}
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                placeholder="AI task id"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">lesson_id</span>
              <input
                value={recoveryLogFilters.lesson_id}
                onChange={(event) => setRecoveryLogFilters((current) => ({ ...current, lesson_id: event.target.value }))}
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                placeholder="Lesson id"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Date</span>
              <input
                type="date"
                value={recoveryLogFilters.date}
                onChange={(event) => setRecoveryLogFilters((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
              />
            </label>
          </div>
        </div>

        {recoveryLogs.length === 0 ? (
          <StatePanel
            title="No recovery logs found"
            body="No recovery events matched the current filters across ai_task_logs, ai_tasks.logs, and error_recovery_log."
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">AI Recovery event stream</h2>
                <p className="mt-1 text-sm text-muted">
                  Aggregated from `ai_task_logs`, mirrored `ai_tasks.logs`, and `public.error_recovery_log` when available.
                </p>
              </div>
              <div className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                {recoveryLogs.length} events
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-low text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Task / Job / Lesson</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recoveryLogs.map((entry) => (
                    <tr key={entry.id} className="border-t border-ink/10 align-top">
                      <td className="px-4 py-4 text-xs text-muted">{formatDateTime(entry.timestamp)}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                          {entry.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-[320px] whitespace-pre-wrap break-words text-sm text-ink">{entry.message}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1 text-xs text-muted">
                          <div><span className="font-semibold text-ink">task:</span> {entry.task_id || "—"}</div>
                          <div><span className="font-semibold text-ink">job:</span> {entry.job_id || "—"}</div>
                          <div><span className="font-semibold text-ink">lesson:</span> {entry.lesson_id || "—"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted">{entry.actor_user_id || "—"}</td>
                      <td className="px-4 py-4 text-xs text-muted">{entry.source}</td>
                      <td className="px-4 py-4">
                        <div className="max-w-[360px]">
                          <JsonPreview value={entry.details} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRecoveredLessonDrawer = () => {
    if (!recoveredLessonLoading && !recoveredLessonError && !selectedRecoveredLesson) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
        <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-ink/10 bg-paper shadow-2xl">
          <div className="sticky top-0 flex items-start justify-between border-b border-ink/10 bg-paper px-6 py-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Recovered Lesson</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Review queue detail</h2>
            </div>
            <button
              onClick={handleCloseRecoveredLesson}
              className="rounded-full border border-ink/10 p-2 text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            {recoveredLessonLoading ? <Spinner label="Loading recovered lesson..." /> : null}

            {!recoveredLessonLoading && recoveredLessonError ? (
              <StatePanel
                title="Unable to load recovered lesson"
                body={recoveredLessonError}
                tone="danger"
                actionLabel="Retry"
                onAction={() => reviewLessonId ? void loadRecoveredLessonDetail(reviewLessonId) : undefined}
              />
            ) : null}

            {!recoveredLessonLoading && selectedRecoveredLesson ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Lesson title</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedRecoveredLesson.lesson.lesson_title)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Topic</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedRecoveredLesson.lesson.topic_title)}</div>
                    <div className="mt-1 font-mono text-xs text-muted">{selectedRecoveredLesson.lesson.topic_id || "—"}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Grade</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedRecoveredLesson.lesson.grade)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Subject</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedRecoveredLesson.lesson.subject)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Source type</div>
                    <div className="mt-2 text-sm text-ink">{formatNullable(selectedRecoveredLesson.lesson.source_type)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Student publish allowed</div>
                    <div className="mt-2 text-sm text-ink">{selectedRecoveredLesson.lesson.student_publish_allowed ? "true" : "false"}</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Teaching contract</div>
                  <div className="mt-4">
                    <JsonPreview value={selectedRecoveredLesson.lesson.teaching_contract} />
                  </div>
                </div>

                <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">Blocks</h3>
                      <p className="mt-1 text-sm text-muted">
                        Read-only review of the recovered lesson blocks. Student publish remains blocked by default.
                      </p>
                    </div>
                    <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                      {selectedRecoveredLesson.lesson.blocks_count} blocks
                    </span>
                  </div>

                  {selectedRecoveredLesson.blocks_status === "missing_table" ? (
                    <p className="mt-4 text-sm text-amber-700">`lesson_blocks` is not available in the connected database.</p>
                  ) : selectedRecoveredLesson.blocks.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No lesson blocks were returned for this lesson.</p>
                  ) : (
                    <div className="mt-4">
                      <JsonPreview value={{ blocks: selectedRecoveredLesson.blocks }} />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => void handleRecoveredLessonStatusChange(selectedRecoveredLesson.lesson.id, "approved")}
                    disabled={!!busyRecoveredLessonIds[selectedRecoveredLesson.lesson.id]}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void handleRecoveredLessonStatusChange(selectedRecoveredLesson.lesson.id, "rejected")}
                    disabled={!!busyRecoveredLessonIds[selectedRecoveredLesson.lesson.id]}
                    className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderRouteShell = () => {
    switch (activeTab.key) {
      case "dashboard":
        return (
          <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">Recovery overview</h2>
            <p className="mt-2 text-sm text-muted">
              This dashboard is intentionally read-only for now. It surfaces the live recovery backlog and review load
              without enabling AI SQL generation or repair actions yet.
            </p>
          </div>
        );
      case "failed-jobs":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <h2 className="text-xl font-semibold text-ink">Failed lesson jobs</h2>
              </div>
              <p className="mt-3 text-sm text-muted">
                Real queue failures from `public.lesson_gen_queue`, with topic metadata, outline counts, diagnostics,
                and duplicate-safe AI task creation.
              </p>
            </div>
            {renderFailedJobsTable()}
          </div>
        );
      case "ai-tasks":
        return (
          <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold text-ink">Lesson generation AI tasks</h2>
            </div>
            <p className="mt-3 text-sm text-muted">
              Pending: {kpis.pendingAiTasks}. Completed: {kpis.completedAiTasks}. These counts come from
              `public.ai_tasks` filtered to `target_area = 'lesson_generation'`.
            </p>
          </div>
        );
      case "recovered-lessons":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-semibold text-ink">Recovered lesson review queue</h2>
              </div>
              <p className="mt-3 text-sm text-muted">
                Needs review lessons are shown by default, with review-state filters for approved and rejected rows.
                Approval sets `student_publish_allowed = true`, while rejection keeps the recovered lesson blocked from
                students.
              </p>
            </div>
            {renderRecoveredLessonsTable()}
          </div>
        );
      case "logs":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-muted" />
                <h2 className="text-xl font-semibold text-ink">Recovery logs and observability</h2>
              </div>
              <p className="mt-3 text-sm text-muted">
                Critical AI recovery events are logged here so admins can trace task creation, SQL generation, safety
                checks, execution, and recovered lesson review actions.
              </p>
            </div>
            {renderRecoveryLogsTable()}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <SEO
        title="Admin AI Recovery"
        description="Admin-only AI Recovery dashboard with live Supabase metrics for failed jobs, AI tasks, and recovered lesson review states."
      />

      <section className="space-y-6">
        <div className="rounded-[28px] border border-ink/10 bg-paper p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">Admin only</div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-ink">AI Recovery</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Live recovery monitoring for lesson generation failures, lesson-generation AI task throughput, and
                  recovered lesson review states. Counts come directly from Supabase and this shell does not enable any
                  AI SQL generation yet.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <button
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
              >
                <RefreshCw className={`h-4 w-4 ${loading || failedJobsLoading ? "animate-spin" : ""}`} />
                Refresh metrics
              </button>
              {lastUpdated ? <p className="text-xs text-muted">Last updated {lastUpdated}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {RECOVERY_TABS.map((tab) => {
            const isActive = activeTab.key === tab.key;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "border-accent bg-accent text-white shadow-lg shadow-accent/20"
                    : "border-ink/10 bg-paper text-muted hover:border-accent/40 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl border border-ink/10 bg-paper px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-ink">{activeTab.label}</p>
          <p className="mt-1 text-sm text-muted">{activeTab.description}</p>
        </div>

        {loading ? <Spinner label="Loading AI Recovery metrics..." /> : null}

        {!loading && error ? (
          <StatePanel
            title="Unable to load AI Recovery metrics"
            body={error}
            tone="danger"
            actionLabel="Retry"
            onAction={() => void loadMetrics()}
          />
        ) : null}

        {!loading && !error ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="Failed jobs"
                value={kpis.failedJobs}
                description="lesson_gen_queue rows where status = 'failed'"
                tone="danger"
              />
              <KpiCard
                label="Pending AI tasks"
                value={kpis.pendingAiTasks}
                description="ai_tasks rows where target_area = 'lesson_generation' and status = 'pending'"
                tone="warning"
              />
              <KpiCard
                label="Completed AI tasks"
                value={kpis.completedAiTasks}
                description="ai_tasks rows where target_area = 'lesson_generation' and status = 'completed'"
                tone="success"
              />
              <KpiCard
                label="Lessons needing review"
                value={kpis.lessonsNeedingReview}
                description="lessons where teaching_contract->>'status' = 'needs_review'"
                tone="warning"
              />
              <KpiCard
                label="Approved recovered lessons"
                value={kpis.approvedRecoveredLessons}
                description="lessons where teaching_contract->>'status' = 'approved'"
                tone="success"
              />
              <KpiCard
                label="Rejected recovered lessons"
                value={kpis.rejectedRecoveredLessons}
                description="lessons where teaching_contract->>'status' = 'rejected'"
                tone="danger"
              />
            </div>

            {totalSignals === 0 ? (
              <StatePanel
                title="No recovery activity yet"
                body="Supabase returned zero rows across the current recovery KPI queries, so there is no failed, pending, completed, or review-state recovery activity to show right now."
              />
            ) : null}

            {renderRouteShell()}
          </>
        ) : null}
      </section>

      {renderDiagnosticsDrawer()}
      {renderRecoveredLessonDrawer()}
    </Layout>
  );
};
