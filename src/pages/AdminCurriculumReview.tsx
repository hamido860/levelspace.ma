import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookCheck, ExternalLink, RefreshCw, Search, ShieldCheck, Sparkles, X } from "lucide-react";
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
  <div className="flex items-center justify-center gap-3 rounded-3xl border border-ink/10 bg-paper px-6 py-12 text-sm text-muted shadow-sm">
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
    <Layout>
      <SEO
        title="Admin Curriculum Review"
        description="Admin-only review queue for draft AI-assisted Moroccan curriculum content."
      />

      <section className="space-y-6">
        <div className="rounded-[28px] border border-ink/10 bg-paper p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">Admin only</div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-ink">Curriculum Validation Review</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Review draft AI-assisted Moroccan curriculum content before it is treated as student-ready. Teacher-reviewed
                  and officially validated items should become the priority source for classroom views.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-surface-low px-4 py-3 text-sm text-ink">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span>{items.length} review items loaded</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select
              value={filters.content_type}
              onChange={(event) => setFilters((current) => ({
                ...current,
                content_type: event.target.value as "all" | CurriculumReviewContentType,
              }))}
              className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
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
              className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
            <input
              value={filters.subject}
              onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Filter subject"
              className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
            <input
              value={filters.topic}
              onChange={(event) => setFilters((current) => ({ ...current, topic: event.target.value }))}
              placeholder="Filter topic"
              className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
            <select
              value={filters.validation_status}
              onChange={(event) => setFilters((current) => ({ ...current, validation_status: event.target.value }))}
              className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
            >
              <option value="all">All statuses</option>
              {CURRICULUM_VALIDATION_STATUSES.map((status) => (
                <option key={status} value={status}>{getCurriculumValidationLabel(status)}</option>
              ))}
            </select>
            <input
              value={filters.source_confidence}
              onChange={(event) => setFilters((current) => ({ ...current, source_confidence: event.target.value }))}
              placeholder="Min confidence, e.g. 0.7"
              className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Search className="h-4 w-4" />
              Filters: grade, subject, topic, validation status, and source confidence.
            </div>
            <button
              onClick={() => void loadItems()}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? <Spinner label="Loading curriculum review items..." /> : null}

        {!loading && error ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-6 py-5 text-destructive shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-lg font-semibold">Unable to load curriculum review items</h2>
                <p className="mt-2 text-sm">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-low text-xs uppercase tracking-[0.16em] text-muted">
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
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                        No curriculum review items matched the current filters.
                      </td>
                    </tr>
                  ) : tableRows.map((item) => (
                    <tr
                      key={`${item.content_type}:${item.id}`}
                      onClick={() => void loadDetail(item)}
                      className="cursor-pointer border-t border-ink/10 align-top transition-colors hover:bg-surface-low/60"
                    >
                      <td className="px-4 py-4 font-medium text-ink">{CONTENT_TYPE_LABELS[item.content_type]}</td>
                      <td className="px-4 py-4">
                        <div className="max-w-[340px]">
                          <div className="font-medium text-ink">{item.title}</div>
                          <p className="mt-1 text-xs text-muted">{item.preview}</p>
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
      </section>

      {(selectedItem || detailLoading || detailError) ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-ink/10 bg-paper shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between border-b border-ink/10 bg-paper px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Curriculum Review</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Validation drawer</h2>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-full border border-ink/10 p-2 text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {detailLoading ? <Spinner label="Loading selected review item..." /> : null}

              {!detailLoading && detailError ? (
                <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-6 py-5 text-destructive shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <h2 className="text-lg font-semibold">Unable to load review detail</h2>
                      <p className="mt-2 text-sm">{detailError}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!detailLoading && detail ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Content type</div>
                      <div className="mt-2 text-sm text-ink">{CONTENT_TYPE_LABELS[detail.item.content_type]}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Validation status</div>
                      <div className="mt-2">
                        <span className={getCurriculumValidationBadgeClass(detail.item.validation_status)}>
                          {getCurriculumValidationLabel(detail.item.validation_status)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Grade</div>
                      <div className="mt-2 text-sm text-ink">{formatNullable(detail.item.grade)}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Subject</div>
                      <div className="mt-2 text-sm text-ink">{formatNullable(detail.item.subject)}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Topic</div>
                      <div className="mt-2 text-sm text-ink">{formatNullable(detail.item.topic)}</div>
                    </div>
                    <div className="rounded-3xl border border-ink/10 bg-surface-low p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Source confidence</div>
                      <div className="mt-2 text-sm text-ink">{Math.round(Number(detail.item.source_confidence || 0) * 100)}%</div>
                    </div>
                  </div>

                  <section className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">AI content preview</h3>
                        <p className="mt-1 text-sm text-muted">Review the current draft before you decide how it should move through validation.</p>
                      </div>
                      <button
                        onClick={() => setEditMode((current) => !current)}
                        className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        {editMode ? "Cancel Edit" : "Edit Manually"}
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Title / prompt</label>
                        <input
                          value={editorTitle}
                          onChange={(event) => setEditorTitle(event.target.value)}
                          disabled={!editMode}
                          className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Content preview</label>
                        <textarea
                          value={editorContent}
                          onChange={(event) => setEditorContent(event.target.value)}
                          disabled={!editMode}
                          rows={detail.item.content_type === "lesson" ? 14 : 10}
                          className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                        />
                      </div>

                      {detail.item.content_type === "rag_question" ? (
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Answer</label>
                          <textarea
                            value={editorAnswer}
                            onChange={(event) => setEditorAnswer(event.target.value)}
                            disabled={!editMode}
                            rows={5}
                            className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                          />
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-ink">Linked source reference</h3>
                    {detail.linked_source_ref || detail.item.source_name || detail.item.source_url ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Source name</label>
                          <input
                            value={sourceName}
                            onChange={(event) => setSourceName(event.target.value)}
                            disabled={!editMode}
                            className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Source URL</label>
                          <input
                            value={sourceUrl}
                            onChange={(event) => setSourceUrl(event.target.value)}
                            disabled={!editMode}
                            className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent disabled:bg-surface-low disabled:text-muted"
                          />
                        </div>
                        {detail.linked_source_ref ? (
                          <div className="rounded-2xl border border-ink/10 bg-surface-low p-4 text-sm text-ink">
                            <div><span className="font-semibold">Type:</span> {formatNullable(detail.linked_source_ref.source_type)}</div>
                            <div className="mt-1"><span className="font-semibold">Topic title:</span> {formatNullable(detail.linked_source_ref.topic_title)}</div>
                            <div className="mt-1"><span className="font-semibold">Weight:</span> {Math.round(Number(detail.linked_source_ref.confidence_weight || 0) * 100)}%</div>
                            {detail.linked_source_ref.source_url ? (
                              <a
                                href={detail.linked_source_ref.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 text-accent hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open source
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">No linked curriculum source reference is stored yet.</p>
                    )}
                  </section>

                  <section className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-ink">Mismatch notes</h3>
                    <textarea
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      rows={5}
                      className="mt-4 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                    />

                    {detail.latest_audit ? (
                      <div className="mt-4 space-y-3">
                        <div className="text-xs text-muted">Latest audit: {formatDateTime(detail.latest_audit.created_at)}</div>
                        <JsonPreview value={detail.latest_audit.mismatches || {}} />
                        {detail.latest_audit.recommendation ? (
                          <div className="rounded-2xl border border-ink/10 bg-surface-low p-4 text-sm text-ink">
                            {detail.latest_audit.recommendation}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">No prior validation audit is stored for this item yet.</p>
                    )}
                  </section>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => void runAction("teacher_reviewed")}
                      disabled={!!busyAction}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Accept as Teacher Reviewed
                    </button>
                    <button
                      onClick={() => void runAction("official_validated")}
                      disabled={!!busyAction}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <BookCheck className="h-4 w-4" />
                      Mark Official Validated
                    </button>
                    <button
                      onClick={() => void runAction("reject")}
                      disabled={!!busyAction}
                      className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => void runAction("request_regeneration")}
                      disabled={!!busyAction}
                      className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      Request Regeneration
                    </button>
                    {editMode ? (
                      <button
                        onClick={() => void runAction("save_manual_edits")}
                        disabled={!!busyAction}
                        className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save Manual Edits
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
};
