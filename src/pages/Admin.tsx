import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import { isSupabaseConfigured, supabase } from "../db/supabase";
import { useAuth } from "../context/AuthContext";
import { validateMetrics, formatValidationErrors } from "../services/metricsValidator";
import {
  AdminGradeRow,
  AdminOverviewKpis,
  AdminTableHealth,
  AiReviewStatusCount,
  FailedQueueJob,
  QueueStatusBreakdown,
  RagByGrade,
  RagMetrics,
  loadAdminGradeMetrics,
  loadAdminOverviewKpis,
  loadAdminQueueMetrics,
  loadAdminRagMetrics,
  loadAdminTableHealth,
  loadAiRecoveryReviewStatusCounts,
} from "../services/adminDashboardService";
import {
  RefreshCw, Database, BarChart2, BookOpen, Cpu, Table2,
  AlertTriangle, CheckCircle, Clock, Layers, Sparkles,
  Lightbulb, ListChecks, Map as MapIcon, ChevronRight,
  TrendingUp, TrendingDown, Info, Zap,
  Play, ChevronDown,
  Copy, Check
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BrowseRow { [key: string]: any; }

type Tab = "overview" | "grades" | "queue" | "rag" | "browser" | "ai";

// ─── AI Analyst Types ────────────────────────────────────────────────────────
type AIAction = "insights" | "tasks" | "strategy";
interface AIHighlight { type: "warning" | "success" | "info"; title: string; detail: string; }
interface AIBottleneck { area: string; severity: "high" | "medium" | "low"; description: string; }
interface AIInsights { summary: string; highlights: AIHighlight[]; bottlenecks: AIBottleneck[]; }
interface AITask {
  id: number; priority: "critical" | "high" | "medium" | "low"; title: string;
  description: string; metric_basis: string; estimated_impact: string;
  action_type: "fix" | "generate" | "review" | "optimize";
}
interface AITaskList { tasks: AITask[]; }
interface AIPhase { phase: number; name: string; duration: string; objectives: string[]; key_metric: string; actions: string[]; }
interface AIStrategy { goal: string; phases: AIPhase[]; success_criteria: string[]; risks: { risk: string; mitigation: string }[]; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const ProgressBar: React.FC<{ val: number; total: number }> = ({ val, total }) => {
  const p = pct(val, total);
  const color =
    p === 0 ? "bg-red-400" : p < 100 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-gray-400">{p}%</span>
    </div>
  );
};

const Pill: React.FC<{ status: "done" | "pending" | "failed" | "empty" | "partial" | "populated" | "unknown" | "missing" | "restricted"; label?: string | number }> = ({ status, label }) => {
  const map = {
    done:      "bg-emerald-100 text-emerald-800",
    pending:   "bg-amber-100 text-amber-800",
    failed:    "bg-red-100 text-red-800",
    empty:     "bg-red-100 text-red-700",
    partial:   "bg-amber-100 text-amber-700",
    populated: "bg-emerald-100 text-emerald-700",
    unknown:   "bg-gray-100 text-gray-600",
    missing:   "bg-red-100 text-red-700",
    restricted:"bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {label ?? status}
    </span>
  );
};

const ValidationPill: React.FC<{ value?: string | null }> = ({ value }) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  let classes = "bg-gray-100 text-gray-600";
  if (["passed", "valid", "approved", "success"].includes(normalized)) {
    classes = "bg-emerald-100 text-emerald-800";
  } else if (["failed", "invalid", "rejected", "error"].includes(normalized)) {
    classes = "bg-red-100 text-red-800";
  } else if (["pending", "queued", "processing", "review"].includes(normalized)) {
    classes = "bg-amber-100 text-amber-800";
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
      {value ?? "—"}
    </span>
  );
};

const formatQualityScore = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : String(value);
};

const CopyButton: React.FC<{ getText: () => string; label?: string; className?: string; iconClass?: string }> = ({
  getText, label, className = "", iconClass = "w-3 h-3",
}) => {
  const [copied, setCopied] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be blocked in non-secure contexts
    }
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      onClick={onClick}
      title={copied ? "Copied!" : "Copy to clipboard"}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      <Icon className={`${iconClass} ${copied ? "text-emerald-600" : ""}`} />
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
};

const formatTaskForCopy = (t: any) =>
  `${t.id}. [${String(t.priority).toUpperCase()}] ${t.title}\n` +
  `${t.description}\n` +
  `Based on: ${t.metric_basis}\n` +
  `Impact: ${t.estimated_impact}\n` +
  `Action: ${t.action_type}`;

const formatTaskListForCopy = (tasks: any[]) => tasks.map(formatTaskForCopy).join("\n\n");

const formatRowsAsTSV = (cols: string[], rows: any[]) => {
  const sanitize = (v: any) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v).replace(/[\t\n\r]+/g, " ");
  };
  const header = cols.join("\t");
  const body = rows.map(r => cols.map(c => sanitize(r[c])).join("\t")).join("\n");
  return `${header}\n${body}`;
};

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-10 text-gray-400 gap-3 text-sm">
    <RefreshCw className="w-4 h-4 animate-spin" />
    Loading…
  </div>
);

const KPI: React.FC<{ label: string; value: number | string; sub?: string; variant?: "default" | "warn" | "danger" | "success" }> = ({
  label, value, sub, variant = "default",
}) => {
  const colors = {
    default: "text-gray-900",
    warn:    "text-amber-500",
    danger:  "text-red-500",
    success: "text-emerald-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-extrabold ${colors[variant]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string>("");

  // Overview state
  const [kpis, setKpis] = useState<AdminOverviewKpis>({
    topics: 0,
    completedJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    recoveredLessonsNeedsReview: 0,
    studentPublishReadyLessons: 0,
    ragTotal: 0,
    ragDone: 0,
    users: 0,
  });
  const [tableHealth, setTableHealth] = useState<AdminTableHealth[]>([]);
  const [aiReviewStatuses, setAiReviewStatuses] = useState<AiReviewStatusCount[]>([]);

  // Grade coverage
  const [gradeData, setGradeData] = useState<AdminGradeRow[]>([]);

  // Queue
  const [queueStats, setQueueStats] = useState<QueueStatusBreakdown>({
    done: 0,
    pending: 0,
    failed: 0,
    processing: 0,
    other: 0,
    unresolvedTopicJobs: 0,
    otherStatuses: [],
  });
  const [failedJobs, setFailedJobs] = useState<FailedQueueJob[]>([]);

  // RAG
  const [ragStats, setRagStats] = useState<RagMetrics>({ total: 0, done: 0, pending: 0, other: 0, byStatus: {} });
  const [ragByGrade, setRagByGrade] = useState<RagByGrade[]>([]);

  // AI Analyst
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]   = useState("");
  const [aiInsights, setAiInsights]   = useState<AIInsights | null>(null);
  const [aiTaskList, setAiTaskList]   = useState<AITaskList | null>(null);
  const [aiStrategy, setAiStrategy]   = useState<AIStrategy | null>(null);
  const [activeAITab, setActiveAITab] = useState<AIAction>("insights");

  // Browser
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [browseLimit, setBrowseLimit] = useState(20);
  const [browseFilter, setBrowseFilter] = useState("");
  const [browseRows, setBrowseRows] = useState<BrowseRow[]>([]);
  const [browseCols, setBrowseCols] = useState<string[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState("");
  const [editRow, setEditRow] = useState<{ id: any; row: BrowseRow } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // RAG chunk browser
  const [ragChunkGradeId, setRagChunkGradeId] = useState<string | null>(null);
  const [ragChunks, setRagChunks] = useState<any[]>([]);
  const [ragChunkLoading, setRagChunkLoading] = useState(false);
  const [ragChunkError, setRagChunkError] = useState("");

  // Dormant modal state kept isolated until protected workflow routes are added.
  const [execModal, setExecModal] = useState<{ task: any; open: boolean } | null>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);



  // ── AI Agent caller ──────────────────────────────────────────────────────
  const callAgent = useCallback(async (action: AIAction) => {
    setAiLoading(true);
    setAiError("");

    // Build a compact metrics snapshot from live state
    const metricsSnapshot: any = {
      totalTopics: kpis.topics,
      lessonsGenerated: gradeData.reduce((sum, grade) => sum + grade.lessons_covered, 0),
      completedJobs: kpis.completedJobs,
      lessonCoverage: `${pct(gradeData.reduce((sum, grade) => sum + grade.lessons_covered, 0), kpis.topics)}%`,
      queuePending: kpis.pendingJobs,
      failedJobs: kpis.failedJobs,
      ragChunksTotal: kpis.ragTotal,
      ragChunksEmbedded: kpis.ragDone,
      ragCoverage: `${pct(kpis.ragDone, kpis.ragTotal)}%`,
      totalUsers: kpis.users,
      recoveredLessonsNeedingReview: kpis.recoveredLessonsNeedsReview,
      studentPublishReadyLessons: kpis.studentPublishReadyLessons,
      aiRecoveryTaskReviewStatuses: aiReviewStatuses,
      gradeBreakdown: gradeData.map(g => ({
        grade: g.grade,
        cycle: g.cycle,
        topics: g.total_topics,
        lessons: g.lessons_covered,
        completedJobs: g.q_done,
        coverage: `${pct(g.lessons_covered, g.total_topics)}%`,
        queueFailed: g.q_failed,
        queuePending: g.q_pending,
        recoveredLessons: g.needs_review,
      })),
      tableHealth: tableHealth.map(t => ({
        table: t.table_name,
        rows: t.row_count,
        status: t.health_status,
      })),
    };

    // Validate metrics before sending to AI
    const validationErrors = validateMetrics(metricsSnapshot);
    if (validationErrors.length > 0) {
      setAiError(`⚠️ Metrics validation failed:\n${formatValidationErrors(validationErrors)}`);
      setAiLoading(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      const res = await fetch("/api/ai-analyst", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ metrics: metricsSnapshot, action }),
      });
      const text = await res.text();
      if (!text) throw new Error(`Empty response from server (HTTP ${res.status}). Is the dev server running with \`npm run dev\`?`);
      let json: any;
      try { json = JSON.parse(text); }
      catch { throw new Error(`Server returned non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`); }
      if (!res.ok) throw new Error(json.error || "Agent call failed");

      if (action === "insights")      setAiInsights(json.result as AIInsights);
      else if (action === "tasks")    setAiTaskList(json.result as AITaskList);
      else if (action === "strategy") setAiStrategy(json.result as AIStrategy);
    } catch (e: any) {
      setAiError(e.message);
    }
    setAiLoading(false);
  }, [aiReviewStatuses, gradeData, kpis, tableHealth]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, health, grades, queue, rag, reviewStatuses] = await Promise.all([
        loadAdminOverviewKpis(),
        loadAdminTableHealth(),
        loadAdminGradeMetrics(),
        loadAdminQueueMetrics(),
        loadAdminRagMetrics(),
        loadAiRecoveryReviewStatusCounts(),
      ]);
      setKpis(overview);
      setTableHealth(health);
      setGradeData(grades);
      setQueueStats(queue.stats);
      setFailedJobs(queue.failedJobs);
      setRagStats(rag.ragStats);
      setRagByGrade(rag.ragByGrade);
      setAiReviewStatuses(reviewStatuses);
      setDashboardError("");
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      console.error(e);
      setDashboardError(e.message || "Unable to load live admin metrics from Supabase.");
    }
    setLoading(false);
  }, []);

  // Wait for auth to hydrate before firing queries — anon role has no SELECT
  // policy on most tables, so running these as anon would return 0 / null and
  // mislead the AI Analyst into reporting tables as "empty".
  useEffect(() => { if (!authLoading) refreshAll(); }, [authLoading, refreshAll]);

  // ── Shared fetch helper ────────────────────────────────────────────────────
  // ── Queue actions ──────────────────────────────────────────────────────────
  // ── Grade bulk actions ─────────────────────────────────────────────────────
  // ── Task executor (gated: preview + confirm) ──────────────────────────────
  // ── RAG chunk actions ──────────────────────────────────────────────────────
  const loadRagChunks = async (gradeId: string) => {
    if (ragChunkGradeId === gradeId) {
      setRagChunkGradeId(null);
      setRagChunks([]);
      setRagChunkError("");
      return;
    }
    if (!isSupabaseConfigured) {
      setRagChunkGradeId(gradeId);
      setRagChunks([]);
      setRagChunkError("Supabase is not configured, so chunk inspection is unavailable.");
      return;
    }

    setRagChunkGradeId(gradeId);
    setRagChunkLoading(true);
    try {
      setRagChunkError("");
      const { data, error } = await supabase
        .from("rag_chunks")
        .select("id, content, embedding_status, source_url")
        .eq("grade_id", gradeId)
        .order("embedding_status")
        .limit(100);
      if (error) throw error;
      setRagChunks(data || []);
    } catch (e: any) {
      setRagChunks([]);
      setRagChunkError(e.message || "Unable to load chunk details.");
    }
    setRagChunkLoading(false);
  };

  // ── Table browser actions ──────────────────────────────────────────────────
  const browseTable = async (tableName?: string) => {
    const t = tableName ?? selectedTable;
    if (!t) return;
    if (!isSupabaseConfigured) {
      setBrowseError("Supabase is not configured, so table browsing is unavailable.");
      setBrowseRows([]);
      setBrowseCols([]);
      return;
    }

    setBrowseLoading(true);
    setBrowseError("");
    setBrowseRows([]);
    try {
      let q = supabase.from(t as any).select("*").limit(browseLimit);
      if (browseFilter.trim()) {
        // basic eq filter: "col=val"
        const match = browseFilter.trim().match(/^(\w+)\s*=\s*'?([^']+)'?$/);
        if (match) q = (q as any).eq(match[1], match[2]);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (data && data.length > 0) {
        setBrowseCols(Object.keys(data[0]));
        setBrowseRows(data as BrowseRow[]);
      } else {
        setBrowseCols([]);
        setBrowseRows([]);
      }
    } catch (e: any) {
      setBrowseError(e.message);
    }
    setBrowseLoading(false);
  };

  const saveRowEdit = async () => {
    setEditSaving(true);
    setBrowseError("Dashboard write actions are disabled until protected admin routes exist.");
    setEditSaving(false);
  };

  const sendTaskToCommandCenter = async (_task: any) => {
    setExecLoading(true);
    setExecResult({ error: "Workflow creation is disabled from this dashboard for now." });
    setExecLoading(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview",        icon: <BarChart2 className="w-4 h-4" /> },
    { id: "grades",   label: "Grade Coverage",  icon: <BookOpen className="w-4 h-4" /> },
    { id: "queue",    label: "Gen Queue",        icon: <Cpu className="w-4 h-4" /> },
    { id: "rag",      label: "RAG / Embeddings", icon: <Layers className="w-4 h-4" /> },
    { id: "browser",  label: "Table Browser",   icon: <Table2 className="w-4 h-4" /> },
    { id: "ai",       label: "AI Analyst",       icon: <Sparkles className="w-4 h-4" /> },
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <SEO title="Admin Panel" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {lastRefresh ? `Last refreshed: ${lastRefresh}` : "Loading live data…"}
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {dashboardError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-semibold">Live admin metrics are unavailable.</div>
          <div className="mt-1">{dashboardError}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-red-500 text-red-500"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <KPI label="Total Topics" value={kpis.topics ?? "—"} sub="across all grades" />
            <KPI label="Completed Jobs" value={kpis.completedJobs ?? "—"} sub="lesson_gen_queue status = done" variant="success" />
            <KPI label="Queue Pending" value={kpis.pendingJobs ?? "—"} sub="lesson_gen_queue status = pending" variant="warn" />
            <KPI label="Queue Failed" value={kpis.failedJobs ?? "—"} sub="lesson_gen_queue status = failed" variant="danger" />
            <KPI label="Needs Review" value={kpis.recoveredLessonsNeedsReview ?? "—"} sub="teaching_contract.status = needs_review" variant="warn" />
            <KPI label="Student Publish Ready" value={kpis.studentPublishReadyLessons ?? "—"} sub="needs_review + student_publish_allowed = true" variant="success" />
            <KPI label="RAG Chunks" value={kpis.ragTotal ?? "—"} sub={`${pct(kpis.ragDone, kpis.ragTotal)}% embedded`} variant="success" />
            <KPI label="Users" value={kpis.users ?? "—"} sub="profiles" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-sm">AI Recovery Review Status</h2>
            </div>
            {loading ? <Spinner /> : aiReviewStatuses.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No `lesson_generation` AI task review statuses were found in Supabase.</div>
            ) : (
              <div className="flex flex-wrap gap-3 p-5">
                {aiReviewStatuses.map((item) => (
                  <div key={item.status} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500">{item.status}</div>
                    <div className="text-lg font-bold text-gray-900">{item.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-sm">Table Health</h2>
              <span className="ml-auto text-xs bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                {tableHealth.length} tables
              </span>
            </div>
            {loading ? <Spinner /> : tableHealth.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No confirmed admin tables were available to inspect.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Table</th>
                      <th className="px-4 py-2 text-left">Rows</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableHealth.map((t) => {
                      const status =
                        t.health_status === "present" ? "populated"
                        : t.health_status === "empty" ? "empty"
                        : t.health_status;
                      return (
                        <tr key={t.table_name} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2 font-medium">{t.table_name}</td>
                          <td className="px-4 py-2">{t.row_count === null ? "—" : t.row_count.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <Pill
                              status={status as any}
                              label={
                                t.health_status === "missing" ? "missing table"
                                : t.health_status === "restricted" ? "restricted"
                                : status
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GRADE COVERAGE ── */}
      {tab === "grades" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-sm">Grade-by-Grade Content Coverage</h2>
          </div>
          {loading ? <Spinner /> : gradeData.length === 0 ? (
            <div className="p-5 text-sm text-gray-500">No grade rows were returned from Supabase.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Grade</th>
                    <th className="px-4 py-2 text-left">Topics</th>
                    <th className="px-4 py-2 text-left">Lesson Coverage</th>
                    <th className="px-4 py-2 text-left">Coverage</th>
                    <th className="px-4 py-2 text-left">Completed Jobs</th>
                    <th className="px-4 py-2 text-left">Pending Jobs</th>
                    <th className="px-4 py-2 text-left">Failed Jobs</th>
                    <th className="px-4 py-2 text-left">Needs Review</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastCycle = "";
                    return gradeData.map((row, i) => {
                      const header = row.cycle !== lastCycle;
                      lastCycle = row.cycle;
                      return (
                        <React.Fragment key={i}>
                          {header && (
                            <tr className="bg-gray-100">
                              <td colSpan={8} className="px-4 py-2 font-bold text-xs text-gray-600">
                                🎓 {row.cycle}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t border-gray-50 hover:bg-gray-50/40">
                            <td className="px-4 py-2">{row.grade}</td>
                            <td className="px-4 py-2">{row.total_topics}</td>
                            <td className="px-4 py-2">{row.lessons_covered}</td>
                            <td className="px-4 py-2"><ProgressBar val={row.lessons_covered} total={row.total_topics} /></td>
                            <td className="px-4 py-2"><Pill status="done" label={row.q_done} /></td>
                            <td className="px-4 py-2"><Pill status="pending" label={row.q_pending} /></td>
                            <td className="px-4 py-2">
                              {row.q_failed > 0
                                ? <Pill status="failed" label={row.q_failed} />
                                : <span className="text-gray-300 text-xs">0</span>}
                            </td>
                            <td className="px-4 py-2"><Pill status={row.needs_review > 0 ? "pending" : "done"} label={row.needs_review} /></td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── QUEUE ── */}
      {tab === "queue" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <KPI label="Done" value={queueStats.done ?? 0} sub={`${pct(queueStats.done, (queueStats.done||0)+(queueStats.pending||0)+(queueStats.failed||0)+(queueStats.processing||0)+(queueStats.other||0))}% complete`} variant="success" />
            <KPI label="Pending"    value={queueStats.pending ?? 0}     sub="waiting"      variant="warn" />
            <KPI label="Failed"     value={queueStats.failed ?? 0}      sub="need retry"   variant="danger" />
            <KPI label="Processing" value={queueStats.processing ?? 0}  sub="in progress" />
            <KPI label="Other Statuses" value={queueStats.other ?? 0} sub="non-canonical queue states" variant="warn" />
            <KPI label="Missing Topic ID" value={queueStats.unresolvedTopicJobs ?? 0} sub="jobs not attributable to a grade" variant="danger" />
          </div>

          {queueStats.otherStatuses.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Other queue statuses detected in Supabase: {queueStats.otherStatuses.map((item) => `${item.status} (${item.count})`).join(", ")}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-sm">Generation Queue — by Grade</h2>
            </div>
            {loading ? <Spinner /> : gradeData.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No queue-to-grade mappings were returned from Supabase.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Grade</th>
                      <th className="px-4 py-2 text-left">Done</th>
                      <th className="px-4 py-2 text-left">Pending</th>
                      <th className="px-4 py-2 text-left">Failed</th>
                      <th className="px-4 py-2 text-left">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let lastCycle = "";
                      return gradeData.map((row, i) => {
                        const header = row.cycle !== lastCycle;
                        lastCycle = row.cycle;
                        const total = row.q_done + row.q_pending + row.q_failed;
                        return (
                          <React.Fragment key={i}>
                            {header && (
                              <tr className="bg-gray-100">
                                <td colSpan={5} className="px-4 py-2 font-bold text-xs text-gray-600">
                                  {row.cycle}
                                </td>
                              </tr>
                            )}
                            <tr className="border-t border-gray-50 hover:bg-gray-50/40">
                              <td className="px-4 py-2">{row.grade}</td>
                              <td className="px-4 py-2"><Pill status="done" label={row.q_done} /></td>
                              <td className="px-4 py-2"><Pill status="pending" label={row.q_pending} /></td>
                              <td className="px-4 py-2">
                                {row.q_failed > 0
                                  ? <Pill status="failed" label={row.q_failed} />
                                  : <span className="text-gray-300 text-xs">0</span>}
                              </td>
                              <td className="px-4 py-2"><ProgressBar val={row.q_done} total={total || 1} /></td>
                            </tr>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h2 className="font-bold text-sm">Recent Failed Jobs</h2>
              <span className="ml-auto text-xs text-gray-400">latest 10 rows from `lesson_gen_queue`</span>
            </div>
            {loading ? <Spinner /> : failedJobs.length === 0 ? (
              <div className="flex items-center gap-2 p-5 text-emerald-600 text-sm">
                <CheckCircle className="w-4 h-4" /> No failed jobs!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Topic</th>
                      <th className="px-4 py-2 text-left">Track ID</th>
                      <th className="px-4 py-2 text-left">Attempts</th>
                      <th className="px-4 py-2 text-left">Error</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedJobs.map((j: any) => (
                      <tr key={j.id} className="border-t border-gray-50 hover:bg-gray-50/40">
                        <td className="px-4 py-2">{(j.topics as any)?.title ?? j.topic_id}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{j.track_id ?? "—"}</td>
                        <td className="px-4 py-2">{j.attempts}</td>
                        <td className="px-4 py-2 text-red-500 text-xs max-w-xs truncate">{(j.last_error ?? "").substring(0, 100)}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{new Date(j.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RAG / EMBEDDINGS ── */}
      {tab === "rag" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KPI label="Total Chunks" value={(ragStats.total ?? 0).toLocaleString()} sub="in rag_chunks" />
            <KPI label="Embedded" value={(ragStats.done ?? 0).toLocaleString()} sub={`${pct(ragStats.done, ragStats.total)}% done`} variant="success" />
            <KPI label="Pending" value={(ragStats.pending ?? 0).toLocaleString()} sub="embedding_status = pending" variant="warn" />
            <KPI label="Other Statuses" value={(ragStats.other ?? 0).toLocaleString()} sub="non-pending / non-done chunks" variant="warn" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-sm">RAG Chunks — by Grade</h2>
              <span className="ml-auto text-xs text-gray-400">Click a row to inspect the latest 100 chunks for that grade</span>
            </div>
            {loading ? <Spinner /> : ragByGrade.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No RAG chunks were returned from Supabase for any grade.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Grade</th>
                      <th className="px-4 py-2 text-left">Total</th>
                      <th className="px-4 py-2 text-left">Embedded</th>
                      <th className="px-4 py-2 text-left">Pending</th>
                      <th className="px-4 py-2 text-left">Other</th>
                      <th className="px-4 py-2 text-left">Coverage</th>
                      <th className="px-4 py-2 text-left">Chunks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ragByGrade.map((row, i) => (
                      <React.Fragment key={i}>
                        <tr className="border-t border-gray-50 hover:bg-gray-50/40">
                          <td className="px-4 py-2">{row.grade}</td>
                          <td className="px-4 py-2">{row.total.toLocaleString()}</td>
                          <td className="px-4 py-2"><Pill status="done" label={row.done.toLocaleString()} /></td>
                          <td className="px-4 py-2"><Pill status="pending" label={row.pending.toLocaleString()} /></td>
                          <td className="px-4 py-2"><Pill status={row.other > 0 ? "failed" : "done"} label={row.other.toLocaleString()} /></td>
                          <td className="px-4 py-2"><ProgressBar val={row.done} total={row.total || 1} /></td>
                          <td className="px-4 py-2">
                            <button onClick={() => loadRagChunks(row.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                              <ChevronDown className={`w-3 h-3 transition-transform ${ragChunkGradeId === row.id ? "rotate-180" : ""}`} />
                              {ragChunkGradeId === row.id ? "Hide" : "Browse"}
                            </button>
                          </td>
                        </tr>
                        {ragChunkGradeId === row.id && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50 px-4 py-3">
                              {ragChunkLoading ? <Spinner /> : ragChunkError ? (
                                <p className="text-xs text-red-500">{ragChunkError}</p>
                              ) : ragChunks.length === 0 ? (
                                <p className="text-xs text-gray-400">No chunks found.</p>
                              ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                  {ragChunks.map((c: any) => (
                                    <div key={c.id} className="bg-white rounded-lg border border-gray-100 p-3 flex items-start gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Pill
                                            status={c.embedding_status === "done" ? "done" : c.embedding_status === "pending" ? "pending" : "failed"}
                                            label={c.embedding_status}
                                          />
                                          {c.source_url && <span className="text-xs text-gray-400 truncate max-w-[200px]">{c.source_url}</span>}
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{c.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TABLE BROWSER ── */}
      {tab === "browser" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
            <Table2 className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-sm">Table Browser</h2>
            <span className="ml-auto text-xs text-gray-400">
              {browseRows.length > 0 && selectedTable
                ? `${browseRows.length} row(s) from ${selectedTable}`
                : "Select a table to inspect rows"}
            </span>
            {browseRows.length > 0 && (
              <>
                <CopyButton
                  getText={() => formatRowsAsTSV(browseCols, browseRows)}
                  label="Copy TSV"
                  iconClass="w-3.5 h-3.5"
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                />
                <CopyButton
                  getText={() => JSON.stringify(browseRows, null, 2)}
                  label="Copy JSON"
                  iconClass="w-3.5 h-3.5"
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                />
              </>
            )}
          </div>
          <div className="p-5">
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              Read-only inspector for confirmed Supabase tables. Broken write actions were removed from the dashboard until protected server routes exist.
            </div>
            {/* Table selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {tableHealth.filter((t) => t.health_status === "present" || t.health_status === "empty").map((t) => (
                <button
                  key={t.table_name}
                  onClick={() => { setSelectedTable(t.table_name); browseTable(t.table_name); }}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${
                    selectedTable === t.table_name
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-500"
                  }`}
                >
                  {t.table_name}
                  <span className="ml-1.5 opacity-60">{t.row_count === null ? "—" : t.row_count.toLocaleString()}</span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4 items-center">
              <input
                type="number"
                value={browseLimit}
                onChange={(e) => setBrowseLimit(Number(e.target.value))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                min={1} max={200}
              />
              <span className="text-xs text-gray-400">rows</span>
              <input
                value={browseFilter}
                onChange={(e) => setBrowseFilter(e.target.value)}
                placeholder="Filter: column=value (e.g. status=failed)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => browseTable()}
                disabled={!selectedTable}
                className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-40"
              >
                Query
              </button>
            </div>

            {/* Results */}
            {browseLoading && <Spinner />}
            {browseError && <p className="text-red-500 text-sm">{browseError}</p>}
            {!browseLoading && !browseError && browseRows.length === 0 && !selectedTable && (
              <p className="text-gray-400 text-sm">Select a table above to start browsing.</p>
            )}
            {!browseLoading && !browseError && browseRows.length === 0 && selectedTable && (
              <p className="text-gray-400 text-sm">No rows returned.</p>
            )}
            {!browseLoading && browseRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <tr>
                      {browseCols.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {browseRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60">
                        {browseCols.map((c) => {
                          let v = row[c];
                          if (v === null || v === undefined) return <td key={c} className="px-3 py-2 text-gray-300">null</td>;
                          if (typeof v === "object") v = JSON.stringify(v).substring(0, 80) + "…";
                          const s = String(v);
                          return (
                            <td key={c} className="px-3 py-2 max-w-[180px] truncate" title={s}>
                              {s.length > 60 ? s.substring(0, 60) + "…" : s}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">{browseRows.length} row(s) from <strong>{selectedTable}</strong></p>
              </div>
            )}

            {/* ── Edit row modal ── */}
            {editRow && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-sm">Edit Row — {selectedTable}</h3>
                    <button onClick={() => setEditRow(null)} className="text-gray-400 hover:text-gray-700">✕</button>
                  </div>
                  <div className="overflow-y-auto p-5 space-y-3 flex-1">
                    {Object.entries(editRow.row).filter(([k]) => k !== "id" && k !== "created_at" && k !== "updated_at").map(([k, v]) => (
                      <div key={k}>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{k}</label>
                        <input
                          value={typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                          onChange={(e) => setEditRow(prev => prev ? { ...prev, row: { ...prev.row, [k]: e.target.value } } : null)}
                          className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
                    <button onClick={() => setEditRow(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button onClick={saveRowEdit} disabled={editSaving}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-red-500 disabled:opacity-50">
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── AI ANALYST ── */}
      {tab === "ai" && (
        <div>
          {/* Header card */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 mb-5 text-white flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-base">AI Analyst Agent</h2>
              <p className="text-gray-400 text-sm mt-0.5">
                Powered by <span className="text-white font-medium">qwen/qwen3-coder-480b-a35b-instruct</span> via NVIDIA NIM.
                Reads your live database metrics and returns insights, tasks, and strategy.
              </p>
            </div>
          </div>

          {/* Action tabs */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {([
              { id: "insights"     as AIAction, label: "Insights",       icon: <Lightbulb className="w-4 h-4" />, desc: "Interpret what the metrics mean" },
              { id: "tasks"        as AIAction, label: "Task List",      icon: <ListChecks className="w-4 h-4" />, desc: "Prioritized action items" },
              { id: "strategy"     as AIAction, label: "Strategy Plan",  icon: <MapIcon className="w-4 h-4" />,       desc: "Phased roadmap to fix gaps" },
            ] as { id: AIAction; label: string; icon: React.ReactNode; desc: string }[]).map((a) => (
              <button
                key={a.id}
                onClick={() => { setActiveAITab(a.id); callAgent(a.id); }}
                disabled={aiLoading}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${
                  activeAITab === a.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-900 hover:text-gray-900"
                }`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {aiLoading && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-red-500 rounded-full animate-spin" />
              <p className="text-sm">Agent is reading your metrics and thinking…</p>
            </div>
          )}

          {/* Error */}
          {aiError && !aiLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div><strong>Agent error:</strong> {aiError}</div>
            </div>
          )}

          {/* ── INSIGHTS ── */}
          {aiInsights && !aiLoading && activeAITab === "insights" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-sm">Executive Summary</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{aiInsights.summary}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aiInsights.highlights?.map((h, i) => {
                  const colors = {
                    warning: "border-l-amber-400 bg-amber-50",
                    success: "border-l-emerald-400 bg-emerald-50",
                    info:    "border-l-blue-400 bg-blue-50",
                  };
                  const icons = {
                    warning: <TrendingDown className="w-4 h-4 text-amber-500" />,
                    success: <TrendingUp className="w-4 h-4 text-emerald-500" />,
                    info:    <Info className="w-4 h-4 text-blue-500" />,
                  };
                  return (
                    <div key={i} className={`rounded-xl border-l-4 p-4 ${colors[h.type]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {icons[h.type]}
                        <span className="font-semibold text-sm text-gray-800">{h.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{h.detail}</p>
                    </div>
                  );
                })}
              </div>

              {aiInsights.bottlenecks?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Top Bottlenecks
                  </h3>
                  <div className="space-y-3">
                    {aiInsights.bottlenecks.map((b, i) => {
                      const sev = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-gray-100 text-gray-600" };
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${sev[b.severity]}`}>
                            {b.severity}
                          </span>
                          <div>
                            <div className="font-semibold text-sm text-gray-800">{b.area}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{b.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TASK LIST ── */}
          {aiTaskList && !aiLoading && activeAITab === "tasks" && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-gray-400" />
                <h3 className="font-bold text-sm">Prioritized Action Items</h3>
                <span className="ml-auto text-xs bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                  {aiTaskList.tasks?.length ?? 0} tasks
                </span>
                <CopyButton
                  getText={() => formatTaskListForCopy(aiTaskList.tasks ?? [])}
                  label="Copy all"
                  iconClass="w-3.5 h-3.5"
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                />
              </div>
              <div className="divide-y divide-gray-50">
                {aiTaskList.tasks?.map((t) => {
                  const pColors = {
                    critical: "bg-red-500 text-white",
                    high:     "bg-orange-400 text-white",
                    medium:   "bg-amber-400 text-white",
                    low:      "bg-gray-200 text-gray-600",
                  };
                  const aColors = {
                    fix:      "bg-red-50 text-red-700",
                    generate: "bg-blue-50 text-blue-700",
                    review:   "bg-purple-50 text-purple-700",
                    optimize: "bg-teal-50 text-teal-700",
                  };
                  return (
                    <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-gray-50/50">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${pColors[t.priority]}`}>
                        {t.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-gray-900">{t.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${aColors[t.action_type]}`}>
                            {t.action_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pColors[t.priority]}`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1.5">{t.description}</p>
                        <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
                          <span><strong className="text-gray-500">Based on:</strong> {t.metric_basis}</span>
                          <span><strong className="text-gray-500">Impact:</strong> {t.estimated_impact}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-500">
                          Planning only
                        </span>
                        <CopyButton
                          getText={() => formatTaskForCopy(t)}
                          className="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STRATEGY PLAN ── */}
          {aiStrategy && !aiLoading && activeAITab === "strategy" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Strategic Goal</span>
                </div>
                <p className="text-base font-semibold">{aiStrategy.goal}</p>
              </div>

              <div className="space-y-3">
                {aiStrategy.phases?.map((ph) => (
                  <div key={ph.phase} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {ph.phase}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-gray-900">{ph.name}</div>
                        <div className="text-xs text-gray-400">{ph.duration} · Key metric: {ph.key_metric}</div>
                      </div>
                    </div>
                    <div className="p-4 grid sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Objectives</div>
                        <ul className="space-y-1">
                          {ph.objectives?.map((o, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                              <ChevronRight className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" />{o}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</div>
                        <ul className="space-y-1">
                          {ph.actions?.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                              <ChevronRight className="w-3 h-3 mt-0.5 text-red-400 flex-shrink-0" />{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Success Criteria</div>
                  <ul className="space-y-1">
                    {aiStrategy.success_criteria?.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Risks</div>
                  <ul className="space-y-2">
                    {aiStrategy.risks?.map((r, i) => (
                      <li key={i} className="text-xs text-red-800">
                        <div className="font-semibold">{r.risk}</div>
                        <div className="text-red-600 mt-0.5">↳ {r.mitigation}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!aiLoading && !aiError && !aiInsights && !aiTaskList && !aiStrategy && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 flex flex-col items-center gap-3 text-center">
              <Sparkles className="w-8 h-8 text-gray-300" />
              <p className="text-gray-500 text-sm">Click an action above to run the AI Analyst against your live metrics.</p>
              <p className="text-gray-400 text-xs">The agent reads all grade coverage, queue status, and RAG data before responding.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Execute Task Modal ── */}
      {execModal?.open && execModal.task && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-lg">Queue in Command Center</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Task Summary */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{execModal.task.title}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {execModal.task.action_type}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{execModal.task.description}</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <div><strong>Metric:</strong> {execModal.task.metric_basis}</div>
                  <div><strong>Impact:</strong> {execModal.task.estimated_impact}</div>
                </div>
              </div>

              {/* Result / Error */}
              {execResult && (
                <div className={`rounded-lg p-3 text-sm ${
                  execResult.error
                    ? "bg-red-50 text-red-700"
                    : execResult.created
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-blue-50 text-blue-700"
                }`}>
                  {execResult.error ? (
                    <>
                      <div className="font-semibold mb-1">Error</div>
                      <p>{execResult.error}</p>
                    </>
                  ) : execResult.created ? (
                    <>
                      <div className="font-semibold mb-1">Queued Successfully</div>
                      <p>{execResult.preview}</p>
                      <div className="mt-2 space-y-1 text-xs font-semibold">
                        <div>Issue ID: {execResult.issue_id}</div>
                        <div>Task ID: {execResult.task_id}</div>
                        <div>Approval required: {execResult.approval_required ? "Yes" : "No"}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold mb-1">Preview</div>
                      <p>{execResult.preview}</p>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setExecModal(null)}
                  disabled={execLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  {execResult?.created ? "Close" : "Cancel"}
                </button>
                {execResult?.created ? (
                  <button
                    onClick={() => navigate("/admin/ai-command-center")}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black transition-colors"
                  >
                    Open Command Center
                  </button>
                ) : (
                  <button
                    onClick={() => sendTaskToCommandCenter(execModal.task)}
                    disabled={execLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    {execLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Create Workflow
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
};
