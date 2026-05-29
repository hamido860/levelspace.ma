import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Activity, AlertTriangle, ArrowLeft, BookCheck, ExternalLink, RefreshCw, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import {
  applyCurriculumReview,
  CurriculumReviewContentType,
  CurriculumReviewDetail,
  CurriculumReviewItem,
  getCurriculumReviewDetail,
  getCurriculumReviewItems,
} from "../services/adminCurriculumReviewService";
import {
  CURRICULUM_VALIDATION_STATUSES,
  getCurriculumValidationBadgeClass,
  getCurriculumValidationLabel,
} from "../services/curriculumValidation";

const CONTENT_TYPE_LABELS: Record<CurriculumReviewContentType, string> = {
  lesson: "Lesson",
  topic: "Topic",
  rag_chunk: "RAG Chunk",
  rag_question: "RAG Question",
};

const Spinner: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div className="flex items-center justify-center gap-3 rounded-3xl border border-ink/10 bg-paper px-6 py-12 ls-body-text shadow-sm">
    <RefreshCw className="h-4 w-4 animate-spin" />
    {label}
  </div>
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

const formatNullable = (value: string | null | undefined) => {
  const text = String(value || "").trim();
  return text || "—";
};

const getRawContentPreview = (detail: CurriculumReviewDetail | null) => {
  if (!detail) return "";
  if (detail.item.content_type === "lesson") {
    if (detail.preview_blocks.length > 0) {
      return detail.preview_blocks
        .map((block, index) => `# Block ${index + 1}\n${String(block.title || "").trim()}\n\n${String(block.content || "").trim()}`.trim())
        .join("\n\n");
    }
    return String(detail.raw.content || detail.item.preview || "").trim();
  }

  if (detail.item.content_type === "topic") {
    return String(detail.raw.title || detail.item.title || "").trim();
  }

  if (detail.item.content_type === "rag_chunk") {
    return String(detail.raw.content || detail.item.preview || "").trim();
  }

  return [
    String(detail.raw.question || detail.item.title || "").trim(),
    String(detail.raw.answer || "").trim(),
  ].filter(Boolean).join("\n\n");
};

export const AdminCurriculumReview: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CurriculumReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<CurriculumReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedItem, setSelectedItem] = useState<CurriculumReviewItem | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorAnswer, setEditorAnswer] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [filters, setFilters] = useState({
    content_type: "all" as "all" | CurriculumReviewContentType,
    grade: "",
    subject: "",
    topic: "",
    validation_status: "all",
    source_confidence: "",
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextItems = await getCurriculumReviewItems(filters);
      setItems(nextItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load curriculum review items.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadDetail = useCallback(async (item: CurriculumReviewItem) => {
    setSelectedItem(item);
    setDetailLoading(true);
    setDetailError("");
    setEditMode(false);
    try {
      const nextDetail = await getCurriculumReviewDetail(item.content_type, item.id);
      setDetail(nextDetail);
      setEditorTitle(String(nextDetail.raw.lesson_title || nextDetail.raw.title || nextDetail.raw.question || ""));
      setEditorContent(getRawContentPreview(nextDetail));
      setEditorAnswer(String(nextDetail.raw.answer || ""));
      setReviewNotes(String(nextDetail.item.review_notes || ""));
      setSourceName(String(nextDetail.item.source_name || nextDetail.linked_source_ref?.source_name || ""));
      setSourceUrl(String(nextDetail.item.source_url || nextDetail.linked_source_ref?.source_url || ""));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load curriculum review detail.";
      setDetailError(message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const closeDrawer = useCallback(() => {
    setSelectedItem(null);
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    setEditMode(false);
  }, []);

  const runAction = useCallback(async (action: "teacher_reviewed" | "official_validated" | "reject" | "request_regeneration" | "save_manual_edits") => {
    if (!detail) return;

    setBusyAction(action);
    try {
      const nextDetail = await applyCurriculumReview({
        content_type: detail.item.content_type,
        content_id: detail.item.id,
        action,
        review_notes: reviewNotes,
        title: editorTitle,
        content: editorContent,
        answer: editorAnswer,
        source_name: sourceName,
        source_url: sourceUrl,
      });

      setDetail(nextDetail);
      setItems((current) =>
        current.map((item) => item.id === nextDetail.item.id && item.content_type === nextDetail.item.content_type
          ? nextDetail.item
          : item),
      );
      setEditMode(false);

      toast.success(
        action === "teacher_reviewed"
          ? "Marked as Teacher Reviewed."
          : action === "official_validated"
            ? "Marked as Official Validated."
            : action === "reject"
              ? "Curriculum content rejected."
              : action === "request_regeneration"
                ? "Regeneration request logged."
                : "Manual edits saved.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to apply curriculum review action.";
      toast.error("Curriculum review action failed", { description: message });
    } finally {
      setBusyAction(null);
    }
  }, [detail, editorAnswer, editorContent, editorTitle, reviewNotes, sourceName, sourceUrl]);

  const tableRows = useMemo(() => items, [items]);

  return (
    <Layout fullWidth>
      <SEO
        title="Admin Curriculum Review"
        description="Admin-only review queue for draft AI-assisted Moroccan curriculum content."
      />

      <div className="admin-theme-scope h-full w-full bg-background flex flex-col overflow-hidden p-4">
        
        {/* Symmetrical 3-Column Layout Container */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden">
        
          {/* Column 2: Fluid Main Workspace */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 p-6">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6">
                          {/* Page Header */}
              <div className="border-b border-slate-100 dark:border-white/5 pb-4 mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent mb-1">Administrative Console</div>
                    <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-ink">Curriculum Validation</h1>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      Audit draft AI-assisted curriculum nodes, inspect mismatch diagnostic reviews, and authorize student publish states.
                    </p>
                  </div>
                  {selectedItem && (
                    <button
                      onClick={closeDrawer}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-all hover:bg-surface-low shrink-0 mt-2"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Queue
                    </button>
                  )}
                </div>
              </div>

              {!selectedItem ? (
                // --- Queue List View ---
                <>
                  {/* Filters */}
                  <div className="rounded-2xl border border-ink/10 bg-paper p-4 shadow-sm">
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <select
                        value={filters.content_type}
                        onChange={(event) => setFilters((current) => ({
                          ...current,
                          content_type: event.target.value as "all" | CurriculumReviewContentType,
                        }))}
                        className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                      >
                        <option value="all">All content</option>
                        <option value="lesson">Lessons</option>
                        <option value="topic">Topics</option>
                        <option value="rag_chunk">RAG Chunks</option>
                        <option value="rag_question">RAG Questions</option>
                      </select>
                      <input
                        value={filters.grade}
                        onChange={(event) => setFilters((current) => ({ ...current, grade: event.target.value }))}
                        placeholder="Filter grade"
                        className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                      />
                      <input
                        value={filters.subject}
                        onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}
                        placeholder="Filter subject"
                        className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                      />
                      <input
                        value={filters.topic}
                        onChange={(event) => setFilters((current) => ({ ...current, topic: event.target.value }))}
                        placeholder="Filter topic"
                        className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                      />
                      <select
                        value={filters.validation_status}
                        onChange={(event) => setFilters((current) => ({ ...current, validation_status: event.target.value }))}
                        className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                      >
                        <option value="all">All statuses</option>
                        {CURRICULUM_VALIDATION_STATUSES.map((status) => (
                          <option key={status} value={status}>{getCurriculumValidationLabel(status)}</option>
                        ))}
                      </select>
                      <input
                        value={filters.source_confidence}
                        onChange={(event) => setFilters((current) => ({ ...current, source_confidence: event.target.value }))}
                        placeholder="Min confidence"
                        className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-muted">
                        <Search className="h-3.5 w-3.5" />
                        <span>Filter queue by grade, subject, topic, validation status, confidence.</span>
                      </div>
                      <button
                        onClick={() => void loadItems()}
                        className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-accent"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </button>
                    </div>
                  </div>

                  {loading ? <Spinner label="Loading curriculum review items..." /> : null}

                  {!loading && error ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-destructive text-sm">
                      <p className="font-semibold">Unable to load review items</p>
                      <p className="mt-1 text-xs">{error}</p>
                    </div>
                  ) : null}

                  {!loading && !error ? (
                    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-surface-low uppercase tracking-[0.16em] text-muted">
                            <tr>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Title</th>
                              <th className="px-4 py-3">Grade</th>
                              <th className="px-4 py-3">Subject</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Confidence</th>
                              <th className="px-4 py-3">Source</th>
                              <th className="px-4 py-3">Reviewed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableRows.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                                  No curriculum review items matched the current filters.
                                </td>
                              </tr>
                            ) : tableRows.map((item) => (
                              <tr
                                key={`${item.content_type}:${item.id}`}
                                onClick={() => void loadDetail(item)}
                                className="cursor-pointer border-t border-ink/10 align-top transition-colors hover:bg-surface-low/60"
                              >
                                <td className="px-4 py-4 font-semibold text-ink">{CONTENT_TYPE_LABELS[item.content_type]}</td>
                                <td className="px-4 py-4">
                                  <div className="max-w-[300px]">
                                    <div className="font-semibold text-ink truncate">{item.title}</div>
                                    <p className="mt-0.5 text-[10px] text-muted line-clamp-1">{item.preview}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-muted">{formatNullable(item.grade)}</td>
                                <td className="px-4 py-4 text-muted">{formatNullable(item.subject)}</td>
                                <td className="px-4 py-4">
                                  <span className={getCurriculumValidationBadgeClass(item.validation_status)}>
                                    {getCurriculumValidationLabel(item.validation_status)}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-muted">
                                  {Math.round(Number(item.source_confidence || 0) * 100)}%
                                </td>
                                <td className="px-4 py-4 text-muted">{formatNullable(item.source_name)}</td>
                                <td className="px-4 py-4 text-muted">{formatDateTime(item.reviewed_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                // --- Active Item Preview Card (Inside Column 2 for wide readability) ---
                <>
                  {detailLoading ? <Spinner label="Loading selected review item..." /> : null}

                  {!detailLoading && detailError ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-destructive text-sm">
                      <p className="font-semibold">Unable to load review detail</p>
                      <p className="mt-1 text-xs">{detailError}</p>
                    </div>
                  ) : null}

                  {!detailLoading && detail ? (
                    <div className="space-y-6">
                      
                      {/* AI Content Preview Card */}
                      <section className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4 mb-4">
                          <div>
                            <h3 className="text-base font-bold text-ink font-sans">AI Content Preview</h3>
                            <p className="mt-0.5 text-xs text-muted">Review or manually modify the draft content.</p>
                          </div>
                          <button
                            onClick={() => setEditMode((current) => !current)}
                            className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent"
                          >
                            {editMode ? "Cancel Edit" : "Edit Manually"}
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Title / prompt</label>
                            <input
                              value={editorTitle}
                              onChange={(event) => setEditorTitle(event.target.value)}
                              disabled={!editMode}
                              className="mt-1.5 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Content preview</label>
                            <textarea
                              value={editorContent}
                              onChange={(event) => setEditorContent(event.target.value)}
                              disabled={!editMode}
                              rows={detail.item.content_type === "lesson" ? 14 : 10}
                              className="mt-1.5 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs font-mono text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted leading-relaxed"
                            />
                          </div>

                          {detail.item.content_type === "rag_question" ? (
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Answer</label>
                              <textarea
                                value={editorAnswer}
                                onChange={(event) => setEditorAnswer(event.target.value)}
                                disabled={!editMode}
                                rows={5}
                                className="mt-1.5 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                              />
                            </div>
                          ) : null}
                        </div>
                      </section>

                      {/* Source references */}
                      <section className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-sm">
                        <h3 className="text-base font-bold text-ink border-b border-ink/10 pb-4 mb-4">Linked Source Reference</h3>
                        {detail.linked_source_ref || detail.item.source_name || detail.item.source_url ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Source name</label>
                                <input
                                  value={sourceName}
                                  onChange={(event) => setSourceName(event.target.value)}
                                  disabled={!editMode}
                                  className="mt-1 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Source URL</label>
                                <input
                                  value={sourceUrl}
                                  onChange={(event) => setSourceUrl(event.target.value)}
                                  disabled={!editMode}
                                  className="mt-1 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                                />
                              </div>
                            </div>
                            {detail.linked_source_ref ? (
                              <div className="rounded-xl border border-ink/10 bg-surface-low p-4 text-xs text-ink">
                                <div><span className="font-semibold">Type:</span> {formatNullable(detail.linked_source_ref.source_type)}</div>
                                <div className="mt-1"><span className="font-semibold">Topic title:</span> {formatNullable(detail.linked_source_ref.topic_title)}</div>
                                <div className="mt-1"><span className="font-semibold">Weight:</span> {Math.round(Number(detail.linked_source_ref.confidence_weight || 0) * 100)}%</div>
                                {detail.linked_source_ref.source_url ? (
                                  <a
                                    href={detail.linked_source_ref.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 text-accent hover:underline"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open source
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs text-muted">No linked curriculum source reference is stored yet.</p>
                        )}
                      </section>

                    </div>
                  ) : null}
                </>
              )}

            </div> {/* closes Column 2 scroll container */}
          </div> {/* closes Column 2 main container */}

          {/* Column 3: Right Action & Quick Diagnostics Sidebar */}
          <div className="hidden lg:flex lg:w-[260px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-5 pr-1">
              
              {/* Connection Status widget */}
              <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">System Health</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-bold font-mono">Supabase Online</span>
                    </div>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-white/40 uppercase">Audit Mode</span>
                    <p className="text-[11px] font-bold text-white flex items-center gap-1.5 capitalize">
                      <ShieldCheck size={11} className="text-accent" />
                      Content Validation
                    </p>
                  </div>
                </div>
              </section>

              {/* Admin Consoles Section */}
              <section className="space-y-2">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Admin Consoles</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full flex items-center gap-2 p-2 bg-slate-50 dark:bg-surface-low/30 text-ink rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all text-left"
                  >
                    <ShieldCheck size={12} className="text-accent" />
                    <span className="text-[11px] font-semibold">Admin Dashboard</span>
                  </button>
                  <button
                    onClick={() => navigate('/admin/ai-recovery')}
                    className="w-full flex items-center gap-2 p-2 bg-slate-50 dark:bg-surface-low/30 text-ink rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all text-left"
                  >
                    <Activity size={12} className="text-accent" />
                    <span className="text-[11px] font-semibold">AI Recovery Console</span>
                  </button>
                </div>
              </section>

              {!selectedItem || !detail ? (
                // --- Default Sidebar Guide ---
                <section className="space-y-4">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Validation Queue</p>
                  <div className="bg-slate-50 dark:bg-surface-low/20 rounded-xl p-4 border border-slate-100 dark:border-white/5 space-y-3">
                    <div className="text-xs font-semibold text-ink">Total items loaded:</div>
                    <div className="text-3xl font-black text-accent">{items.length}</div>
                    <p className="text-[11px] leading-relaxed text-muted mt-2">
                      Select any lesson, topic, or RAG chunk from the queue to start a detailed validation audit, inspect mismatch recommendations, and update the curriculum review states.
                    </p>
                  </div>
                </section>
              ) : (
                // --- Active Review Operations Sidebar ---
                <section className="space-y-5">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Audit Metadata</p>
                  
                  {/* Compact Metadata stack */}
                  <div className="grid gap-2 grid-cols-1">
                    <div className="bg-slate-50 dark:bg-surface-low/20 rounded-xl p-2.5 border border-slate-100 dark:border-white/5">
                      <div className="text-[9px] font-semibold text-muted uppercase">Content type</div>
                      <div className="text-xs font-bold text-ink mt-0.5">{CONTENT_TYPE_LABELS[detail.item.content_type]}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-surface-low/20 rounded-xl p-2.5 border border-slate-100 dark:border-white/5">
                      <div className="text-[9px] font-semibold text-muted uppercase">Validation status</div>
                      <div className="mt-1">
                        <span className={getCurriculumValidationBadgeClass(detail.item.validation_status)}>
                          {getCurriculumValidationLabel(detail.item.validation_status)}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-surface-low/20 rounded-xl p-2.5 border border-slate-100 dark:border-white/5">
                      <div className="text-[9px] font-semibold text-muted uppercase">Grade & Subject</div>
                      <div className="text-[11px] text-ink font-semibold mt-0.5 truncate">
                        {formatNullable(detail.item.grade)} • {formatNullable(detail.item.subject)}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-surface-low/20 rounded-xl p-2.5 border border-slate-100 dark:border-white/5">
                      <div className="text-[9px] font-semibold text-muted uppercase">Topic</div>
                      <div className="text-[11px] text-ink font-semibold mt-0.5 truncate" title={detail.item.topic || ""}>
                        {formatNullable(detail.item.topic)}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-surface-low/20 rounded-xl p-2.5 border border-slate-100 dark:border-white/5">
                      <div className="text-[9px] font-semibold text-muted uppercase">Source confidence</div>
                      <div className="text-xs font-bold text-ink mt-0.5">
                        {Math.round(Number(detail.item.source_confidence || 0) * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Mismatch Notes */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Mismatch Audit Notes</p>
                    <textarea
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      rows={3}
                      placeholder="Add manual mismatch notes..."
                      className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink outline-none transition-colors focus:border-accent"
                    />
                  </div>

                  {/* Recommendation / Audit Info */}
                  {detail.latest_audit ? (
                    <div className="space-y-2 bg-slate-50 dark:bg-surface-low/20 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">System Recommendation</p>
                      {detail.latest_audit.recommendation ? (
                        <p className="text-[10px] text-ink mt-1 font-medium">{detail.latest_audit.recommendation}</p>
                      ) : (
                        <p className="text-[10px] text-muted italic">No specific recommendation found</p>
                      )}
                    </div>
                  ) : null}

                  {/* Primary Review Action Buttons */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      onClick={() => void runAction("teacher_reviewed")}
                      disabled={!!busyAction}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Accept Teacher Reviewed
                    </button>
                    <button
                      onClick={() => void runAction("official_validated")}
                      disabled={!!busyAction}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-surface py-2.5 text-xs font-semibold text-white dark:text-ink transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <BookCheck className="h-3.5 w-3.5" />
                      Mark Official Validated
                    </button>
                    <button
                      onClick={() => void runAction("reject")}
                      disabled={!!busyAction}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                    >
                      Reject Content
                    </button>
                    <button
                      onClick={() => void runAction("request_regeneration")}
                      disabled={!!busyAction}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink/10 bg-paper py-2.5 text-xs font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Request Regeneration
                    </button>
                    {editMode ? (
                      <button
                        onClick={() => void runAction("save_manual_edits")}
                        disabled={!!busyAction}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/20 bg-accent/10 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-60"
                      >
                        Save Manual Edits
                      </button>
                    ) : null}
                  </div>

                </section>
              )}

            </div>
          </div> {/* closes Column 3 */}

        </div> {/* closes 3-Column Layout Container */}
      </div>

    </Layout>
  );
};
