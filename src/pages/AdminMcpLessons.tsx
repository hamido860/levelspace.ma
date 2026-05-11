import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileWarning,
  Layers,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import { supabase } from "../db/supabase";

type ReviewRow = {
  id: string;
  lesson_title: string | null;
  country: string | null;
  grade: string | null;
  subject: string | null;
  topic_id: string | null;
  generation_pipeline: string | null;
  validation_status: string | null;
  source_confidence: number | null;
  quality_score: number | null;
  topics?: { id: string; title: string | null } | null;
};

type DetailData = {
  checks: any[];
  evidence: any[];
  materials: any[];
  requirements: any[];
};

const statusClass = (value?: string | null) => {
  const status = String(value || "").toLowerCase();
  if (["teacher_reviewed", "official_validated", "published", "verified"].includes(status)) return "bg-emerald-100 text-emerald-700";
  if (["rejected", "failed"].includes(status)) return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

const score = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "-";
};

export const AdminMcpLessons: React.FC = () => {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [detail, setDetail] = useState<Record<string, DetailData>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, lesson_title, country, grade, subject, topic_id, generation_pipeline, validation_status, source_confidence, quality_score, topics:topic_id(id, title)")
        .order("updated_at", { ascending: false })
        .limit(80);

      if (error) throw error;
      const nextRows = Array.isArray(data) ? data as ReviewRow[] : [];
      setRows(nextRows);

      const lessonIds = nextRows.map((row) => row.id);
      const topicIds = Array.from(new Set(nextRows.map((row) => row.topic_id).filter(Boolean))) as string[];

      const [checksResult, evidenceResult, materialsResult, requirementsResult] = await Promise.all([
        lessonIds.length
          ? supabase.from("mcp_quality_checks").select("*").in("lesson_id", lessonIds)
          : Promise.resolve({ data: [], error: null }),
        lessonIds.length
          ? supabase.from("lesson_source_evidence").select("*").in("lesson_id", lessonIds)
          : Promise.resolve({ data: [], error: null }),
        lessonIds.length
          ? supabase.from("lesson_materials").select("*").in("lesson_id", lessonIds)
          : Promise.resolve({ data: [], error: null }),
        topicIds.length
          ? supabase.from("topic_material_requirements").select("*").in("topic_id", topicIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const nextDetail: Record<string, DetailData> = {};
      for (const row of nextRows) {
        nextDetail[row.id] = {
          checks: (checksResult.data || []).filter((item: any) => item.lesson_id === row.id),
          evidence: (evidenceResult.data || []).filter((item: any) => item.lesson_id === row.id),
          materials: (materialsResult.data || []).filter((item: any) => item.lesson_id === row.id),
          requirements: (requirementsResult.data || []).filter((item: any) => item.topic_id === row.topic_id),
        };
      }
      setDetail(nextDetail);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load MCP lesson review data.";
      toast.error("MCP lesson review failed", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const runAction = useCallback(async (row: ReviewRow, action: "generate" | "verify" | "reject" | "request_material") => {
    setBusy(`${action}:${row.id}`);
    try {
      if (action === "generate") {
        const topicTitle = row.topics?.title || row.lesson_title || "Untitled topic";
        const { error } = await (supabase as any).functions.invoke("generate-lessons", {
          body: {
            topic: topicTitle,
            country: row.country || "Morocco",
            grade: row.grade || "",
            subject: row.subject || "",
            moduleName: row.subject || "",
            topicId: row.topic_id,
            pipelineType: "admin_heavy",
          },
        });
        if (error) throw error;
        toast.success("MCP lesson generation requested.");
      }

      if (action === "verify") {
        const { error } = await supabase
          .from("lessons")
          .update({ validation_status: "teacher_reviewed", reviewed_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) throw error;
        toast.success("Lesson marked verified.");
      }

      if (action === "reject") {
        const { error } = await supabase
          .from("lessons")
          .update({ validation_status: "rejected", reviewed_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) throw error;
        toast.success("Lesson rejected.");
      }

      if (action === "request_material") {
        const { error } = await supabase.from("lesson_materials").insert({
          lesson_id: row.id,
          topic_id: row.topic_id,
          material_type: "material_request",
          title: "Manual material request",
          purpose: "Admin requested supporting source/material for MCP review.",
          required: true,
          approved: false,
          metadata: { requested_from: "admin_mcp_lessons" },
        });
        if (error) throw error;
        toast.success("Material request created.");
      }

      await loadRows();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed.";
      toast.error("MCP action failed", { description: message });
    } finally {
      setBusy(null);
    }
  }, [loadRows]);

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <Layout>
      <SEO title="MCP Lesson Review" description="Admin review surface for MCP lesson orchestration." />

      <section className="space-y-6">
        <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">MCP orchestration</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Lesson Review Pipeline</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Inspect admin-heavy lesson runs, source grounding, material gaps, and MCP quality checks before publishing.
              </p>
            </div>
            <button
              onClick={loadRows}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-xs font-bold uppercase tracking-widest text-paper hover:bg-accent disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm">
          <div className="grid grid-cols-[1.2fr_1.1fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 border-b border-ink/10 bg-surface-low px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
            <span>Grade</span>
            <span>Subject</span>
            <span>Topic / Lesson</span>
            <span>Status</span>
            <span>Source</span>
            <span>Quality</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-sm text-muted">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading MCP lessons...
            </div>
          ) : tableRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted">No lessons found.</div>
          ) : (
            tableRows.map((row) => {
              const rowDetail = detail[row.id] || { checks: [], evidence: [], materials: [], requirements: [] };
              const missingMaterials = rowDetail.materials.filter((item) => item.material_type === "material_request" && item.approved !== true).length;
              const failingChecks = rowDetail.checks.filter((check) => ["warning", "fail"].includes(check.status)).length;
              const isExpanded = expandedId === row.id;
              const busyKey = (name: string) => busy === `${name}:${row.id}`;

              return (
                <div key={row.id} className="border-b border-ink/5 last:border-b-0">
                  <div className="grid grid-cols-[1.2fr_1.1fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-4 text-sm">
                    <div className="font-semibold text-ink">{row.grade || "-"}</div>
                    <div className="text-ink">{row.subject || "-"}</div>
                    <div>
                      <div className="font-bold text-ink">{row.topics?.title || "Untitled topic"}</div>
                      <div className="mt-1 text-xs text-muted">{row.lesson_title || "No lesson title"}</div>
                      <div className="mt-1 text-[10px] font-mono text-muted">{row.generation_pipeline || "legacy"}</div>
                    </div>
                    <div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusClass(row.validation_status)}`}>
                        {row.validation_status || "needs_review"}
                      </span>
                    </div>
                    <div className="text-xs text-ink">{score(row.source_confidence)}</div>
                    <div className="text-xs text-ink">{score(row.quality_score)}</div>
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => void runAction(row, "generate")} disabled={!!busy} className="rounded-lg bg-accent/10 p-2 text-accent hover:bg-accent hover:text-paper" title="Regenerate with MCP">
                        {busyKey("generate") ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : row.id)} className="rounded-lg bg-ink/5 p-2 text-muted hover:text-ink" title="View sources and materials">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => void runAction(row, "verify")} disabled={!!busy} className="rounded-lg bg-emerald-100 p-2 text-emerald-700" title="Mark verified">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => void runAction(row, "reject")} disabled={!!busy} className="rounded-lg bg-red-100 p-2 text-red-700" title="Reject">
                        <XCircle className="h-4 w-4" />
                      </button>
                      <button onClick={() => void runAction(row, "request_material")} disabled={!!busy} className="rounded-lg bg-amber-100 p-2 text-amber-700" title="Request material">
                        <PackageSearch className="h-4 w-4" />
                      </button>
                      <a href={`/lesson/${row.id}`} className="rounded-lg bg-ink/5 p-2 text-muted hover:text-ink" title="Open lesson editor">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 px-4 pb-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Required materials: {rowDetail.requirements.length}</span>
                    <span className="inline-flex items-center gap-2"><FileWarning className="h-3.5 w-3.5" /> Missing materials: {missingMaterials}</span>
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> MCP checks: {rowDetail.checks.length}</span>
                    <span className="inline-flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Issues: {failingChecks}</span>
                  </div>

                  {isExpanded && (
                    <div className="grid gap-4 border-t border-ink/5 bg-surface-low/50 p-4 lg:grid-cols-3">
                      <DetailPanel title="Sources" rows={rowDetail.evidence} empty="No source evidence rows." />
                      <DetailPanel title="Materials" rows={rowDetail.materials} empty="No lesson materials." />
                      <DetailPanel title="MCP Checks" rows={rowDetail.checks} empty="No MCP quality checks." />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </Layout>
  );
};

const DetailPanel: React.FC<{ title: string; rows: any[]; empty: string }> = ({ title, rows, empty }) => (
  <div className="rounded-2xl border border-ink/10 bg-paper p-4">
    <h3 className="text-xs font-bold uppercase tracking-widest text-ink">{title}</h3>
    {rows.length === 0 ? (
      <p className="mt-3 text-xs text-muted">{empty}</p>
    ) : (
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {rows.slice(0, 12).map((row, index) => (
          <pre key={row.id || index} className="whitespace-pre-wrap rounded-xl bg-surface-low p-3 text-[11px] leading-5 text-muted">
            {JSON.stringify(row, null, 2)}
          </pre>
        ))}
      </div>
    )}
  </div>
);
