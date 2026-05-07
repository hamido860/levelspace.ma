import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  XCircle,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import {
  AiRecoveryTaskDetail,
  approveAiRecoveryExecution,
  copyAiRecoverySql,
  executeAiRecoverySql,
  generateAiRecoverySql,
  getAiRecoveryTaskDetail,
  rejectAiRecoverySql,
  resetAiRecoveryTask,
  runAiRecoverySafetyCheck,
} from "../services/adminAiRecoveryService";

const RECOVERY_TABS = [
  { label: "Dashboard", path: "/admin/ai-recovery" },
  { label: "Failed Jobs", path: "/admin/ai-recovery/failed-jobs" },
  { label: "AI Tasks", path: "/admin/ai-recovery/ai-tasks" },
  { label: "Recovered Lessons", path: "/admin/ai-recovery/recovered-lessons" },
  { label: "Logs", path: "/admin/ai-recovery/logs" },
];

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

const SectionCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
    {children}
  </section>
);

const JsonPreview: React.FC<{ value: unknown }> = ({ value }) => (
  <pre className="overflow-x-auto rounded-2xl bg-surface-low p-4 text-xs leading-6 text-ink/80">
    {JSON.stringify(value, null, 2)}
  </pre>
);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatText = (value: string | null | undefined) => {
  const text = String(value || "").trim();
  return text || "—";
};

const formatStatusTone = (value: string | null | undefined) => {
  const status = String(value || "").toLowerCase();
  if (["approved", "completed", "success", "passed"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["blocked", "failed", "rejected", "error"].includes(status)) return "bg-destructive/10 text-destructive";
  if (["pending", "planning", "waiting_approval", "running", "validating"].includes(status)) return "bg-amber-50 text-amber-700";
  return "bg-surface-low text-ink";
};

export const AdminAiRecoveryTaskDetail: React.FC = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();

  const [detail, setDetail] = useState<AiRecoveryTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const safetyAllowed = detail?.safety_check?.allowed === true;
  const safetyErrors = Array.isArray(detail?.safety_check?.errors)
    ? detail?.safety_check?.errors.map((value) => String(value))
    : [];
  const safetyWarnings = Array.isArray(detail?.safety_check?.warnings)
    ? detail?.safety_check?.warnings.map((value) => String(value))
    : [];
  const latestApprovalStatus = String(detail?.latest_approval?.status || "").toLowerCase();
  const executeAllowed = safetyAllowed && latestApprovalStatus === "approved" && Boolean(detail?.generated_sql);

  const lessonBlocksByLessonId = useMemo(() => {
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    (detail?.lesson_blocks || []).forEach((block) => {
      const lessonId = typeof block.lesson_id === "string" ? block.lesson_id : null;
      if (!lessonId) return;
      const current = grouped.get(lessonId) || [];
      current.push(block);
      grouped.set(lessonId, current);
    });
    return grouped;
  }, [detail?.lesson_blocks]);

  const loadDetail = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError("");

    try {
      const nextDetail = await getAiRecoveryTaskDetail(taskId);
      setDetail(nextDetail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load AI recovery task detail.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const runAction = useCallback(async (actionKey: string, work: () => Promise<AiRecoveryTaskDetail | void>) => {
    setBusyAction(actionKey);
    try {
      const nextDetail = await work();
      if (nextDetail) {
        setDetail(nextDetail);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete the AI recovery action.";
      toast.error("AI Recovery action failed", { description: message });
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleGenerateSql = useCallback(async () => {
    await runAction("generate-sql", async () => {
      const response = await generateAiRecoverySql(taskId!);
      toast.success("Repair SQL preview generated.");
      return response.detail;
    });
  }, [runAction, taskId]);

  const handleSafetyCheck = useCallback(async () => {
    await runAction("safety-check", async () => {
      const response = await runAiRecoverySafetyCheck(taskId!);
      toast.success("Safety check completed.");
      return response.detail;
    });
  }, [runAction, taskId]);

  const handleApproveExecute = useCallback(async () => {
    await runAction("approve-execute", async () => {
      const response = await approveAiRecoveryExecution(taskId!);
      toast.success("Execution approved.");
      return response.detail;
    });
  }, [runAction, taskId]);

  const handleExecuteSql = useCallback(async () => {
    await runAction("execute", async () => {
      const response = await executeAiRecoverySql(taskId!);
      toast.success("Approved recovery SQL executed on the server.");
      return response.detail;
    });
  }, [runAction, taskId]);

  const handleRejectSql = useCallback(async () => {
    await runAction("reject-sql", async () => {
      const response = await rejectAiRecoverySql(taskId!);
      toast.success("SQL preview rejected.");
      return response.detail;
    });
  }, [runAction, taskId]);

  const handleCopySql = useCallback(async () => {
    await runAction("copy-sql", async () => {
      const response = await copyAiRecoverySql(taskId!);
      await navigator.clipboard.writeText(response.sql);
      toast.success("SQL preview copied.");
    });
  }, [runAction, taskId]);

  const handleResetTask = useCallback(async () => {
    await runAction("reset", async () => {
      const response = await resetAiRecoveryTask(taskId!);
      toast.success("Task reset to pending.");
      return response.detail;
    });
  }, [runAction, taskId]);

  return (
    <Layout>
      <SEO
        title="AI Recovery Task Detail"
        description="Admin-only AI Recovery task detail with failed-job diagnostics, outline context, lesson state, SQL preview, safety checks, and execution logs."
      />

      <section className="space-y-6">
        <div className="rounded-[28px] border border-ink/10 bg-paper p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <button
                onClick={() => navigate("/admin/ai-recovery/ai-tasks")}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to AI Tasks
              </button>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">Admin only</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">AI Recovery Task Detail</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Full diagnostic context for a single lesson-generation recovery task. Recovered lesson content stays
                  blocked until a human reviews the SQL preview and explicitly approves the guarded execution path.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadDetail()}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={() => void handleGenerateSql()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TerminalSquare className="h-4 w-4" />
                Generate Repair SQL
              </button>
              <button
                onClick={() => void handleSafetyCheck()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldAlert className="h-4 w-4" />
                Run Safety Check
              </button>
              <button
                onClick={() => void handleApproveExecute()}
                disabled={busyAction !== null || !safetyAllowed}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve Execute
              </button>
              <button
                onClick={() => void handleExecuteSql()}
                disabled={busyAction !== null || !executeAllowed}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TerminalSquare className="h-4 w-4" />
                Execute Approved SQL
              </button>
              <button
                onClick={() => void handleRejectSql()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Reject SQL
              </button>
              <button
                onClick={() => void handleCopySql()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy SQL
              </button>
              <button
                onClick={() => void handleResetTask()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${busyAction === "reset" ? "animate-spin" : ""}`} />
                Reset Task
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {RECOVERY_TABS.map((tab) => {
            const isActive = tab.path === "/admin/ai-recovery/ai-tasks";
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

        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          Recovered lesson content stays blocked until a human approves the guarded execution path. This page never runs
          SQL directly from the client.
        </div>

        {!loading && !error && detail && !safetyAllowed ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive shadow-sm">
            Approve Execute stays disabled until the latest stored safety check returns <span className="font-semibold">allowed = true</span>.
          </div>
        ) : null}

        {!loading && !error && detail && safetyAllowed && latestApprovalStatus !== "approved" ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
            Execute Approved SQL stays disabled until a human approval record reaches <span className="font-semibold">approved</span>.
          </div>
        ) : null}

        {loading ? <Spinner label="Loading AI recovery task detail..." /> : null}

        {!loading && error ? (
          <StatePanel
            title="Unable to load AI recovery task detail"
            body={error}
            tone="danger"
            actionLabel="Retry"
            onAction={() => void loadDetail()}
          />
        ) : null}

        {!loading && !error && detail ? (
          <>
            <SectionCard
              title="1. Task Summary"
              description="Current task identity, workflow state, and approval readiness."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Task</div>
                  <div className="mt-2 text-sm font-semibold text-ink">{formatText(detail.task.title || detail.task.task_name)}</div>
                  <div className="mt-1 font-mono text-xs text-muted">{detail.task.id}</div>
                </div>
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Status</div>
                  <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${formatStatusTone(detail.task.status)}`}>
                    {detail.task.status}
                  </div>
                  <div className="mt-2 text-xs text-muted">Progress {detail.task.progress ?? 0}%</div>
                </div>
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Priority</div>
                  <div className="mt-2 text-sm text-ink">{formatText(detail.task.priority)}</div>
                  <div className="mt-2 text-xs text-muted">Target {formatText(detail.task.target_area)}</div>
                </div>
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Approval</div>
                  <div className="mt-2 text-sm text-ink">{detail.task.requires_approval ? "Required" : "Not required"}</div>
                  <div className="mt-2 text-xs text-muted">Latest approval {formatText(String(detail.latest_approval?.status || "none"))}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-ink/10 bg-paper p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Instructions</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{formatText(detail.task.instructions)}</p>
                </div>
                <div className="rounded-3xl border border-ink/10 bg-paper p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Timestamps</div>
                  <div className="mt-3 space-y-2 text-sm text-ink">
                    <p>Created: {formatDateTime(detail.task.created_at)}</p>
                    <p>Updated: {formatDateTime(detail.task.updated_at)}</p>
                    <p>Started: {formatDateTime(detail.task.started_at)}</p>
                    <p>Completed: {formatDateTime(detail.task.completed_at)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="2. Failed Job Diagnostic"
              description="Linked queue row and failure context for the lesson generation job."
            >
              {detail.queue_job ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Job ID</div>
                    <div className="mt-2 font-mono text-sm text-ink">{detail.queue_job.id}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Topic</div>
                    <div className="mt-2 text-sm text-ink">{formatText(detail.topic?.title)}</div>
                    <div className="mt-1 font-mono text-xs text-muted">{detail.topic?.id || detail.queue_job.topic_id || "—"}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Grade / Subject</div>
                    <div className="mt-2 text-sm text-ink">{formatText(detail.grade?.name)}</div>
                    <div className="mt-1 text-xs text-muted">{formatText(detail.subject?.name)}</div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Attempts</div>
                    <div className="mt-2 text-sm text-ink">{detail.queue_job.attempts ?? 0}</div>
                    <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${formatStatusTone(detail.queue_job.status)}`}>
                      {formatText(detail.queue_job.status)}
                    </div>
                  </div>
                  <div className="md:col-span-2 xl:col-span-4 rounded-3xl border border-destructive/15 bg-destructive/5 p-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-destructive">Last error</div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-destructive">
                      {formatText(detail.queue_job.last_error)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No linked `lesson_gen_queue` row was found for this task.</p>
              )}
            </SectionCard>

            <SectionCard
              title="3. Topic Outlines"
              description="Read-only outline context for the topic behind this recovery workflow."
            >
              {detail.topic_outlines_status === "missing_table" ? (
                <p className="text-sm text-amber-700">`topic_outlines` is not available in the connected database.</p>
              ) : detail.ordered_topic_outlines.length === 0 ? (
                <p className="text-sm text-muted">No topic outlines were returned for this topic.</p>
              ) : (
                <div className="space-y-4">
                  {detail.ordered_topic_outlines.map((outline, index) => (
                    <div key={`${detail.task.id}-outline-${index}`} className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="mb-3 text-sm font-semibold text-ink">
                        {String((outline.title || outline.name || outline.heading || `Outline ${index + 1}`) as string)}
                      </div>
                      <JsonPreview value={outline} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="4. Existing Lesson State"
              description="Any existing lessons for the same topic and the current lesson_blocks footprint."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Existing lessons</div>
                  <div className="mt-3 text-3xl font-black text-ink">{detail.existing_lessons.length}</div>
                </div>
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Existing lesson_blocks</div>
                  <div className="mt-3 text-3xl font-black text-ink">
                    {detail.lesson_blocks_status === "missing_table" ? "—" : detail.lesson_blocks.length}
                  </div>
                  {detail.lesson_blocks_status === "missing_table" ? (
                    <p className="mt-2 text-xs text-amber-700">`lesson_blocks` table is not available in the connected database.</p>
                  ) : null}
                </div>
              </div>

              {detail.existing_lessons.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No existing lessons were found for this topic.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {detail.existing_lessons.map((lesson, lessonIndex) => {
                    const lessonId = typeof lesson.id === "string" ? lesson.id : "";
                    const blocks = lessonBlocksByLessonId.get(lessonId) || [];
                    return (
                      <div key={lessonId || `lesson-${lessonIndex}`} className="rounded-3xl border border-ink/10 bg-paper p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-ink">
                              {formatText(String(lesson.lesson_title || lesson.title || "Untitled lesson"))}
                            </h3>
                            <p className="mt-1 text-xs text-muted">
                              {lessonId || "No lesson id"} · {formatDateTime(typeof lesson.created_at === "string" ? lesson.created_at : null)}
                            </p>
                          </div>
                          <div className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                            {blocks.length} lesson_blocks
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Teaching contract</div>
                            <JsonPreview value={lesson.teaching_contract || {}} />
                          </div>
                          <div>
                            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Lesson blocks</div>
                            {detail.lesson_blocks_status === "missing_table" ? (
                              <p className="text-sm text-amber-700">Lesson block diagnostics are unavailable because the table is missing.</p>
                            ) : blocks.length === 0 ? (
                              <p className="text-sm text-muted">No lesson blocks were returned for this lesson.</p>
                            ) : (
                              <JsonPreview value={blocks} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="5. AI Generated SQL Preview"
              description="Server-generated preview only. This page never executes SQL directly from the browser."
            >
              {detail.generated_sql ? (
                <pre className="overflow-x-auto rounded-2xl bg-surface-low p-4 text-xs leading-6 text-ink/80">
                  {detail.generated_sql}
                </pre>
              ) : (
                <p className="text-sm text-muted">No SQL preview is stored yet. Use “Generate Repair SQL” to create one.</p>
              )}
            </SectionCard>

            <SectionCard
              title="6. Safety Check Result"
              description="Latest guarded review of the stored SQL preview."
            >
              {detail.safety_check ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Allowed</div>
                      <div className="mt-2 text-sm text-ink">{String(Boolean(detail.safety_check.allowed))}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Errors</div>
                      <div className="mt-2 text-sm text-ink">{safetyErrors.length}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Warnings</div>
                      <div className="mt-2 text-sm text-ink">{safetyWarnings.length}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Checked at</div>
                      <div className="mt-2 text-sm text-ink">{formatDateTime(typeof detail.safety_check.executed_at === "string" ? detail.safety_check.executed_at : null)}</div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-ink/10 bg-paper p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Summary</div>
                    <p className="mt-3 text-sm leading-6 text-ink">{formatText(String(detail.safety_check.summary || "—"))}</p>
                  </div>
                  {safetyErrors.length > 0 ? (
                    <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-destructive">Errors</div>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-destructive">
                        {safetyErrors.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {safetyWarnings.length > 0 ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800">Warnings</div>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-800">
                        {safetyWarnings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <JsonPreview value={detail.safety_check} />
                </div>
              ) : (
                <p className="text-sm text-muted">No safety check result is stored yet. Use “Run Safety Check” to generate one.</p>
              )}
            </SectionCard>

            <SectionCard
              title="7. Execution Logs"
              description="Stored task result plus structured AI task logs."
            >
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Task result</div>
                  <JsonPreview value={detail.task.result} />
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Logs</div>
                  {detail.logs.length === 0 ? (
                    <p className="text-sm text-muted">No task logs were returned for this task yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.logs.map((log) => (
                        <div key={log.id} className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-ink">
                                {log.agent_name} · {log.log_type}
                              </div>
                              <div className="mt-1 text-xs text-muted">{formatDateTime(log.created_at)}</div>
                            </div>
                            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${formatStatusTone(log.log_type)}`}>
                              {log.log_type}
                            </div>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{log.message}</p>
                          {Object.keys(log.metadata || {}).length > 0 ? (
                            <div className="mt-3">
                              <JsonPreview value={log.metadata} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          </>
        ) : null}
      </section>
    </Layout>
  );
};
