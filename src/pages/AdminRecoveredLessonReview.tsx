import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ClipboardCopy,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { Modal } from "../components/Modal";
import { SEO } from "../components/SEO";
import {
  AiRecoveryRecoveredLessonDetail,
  approveRecoveredLesson,
  getAiRecoveryRecoveredLessonDetail,
  rejectRecoveredLesson,
  saveRecoveredLessonEdits,
  sendRecoveredLessonBackToAi,
} from "../services/adminAiRecoveryService";
import { normalizeLessonBlockUiType } from "../services/lessonRecovery";

type EditableLessonBlock = {
  id?: string;
  type: "text" | "example" | "formula" | "summary";
  title: string;
  content: string;
  order_index: number;
};

type ConfirmAction = "approve" | "reject" | null;

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

const toEditableBlocks = (detail: AiRecoveryRecoveredLessonDetail | null): EditableLessonBlock[] => {
  if (!detail) return [];

  const lessonBlocks = Array.isArray(detail.lesson_row?.blocks) ? detail.lesson_row.blocks : [];
  const sourceBlocks = lessonBlocks.length > 0 ? lessonBlocks : detail.blocks;

  return (Array.isArray(sourceBlocks) ? sourceBlocks : [])
    .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object" && !Array.isArray(block))
    .map((block, index) => ({
      id: typeof block.id === "string" ? block.id : undefined,
      type: normalizeLessonBlockUiType(typeof block.type === "string" ? block.type : ""),
      title: typeof block.title === "string" ? block.title : "",
      content: typeof block.content === "string" ? block.content : "",
      order_index: Number.isFinite(Number(block.order_index))
        ? Number(block.order_index)
        : Number.isFinite(Number(block.order))
          ? Number(block.order)
          : index,
    }))
    .sort((left, right) => left.order_index - right.order_index)
    .map((block, index) => ({ ...block, order_index: index }));
};

const isPlaceholderContent = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    "todo",
    "tbd",
    "placeholder",
    "example",
    "lorem ipsum",
    "coming soon",
    "insert content",
    "replace me",
  ].some((marker) => normalized.includes(marker));
};

export const AdminRecoveredLessonReview: React.FC = () => {
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();

  const [detail, setDetail] = useState<AiRecoveryRecoveredLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const [lessonTitle, setLessonTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [editableBlocks, setEditableBlocks] = useState<EditableLessonBlock[]>([]);

  const loadDetail = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setError("");

    try {
      const nextDetail = await getAiRecoveryRecoveredLessonDetail(lessonId);
      setDetail(nextDetail);
      setLessonTitle(nextDetail.lesson.lesson_title || "");
      setSubtitle(nextDetail.lesson.subtitle || "");
      setEditableBlocks(toEditableBlocks(nextDetail));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load recovered lesson review detail.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const runAction = useCallback(async (actionKey: string, work: () => Promise<void>) => {
    setBusyAction(actionKey);
    try {
      await work();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete the recovered lesson action.";
      toast.error("Recovered lesson action failed", { description: message });
    } finally {
      setBusyAction(null);
    }
  }, []);

  const approvalWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (!lessonTitle.trim()) {
      warnings.push("Lesson title is empty.");
    }

    if (editableBlocks.length === 0) {
      warnings.push("No lesson blocks are present.");
    }

    if (editableBlocks.some((block) => isPlaceholderContent(block.content))) {
      warnings.push("One or more blocks still look empty or placeholder-based.");
    }

    return warnings;
  }, [editableBlocks, lessonTitle]);

  const lessonJsonPreview = useMemo(() => {
    if (!detail) return {};

    return {
      ...(detail.lesson_row || {}),
      lesson_title: lessonTitle,
      title: lessonTitle,
      subtitle,
      blocks: editableBlocks.map((block, index) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        content: block.content,
        order_index: index,
      })),
      teaching_contract: {
        ...detail.lesson.teaching_contract,
        status: "needs_review",
        student_publish_allowed: false,
      },
    };
  }, [detail, editableBlocks, lessonTitle, subtitle]);

  const updateBlock = useCallback((index: number, patch: Partial<EditableLessonBlock>) => {
    setEditableBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block,
      ),
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!lessonId) return;

    await runAction("save", async () => {
      const response = await saveRecoveredLessonEdits(lessonId, {
        lesson_title: lessonTitle,
        subtitle,
        blocks: editableBlocks.map((block, index) => ({
          id: block.id,
          type: block.type,
          title: block.title,
          content: block.content,
          order_index: index,
        })),
      });

      setDetail(response.detail);
      setLessonTitle(response.detail.lesson.lesson_title || "");
      setSubtitle(response.detail.lesson.subtitle || "");
      setEditableBlocks(toEditableBlocks(response.detail));
      toast.success("Recovered lesson edits saved.", {
        description: "The lesson remains blocked for students until a human approval decision is made.",
      });
    });
  }, [editableBlocks, lessonId, lessonTitle, runAction, subtitle]);

  const handleApprove = useCallback(async () => {
    if (!lessonId) return;

    await runAction("approve", async () => {
      await approveRecoveredLesson(lessonId);
      await loadDetail();
      setConfirmAction(null);
      toast.success("Recovered lesson approved for students.", {
        description: "teaching_contract.status is now approved and student_publish_allowed is true.",
      });
    });
  }, [lessonId, loadDetail, runAction]);

  const handleReject = useCallback(async () => {
    if (!lessonId) return;

    await runAction("reject", async () => {
      await rejectRecoveredLesson(lessonId);
      await loadDetail();
      setConfirmAction(null);
      toast.success("Recovered lesson rejected.", {
        description: "Student publish stays blocked and the lesson remains hidden from students.",
      });
    });
  }, [lessonId, loadDetail, runAction]);

  const handleSendBackToAi = useCallback(async () => {
    if (!lessonId) return;

    await runAction("send-back", async () => {
      const response = await sendRecoveredLessonBackToAi(lessonId);
      setDetail(response.detail);
      toast.success("Recovered lesson sent back to AI.", {
        description: `Task ${String(response.task.id || "")} is ready for another repair pass.`,
      });
      if (typeof response.task.id === "string") {
        navigate(`/admin/ai-recovery/ai-tasks/${response.task.id}`);
      }
    });
  }, [lessonId, navigate, runAction]);

  const handleCopyJson = useCallback(async () => {
    await runAction("copy-json", async () => {
      await navigator.clipboard.writeText(JSON.stringify(lessonJsonPreview, null, 2));
      toast.success("Lesson JSON copied.");
    });
  }, [lessonJsonPreview, runAction]);

  return (
    <Layout>
      <SEO
        title="Recovered Lesson Review"
        description="Admin-only recovered lesson review page with block editing, student preview, approval, rejection, and AI handoff actions."
      />

      <section className="space-y-6">
        <div className="rounded-[28px] border border-ink/10 bg-paper p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <button
                onClick={() => navigate("/admin/ai-recovery/recovered-lessons")}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Recovered Lessons
              </button>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">Admin only</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Recovered Lesson Review</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Review, edit, and approve AI-recovered lesson content. Recovered lesson content stays blocked from
                  students until a human reviewer explicitly approves it.
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
                onClick={() => void handleCopyJson()}
                disabled={!detail || busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy Lesson JSON
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {RECOVERY_TABS.map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                tab.path === "/admin/ai-recovery/recovered-lessons"
                  ? "border-accent bg-accent text-white shadow-lg shadow-accent/20"
                  : "border-ink/10 bg-paper text-muted hover:border-accent/40 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? <Spinner label="Loading recovered lesson review..." /> : null}

        {!loading && error ? (
          <StatePanel
            title="Unable to load recovered lesson review"
            body={error}
            tone="danger"
            actionLabel="Retry"
            onAction={() => void loadDetail()}
          />
        ) : null}

        {!loading && !error && detail ? (
          <>
            <StatePanel
              title="Human approval required"
              body="Recovered lesson content stays blocked from students until a human reviewer approves it. Save edits keeps status = needs_review and student_publish_allowed = false."
            />

            <SectionCard title="Lesson Metadata" description="Supabase-backed lesson status, source links, and recovery contract context.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Lesson id</div>
                  <div className="mt-2 break-all font-mono text-xs text-ink">{detail.lesson.id}</div>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Status</div>
                  <div className="mt-2 text-sm text-ink">{formatText(String(detail.lesson.teaching_contract.status || ""))}</div>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Student publish allowed</div>
                  <div className="mt-2 text-sm text-ink">{detail.lesson.student_publish_allowed ? "true" : "false"}</div>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-surface-low p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Created at</div>
                  <div className="mt-2 text-sm text-ink">{formatDateTime(detail.lesson.created_at)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-ink/10 bg-paper p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Linked source job</div>
                  {detail.source_job ? (
                    <div className="mt-3 space-y-2 text-sm text-ink">
                      <div className="font-mono text-xs">{formatText(String(detail.source_job.id || ""))}</div>
                      <div>Status: {formatText(String(detail.source_job.status || ""))}</div>
                      <div>Attempts: {formatText(String(detail.source_job.attempts || ""))}</div>
                      <div className="text-xs text-muted">{formatText(String(detail.source_job.last_error || ""))}</div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No source job is linked in teaching_contract.source_job_id.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-ink/10 bg-paper p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Linked source task</div>
                  {detail.source_task ? (
                    <div className="mt-3 space-y-2 text-sm text-ink">
                      <div className="font-mono text-xs">{formatText(String(detail.source_task.id || ""))}</div>
                      <div>Status: {formatText(String(detail.source_task.status || ""))}</div>
                      <div>Progress: {formatText(String(detail.source_task.progress || ""))}</div>
                      <button
                        onClick={() => navigate(`/admin/ai-recovery/ai-tasks/${String(detail.source_task?.id || "")}`)}
                        className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Open AI task
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No source task is linked in teaching_contract.source_task_id.</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Teaching contract</div>
                <div className="mt-3">
                  <JsonPreview value={detail.lesson.teaching_contract} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Review Actions" description="Every action is server-side only. No SQL or approval logic runs from the browser.">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void handleSave()}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {busyAction === "save" ? "Saving..." : "Save edits"}
                </button>
                <button
                  onClick={() => setConfirmAction("approve")}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve for students
                </button>
                <button
                  onClick={() => setConfirmAction("reject")}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={() => void handleSendBackToAi()}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {busyAction === "send-back" ? "Sending..." : "Send back to AI"}
                </button>
              </div>

              {approvalWarnings.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold">Approval warning</p>
                      <p>Empty or placeholder content was detected. Review carefully before approving for students.</p>
                      <ul className="list-disc pl-5">
                        {approvalWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Editable Lesson Content" description="Editing keeps the lesson in needs_review and keeps student_publish_allowed = false until approval.">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Lesson title</span>
                    <input
                      value={lessonTitle}
                      onChange={(event) => setLessonTitle(event.target.value)}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Subtitle</span>
                    <input
                      value={subtitle}
                      onChange={(event) => setSubtitle(event.target.value)}
                      className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                    />
                  </label>
                </div>

                {editableBlocks.length === 0 ? (
                  <StatePanel
                    title="No editable blocks found"
                    body="The lesson row did not return any lesson blocks or canonical lessons.blocks content to edit."
                  />
                ) : (
                  <div className="space-y-4">
                    {editableBlocks.map((block, index) => (
                      <div key={block.id || `block-${index}`} className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Block {index + 1}</div>
                            <div className="mt-1 text-sm text-ink">Allowed UI types only: text, example, formula, summary.</div>
                          </div>
                          <select
                            value={block.type}
                            onChange={(event) => updateBlock(index, { type: normalizeLessonBlockUiType(event.target.value) })}
                            className="rounded-full border border-ink/10 bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                          >
                            <option value="text">text</option>
                            <option value="example">example</option>
                            <option value="formula">formula</option>
                            <option value="summary">summary</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <input
                            value={block.title}
                            onChange={(event) => updateBlock(index, { title: event.target.value })}
                            placeholder="Block title"
                            className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                          />
                          <textarea
                            value={block.content}
                            onChange={(event) => updateBlock(index, { content: event.target.value })}
                            rows={8}
                            placeholder="Block content"
                            className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent/40"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Full Lesson JSON Preview" description="This is the JSON payload currently staged from your edits before any save or approval call.">
              <JsonPreview value={lessonJsonPreview} />
            </SectionCard>

            <SectionCard title="Ordered lesson_blocks" description="Direct lesson_blocks rows returned from Supabase, ordered by the first available order field.">
              {detail.blocks_status === "missing_table" ? (
                <StatePanel
                  title="lesson_blocks table unavailable"
                  body="The connected database does not expose public.lesson_blocks, so only lessons.blocks editing is available here."
                />
              ) : detail.blocks.length === 0 ? (
                <StatePanel
                  title="No lesson_blocks rows returned"
                  body="Supabase returned zero lesson_blocks rows for this lesson."
                />
              ) : (
                <JsonPreview value={detail.blocks} />
              )}
            </SectionCard>

            <SectionCard title="Student-Facing Preview" description="This is a quick review surface for the current edited content, not the student route itself.">
              <div className="space-y-4">
                <div className="rounded-3xl border border-ink/10 bg-surface-low p-5">
                  <h3 className="text-2xl font-black tracking-tight text-ink">{formatText(lessonTitle)}</h3>
                  <p className="mt-2 text-sm text-muted">{formatText(subtitle)}</p>
                </div>

                {editableBlocks.length === 0 ? (
                  <p className="text-sm text-muted">No student-facing blocks to preview yet.</p>
                ) : (
                  editableBlocks.map((block, index) => (
                    <article key={block.id || `preview-${index}`} className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{block.type}</div>
                          <h4 className="mt-2 text-lg font-semibold text-ink">{formatText(block.title || `Block ${index + 1}`)}</h4>
                        </div>
                        <div className="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-ink">
                          Block {index + 1}
                        </div>
                      </div>
                      <div className="prose prose-sm mt-4 max-w-none text-ink">
                        <Markdown>{block.content || "_No content yet._"}</Markdown>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </SectionCard>
          </>
        ) : null}
      </section>

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "approve" ? "Approve Recovered Lesson" : "Reject Recovered Lesson"}
        maxWidth="lg"
      >
        <div className="space-y-5">
          {confirmAction === "approve" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Approving this lesson will set `teaching_contract.status = "approved"` and `student_publish_allowed = true`.
            </div>
          ) : (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              Rejecting this lesson will set `teaching_contract.status = "rejected"` and keep `student_publish_allowed = false`.
            </div>
          )}

          {confirmAction === "approve" && approvalWarnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Warning before approval</p>
              <ul className="mt-2 list-disc pl-5">
                {approvalWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setConfirmAction(null)}
              className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
            >
              Cancel
            </button>
            {confirmAction === "approve" ? (
              <button
                onClick={() => void handleApprove()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busyAction === "approve" ? "Approving..." : "Confirm approve"}
              </button>
            ) : (
              <button
                onClick={() => void handleReject()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                {busyAction === "reject" ? "Rejecting..." : "Confirm reject"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
