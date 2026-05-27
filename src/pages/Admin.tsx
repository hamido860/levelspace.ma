import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import { checkSupabaseConnection, supabase } from "../db/supabase";
import { useAuth } from "../context/AuthContext";
import { validateMetrics, formatValidationErrors } from "../services/metricsValidator";
import { getAiApiKey, getAiCredentialMode, getAiModel, getAiProvider } from "../services/geminiService";
import {
  AdminGradeRow,
  AiExecutionSnapshotDebugRow,
  AiObservabilityDebugData,
  AdminOverviewKpis,
  AdminTableHealth,
  AiTaskLogDebugRow,
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
  loadAiObservabilityDebugData,
  loadAiRecoveryReviewStatusCounts,
  repairRagTopicLinks,
  repairTopicsFromLessons,
  RagTopicRepairResult,
} from "../services/adminDashboardService";
import {
  RefreshCw, Database, BarChart2, BookOpen, Cpu, Table2,
  AlertTriangle, CheckCircle, Clock, Layers, Sparkles,
  Lightbulb, ListChecks, Map as MapIcon, ChevronRight,
  TrendingUp, TrendingDown, Info, Zap, KeyRound,
  Trash2, Wrench, Play, Pencil, ChevronDown, Brain, ShieldCheck, GraduationCap,
  Copy, Check, PackageSearch
} from "lucide-react";
import { AdminCurriculumDebug } from "./AdminCurriculumDebug";
import { AdminMcpLessons } from "./AdminMcpLessons";
import { AiKeysModal } from "../components/settings/AiKeysModal";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BrowseRow { [key: string]: any; }

type Tab = "overview" | "grades" | "queue" | "rag" | "browser" | "ai" | "curriculum" | "mcp";
const ADMIN_TAB_CONFIG: Record<Tab, { label: string; icon: React.ElementType; activeClass: string; iconClass: string }> = {
  overview: {
    label: "Overview",
    icon: ShieldCheck,
    activeClass: "border-sky-500 bg-sky-50 text-sky-600",
    iconClass: "text-sky-500",
  },
  grades: {
    label: "Grade Coverage",
    icon: GraduationCap,
    activeClass: "border-indigo-500 bg-indigo-50 text-indigo-600",
    iconClass: "text-indigo-500",
  },
  queue: {
    label: "Gen Queue",
    icon: Clock,
    activeClass: "border-amber-500 bg-amber-50 text-amber-700",
    iconClass: "text-amber-500",
  },
  rag: {
    label: "RAG / Embeddings",
    icon: Layers,
    activeClass: "border-violet-500 bg-violet-50 text-violet-600",
    iconClass: "text-violet-500",
  },
  browser: {
    label: "Table Browser",
    icon: Table2,
    activeClass: "border-slate-500 bg-slate-100 text-slate-700",
    iconClass: "text-slate-500",
  },
  ai: {
    label: "AI Analyst",
    icon: Brain,
    activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700",
    iconClass: "text-emerald-500",
  },
  curriculum: {
    label: "Curriculum",
    icon: Database,
    activeClass: "border-pink-500 bg-pink-50 text-pink-700",
    iconClass: "text-pink-500",
  },
  mcp: {
    label: "MCP Lessons",
    icon: PackageSearch,
    activeClass: "border-orange-500 bg-orange-50 text-orange-700",
    iconClass: "text-orange-500",
  },
};

const countDistinctIds = (rows: Array<{ topic_id?: string | null }> | null | undefined) =>
  new Set((rows || []).map((row) => row.topic_id).filter((value): value is string => Boolean(value))).size;
 
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
      <div className="w-24 h-2 rounded-full bg-surface-mid overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-ink-muted">{p}%</span>
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
    unknown:   "bg-surface-mid text-ink-secondary",
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
  let classes = "bg-surface-mid text-ink-secondary";
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

const formatDebugTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getDebugMetadataValue = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return value === null || value === undefined || value === "" ? "—" : String(value);
};

const formatDebugJson = (value: unknown) => {
  if (!value) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-10 text-ink-muted gap-3 text-sm">
    <RefreshCw className="w-4 h-4 animate-spin" />
    Loading…
  </div>
);

const KPI: React.FC<{ label: string; value: number | string; sub?: string; variant?: "default" | "warn" | "danger" | "success" }> = ({
  label, value, sub, variant = "default",
}) => {
  const colors = {
    default: "text-ink",
    warn:    "text-amber-500",
    danger:  "text-red-500",
    success: "text-emerald-600",
  };
  return (
    <div className="bg-paper rounded-xl border border-surface-mid p-4 shadow-sm">
      <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-extrabold ${colors[variant]}`}>{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { loading: authLoading, isDemoAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [isAiKeysOpen, setIsAiKeysOpen] = useState(false);

  // Overview state
  const [kpis, setKpis] = useState<AdminOverviewKpis>({
    topics: 0,
    completedJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    lessonQueueDone: 0,
    lessonQueuePending: 0,
    lessonQueueFailed: 0,
    recoveredLessonsNeedsReview: 0,
    studentPublishReadyLessons: 0,
    ragTotal: 0,
    ragDone: 0,
    ragEmbedded: 0,
    ragLinkedToTopic: 0,
    ragUsable: 0,
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
  const [ragStats, setRagStats] = useState<RagMetrics>({ total: 0, done: 0, embedded: 0, linkedToTopic: 0, usable: 0, pending: 0, other: 0, byStatus: {} });
  const [ragByGrade, setRagByGrade] = useState<RagByGrade[]>([]);

  // AI Analyst
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]   = useState("");
  const [aiInsights, setAiInsights]   = useState<AIInsights | null>(null);
  const [aiTaskList, setAiTaskList]   = useState<AITaskList | null>(null);
  const [aiStrategy, setAiStrategy]   = useState<AIStrategy | null>(null);
  const [activeAITab, setActiveAITab] = useState<AIAction>("insights");
  const [aiObservability, setAiObservability] = useState<AiObservabilityDebugData>({ logs: [], snapshots: [] });
  const [topicRepairLoading, setTopicRepairLoading] = useState(false);
  const [topicRepairMsg, setTopicRepairMsg] = useState("");

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
  const [ragRepairLoading, setRagRepairLoading] = useState(false);
  const [ragRepairResult, setRagRepairResult] = useState<RagTopicRepairResult | null>(null);
  const [ragRepairError, setRagRepairError] = useState("");

  // Dormant modal state kept isolated until protected workflow routes are added.
  const [execModal, setExecModal] = useState<{ task: any; open: boolean } | null>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);


  // Fallback: use regular Supabase queries instead of raw SQL RPC
  const loadOverview = useCallback(async () => {
    const [
      { count: topicsCount },
      { data: lessonTopicLinks },
      { data: queueRows },
      { count: ragTotal },
      { count: ragEmbedded },
      { count: ragLinkedToTopic },
      { count: ragUsable },
      { count: usersCount },
    ] = await Promise.all([
      supabase.from("topics").select("*", { count: "exact", head: true }),
      supabase.from("lessons").select("topic_id"),
      supabase.from("lesson_gen_queue").select("topic_id, status"),
      supabase.from("rag_chunks").select("*", { count: "exact", head: true }),
      supabase.from("rag_embeddings").select("*", { count: "exact", head: true }),
      supabase.from("rag_chunks").select("*", { count: "exact", head: true }).not("topic_id", "is", null),
      supabase.from("rag_embeddings").select("chunk_id, rag_chunks!inner(topic_id,status)", { count: "exact", head: true }).not("rag_chunks.topic_id", "is", null).in("rag_chunks.status", ["clean", "embedded"]),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const coveredTopicsCount = countDistinctIds(lessonTopicLinks as Array<{ topic_id?: string | null }> | null);
    const queueTopicCount = countDistinctIds(queueRows as Array<{ topic_id?: string | null }> | null);
    const normalizedTopicsCount = Math.max(topicsCount ?? 0, coveredTopicsCount, queueTopicCount);
    const normalizedQueueRows = (queueRows || []) as Array<{ status?: string | null }>;
    const completedCount = normalizedQueueRows.filter((row) => row.status === "done").length;
    const pendingCount = normalizedQueueRows.filter((row) => row.status === "pending").length;
    const failedCount = normalizedQueueRows.filter((row) => row.status === "failed").length;

    setKpis({
      topics: normalizedTopicsCount,
      completedJobs: completedCount,
      pendingJobs: pendingCount,
      failedJobs: failedCount,
      lessonQueueDone: completedCount,
      lessonQueuePending: pendingCount,
      lessonQueueFailed: failedCount,
      recoveredLessonsNeedsReview: 0,
      studentPublishReadyLessons: 0,
      ragTotal: ragTotal ?? 0,
      ragDone: ragEmbedded ?? 0,
      ragEmbedded: ragEmbedded ?? 0,
      ragLinkedToTopic: ragLinkedToTopic ?? 0,
      ragUsable: ragUsable ?? 0,
      users: usersCount ?? 0,
    });
  }, []);

  const loadTableHealth = useCallback(async () => {
    // Get counts for major tables
    const tableNames = [
      "profiles","lessons","topics","grades","subjects","cycles","curricula",
      "lesson_gen_queue","rag_chunks","rag_questions","exercises","quizzes",
      "quiz_results","exercise_attempts","notes","tasks","schedule","settings",
      "app_settings","audits","topic_outlines","lesson_gen_log","student_progress",
      "student_answers","ghost_interventions","lesson_blocks","skills","user_skills",
      "bac_sections","bac_tracks","bac_exams","bac_track_subjects","grade_subjects",
      "embeddings","embeddings_archive",
    ];
    const results = await Promise.all(
      tableNames.map(async (t) => {
        const { count } = await supabase.from(t as any).select("*", { count: "exact", head: true });
        return {
          table_name: t,
          row_count: count,
          health_status: (count ?? 0) > 0 ? "present" : "empty",
        } satisfies AdminTableHealth;
      })
    );
    setTableHealth(results.sort((a, b) => (b.row_count ?? -1) - (a.row_count ?? -1)));
  }, []);
 
  const loadGrades = useCallback(async () => {
    const { data: grades } = await supabase
      .from("grades")
      .select("id, name, grade_order, cycle_id, cycles(name, cycle_order)");

    const { data: topics } = await supabase
      .from("topics")
      .select("id, grade_id");

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, topic_id");

    const { data: queue } = await supabase
      .from("lesson_gen_queue")
      .select("id, topic_id, status");

    if (!grades) return;

    const rows: AdminGradeRow[] = grades.map((g: any) => {
      const gradeTopics = (topics || []).filter((t: any) => t.grade_id === g.id);
      const topicIds = new Set(gradeTopics.map((t: any) => t.id));
      const coveredTopicIds = new Set(
        (lessons || [])
          .map((l: any) => l.topic_id)
          .filter((topicId: string | null | undefined): topicId is string => Boolean(topicId) && topicIds.has(topicId))
      );
      const gradeQueue = (queue || []).filter((q: any) => topicIds.has(q.topic_id));
      const cycle: any = g.cycles;
      return {
        id: g.id,
        cycle: cycle?.name ?? "Unknown",
        cycle_order: cycle?.cycle_order ?? 0,
        grade: g.name,
        grade_order: g.grade_order,
        total_topics: gradeTopics.length,
        lesson_rows: coveredTopicIds.size,
        lessons_covered: coveredTopicIds.size,
        topic_coverage: coveredTopicIds.size,
        linked_lessons: coveredTopicIds.size,
        unlinked_lessons: 0,
        coverage_source: coveredTopicIds.size > 0 ? "topic_id" : "none",
        data_notes: [],
        q_done: gradeQueue.filter((q: any) => q.status === "done").length,
        q_pending: gradeQueue.filter((q: any) => q.status === "pending").length,
        q_failed: gradeQueue.filter((q: any) => q.status === "failed").length,
        needs_review: 0,
      };
    });
    rows.sort((a, b) => a.cycle_order - b.cycle_order || a.grade_order - b.grade_order);
    setGradeData(rows);
  }, []);

  const loadQueue = useCallback(async () => {
    const { data: qAll } = await supabase.from("lesson_gen_queue").select("status");
    const stats: QueueStatusBreakdown = {
      done: 0,
      pending: 0,
      failed: 0,
      processing: 0,
      other: 0,
      unresolvedTopicJobs: 0,
      otherStatuses: [],
    };
    (qAll || []).forEach((r: any) => { if (r.status in stats) (stats as any)[r.status]++; });
    setQueueStats(stats);

    const { data: failed } = await supabase
      .from("lesson_gen_queue")
      .select("id, topic_id, track_id, attempts, last_error, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(10);
    const topicIds = Array.from(
      new Set((failed || []).map((job: any) => job.topic_id).filter((topicId: string | null | undefined): topicId is string => Boolean(topicId)))
    );

    let topicsById = new Map<string, string>();
    if (topicIds.length > 0) {
      const { data: topicRows } = await supabase
        .from("topics")
        .select("id, title")
        .in("id", topicIds);

      topicsById = new Map((topicRows || []).map((topic: any) => [topic.id, topic.title]));
    }

    setFailedJobs((failed || []).map((job: any) => ({
      ...job,
      topics: job.topic_id ? { title: topicsById.get(job.topic_id) ?? null } : null,
    })));
  }, []);

  const loadRag = useCallback(async () => {
    const { data: all } = await supabase.from("rag_chunks").select("embedding_status, grade_id");
    const { count: rqCount } = await supabase.from("rag_questions").select("*", { count: "exact", head: true });

    const byStatus: any = {};
    (all || []).forEach((r: any) => {
      byStatus[r.embedding_status] = (byStatus[r.embedding_status] || 0) + 1;
    });
    setRagStats({
      ...byStatus,
      rqCount: rqCount ?? 0,
      total: (all || []).length,
      done: byStatus.done || 0,
      embedded: byStatus.done || 0,
      linkedToTopic: 0,
      usable: 0,
      pending: byStatus.pending || 0,
      other: (all || []).filter((row: any) => !["done", "pending", "processing", "failed"].includes(String(row.embedding_status || ""))).length,
      byStatus,
    });

    const { data: grades } = await supabase
      .from("grades")
      .select("id, name, grade_order, cycles(cycle_order)");

    const ragRows: RagByGrade[] = (grades || []).map((g: any) => {
      const chunks = (all || []).filter((c: any) => c.grade_id === g.id);
      const cycle: any = g.cycles;
      return {
        id: g.id,
        grade: g.name,
        grade_order: g.grade_order,
        cycle_order: cycle?.cycle_order ?? 0,
        total: chunks.length,
        done: chunks.filter((c: any) => c.embedding_status === "done").length,
        pending: chunks.filter((c: any) => c.embedding_status === "pending").length,
        other: chunks.filter((c: any) => !["done", "pending"].includes(String(c.embedding_status || ""))).length,
      };
    });
    ragRows.sort((a, b) => a.cycle_order - b.cycle_order || a.grade_order - b.grade_order);
    setRagByGrade(ragRows);
  }, []);

  const handleRepairRagTopicLinks = useCallback(async () => {
    setRagRepairLoading(true);
    setRagRepairError("");
    try {
      const result = await repairRagTopicLinks();
      setRagRepairResult(result);
      const rag = await loadAdminRagMetrics();
      setRagStats(rag.ragStats);
      setRagByGrade(rag.ragByGrade);
    } catch (error) {
      setRagRepairError(error instanceof Error ? error.message : "Unable to repair RAG topic links.");
    } finally {
      setRagRepairLoading(false);
    }
  }, []);

  // ── AI Agent caller ──────────────────────────────────────────────────────
  const callAgent = useCallback(async (action: AIAction) => {
    setAiLoading(true);
    setAiError("");

    // Build a compact metrics snapshot from live state
    const lessonRowsTotal = gradeData.reduce((sum, grade) => sum + (grade.lesson_rows ?? grade.lessons_covered), 0);
    const topicCoverageTotal = gradeData.reduce((sum, grade) => sum + (grade.topic_coverage ?? grade.lessons_covered), 0);
    const metricsSnapshot: any = {
      totalTopics: kpis.topics,
      lessonsGenerated: lessonRowsTotal,
      completedJobs: kpis.completedJobs,
      lessonCoverage: `${pct(topicCoverageTotal, kpis.topics)}%`,
      queuePending: kpis.pendingJobs,
      lessonQueuePending: kpis.lessonQueuePending,
      lessonQueueFailed: kpis.lessonQueueFailed,
      lessonQueueDone: kpis.lessonQueueDone,
      failedJobs: kpis.failedJobs,
      ragChunksTotal: kpis.ragTotal,
      ragChunksEmbedded: kpis.ragEmbedded,
      ragChunksLinkedToTopic: kpis.ragLinkedToTopic,
      ragChunksUsable: kpis.ragUsable,
      ragCoverage: `${pct(kpis.ragUsable, kpis.ragTotal)}%`,
      totalUsers: kpis.users,
      recoveredLessonsNeedingReview: kpis.recoveredLessonsNeedsReview,
      studentPublishReadyLessons: kpis.studentPublishReadyLessons,
      aiRecoveryTaskReviewStatuses: aiReviewStatuses,
      gradeBreakdown: gradeData.map(g => ({
        grade: g.grade,
        cycle: g.cycle,
        topics: g.total_topics,
        lessons: g.lesson_rows ?? g.lessons_covered,
        topicCoverage: g.topic_coverage ?? g.lessons_covered,
        completedJobs: g.q_done,
        coverage: `${pct(g.topic_coverage ?? g.lessons_covered, g.total_topics)}%`,
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
      const provider = getAiProvider() || undefined;
      const model = getAiModel() || undefined;
      const requestApiKey = provider ? getAiApiKey(provider) : getAiApiKey();
      const credentialMode = getAiCredentialMode() === "byok" && (accessToken || requestApiKey) ? "byok" : "platform";
      const res = await fetch("/api/ai-analyst", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(isDemoAdmin ? { "x-levelspace-demo-admin": "true" } : {}),
        },
        body: JSON.stringify({
          metrics: metricsSnapshot,
          action,
          provider,
          model,
          credentialMode,
          requestApiKey: credentialMode === "byok" ? requestApiKey : undefined,
        }),
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
  }, [aiReviewStatuses, gradeData, isDemoAdmin, kpis, tableHealth]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, health, grades, queue, rag, reviewStatuses, observabilityDebug] = await Promise.all([
        loadAdminOverviewKpis(),
        loadAdminTableHealth(),
        loadAdminGradeMetrics(),
        loadAdminQueueMetrics(),
        loadAdminRagMetrics(),
        loadAiRecoveryReviewStatusCounts(),
        loadAiObservabilityDebugData(),
      ]);
      setKpis(overview);
      setTableHealth(health);
      setGradeData(grades);
      setQueueStats(queue.stats);
      setFailedJobs(queue.failedJobs);
      setRagStats(rag.ragStats);
      setRagByGrade(rag.ragByGrade);
      setAiReviewStatuses(reviewStatuses);
      setAiObservability(observabilityDebug);
      setDashboardError("");
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      console.error(e);
      setDashboardError(e.message || "Unable to load live admin metrics from Supabase.");
    }
    setLoading(false);
  }, []);

  const handleRepairTopics = useCallback(async () => {
    setTopicRepairLoading(true);
    setTopicRepairMsg("");
    try {
      const summary = await repairTopicsFromLessons();
      setTopicRepairMsg(`Linked ${summary.lessonsLinked} lessons and created ${summary.topicsCreated} topics.`);
      await refreshAll();
    } catch (e: any) {
      setTopicRepairMsg(e.message || "Unable to repair topics from lessons.");
    }
    setTopicRepairLoading(false);
  }, [refreshAll]);

  // Wait for auth to hydrate before firing queries — anon role has no SELECT
  // policy on most tables, so running these as anon would return 0 / null and
  // mislead the AI Analyst into reporting tables as "empty".
  useEffect(() => { if (!authLoading) refreshAll(); }, [authLoading, refreshAll]);

  const lessonsTableCount = tableHealth.find((entry) => entry.table_name === "lessons")?.row_count ?? 0;
  const topicsTableCount = tableHealth.find((entry) => entry.table_name === "topics")?.row_count ?? 0;
  const shouldOfferTopicRepair = lessonsTableCount > 0 && topicsTableCount === 0;

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
    if (!(await checkSupabaseConnection())) {
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
    if (!(await checkSupabaseConnection())) {
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

  const tabs: Tab[] = ["overview", "grades", "queue", "rag", "browser", "ai", "curriculum", "mcp"];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <SEO title="Admin Panel" />
      <div className="admin-theme-scope">

      {/* Page Header */}
      <div className="border-b border-slate-100 dark:border-white/5 pb-5 mb-6">
        <h1 className="ls-page-title text-slate-950 dark:text-ink">Admin Panel</h1>
      </div>


      {dashboardError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-semibold">Live admin metrics are unavailable.</div>
          <div className="mt-1">{dashboardError}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/8 -mb-px overflow-x-auto pb-2 mb-6">
        {tabs.map((tabKey) => {
          const tabConfig = ADMIN_TAB_CONFIG[tabKey];
          const TabIcon = tabConfig.icon;
          const isActive = tab === tabKey;
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tabConfig.label}
            </button>
          );
        })}
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
            <KPI label="RAG Chunks" value={kpis.ragTotal ?? "—"} sub={`${pct(kpis.ragUsable, kpis.ragTotal)}% usable`} variant="success" />
            <KPI label="RAG Linked" value={kpis.ragLinkedToTopic ?? "—"} sub="rag_chunks.topic_id is set" />
            <KPI label="RAG Usable" value={kpis.ragUsable ?? "—"} sub="embedded + linked + done" variant="success" />
            <KPI label="Users" value={kpis.users ?? "—"} sub="profiles" />
          </div>

          {shouldOfferTopicRepair && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    Topics are empty while lessons already exist
                  </div>
                  <p className="mt-1 text-sm text-amber-700">
                    The admin panel found {lessonsTableCount} lessons but 0 rows in `topics`. Run the repair to recreate topic rows and relink existing lessons.
                  </p>
                  {topicRepairMsg && (
                    <p className="mt-2 text-xs font-medium text-amber-900">{topicRepairMsg}</p>
                  )}
                </div>
                <button
                  onClick={handleRepairTopics}
                  disabled={topicRepairLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {topicRepairLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Repairing...
                    </>
                  ) : (
                    "Repair Topics"
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-ink-muted" />
              <h2 className="font-bold text-sm">AI Recovery Review Status</h2>
            </div>
            {loading ? <Spinner /> : aiReviewStatuses.length === 0 ? (
              <div className="p-5 text-sm text-ink-muted">No `lesson_generation` AI task review statuses were found in Supabase.</div>
            ) : (
              <div className="flex flex-wrap gap-3 p-5">
                {aiReviewStatuses.map((item) => (
                  <div key={item.status} className="rounded-lg border border-surface-mid bg-surface-low px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-ink-muted">{item.status}</div>
                    <div className="text-lg font-bold text-ink">{item.count}</div>
                  </div>
                ))}
              </div>
            )}
 
          </div>

          <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <Database className="w-4 h-4 text-ink-muted" />
              <h2 className="font-bold text-sm">Table Health</h2>
              <span className="ml-auto text-xs bg-surface-low border border-surface-mid px-2 py-0.5 rounded-full text-ink-muted">
                {tableHealth.length} tables
              </span>
            </div>
            {loading ? <Spinner /> : tableHealth.length === 0 ? (
              <div className="p-5 text-sm text-ink-muted">No confirmed admin tables were available to inspect.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-low text-xs text-ink-muted uppercase tracking-wide">
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
                        <tr key={t.table_name} className="border-t border-white/10 hover:bg-surface-low/50">
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
        <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-ink-muted" />
            <h2 className="font-bold text-sm">Grade-by-Grade Content Coverage</h2>
          </div>
          {topicsTableCount === 0 && lessonsTableCount > 0 && (
            <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Supabase has {lessonsTableCount} lesson rows but 0 topic rows. Grade coverage now shows direct lesson-grade matches, and topic coverage remains unavailable until topics are repaired.
            </div>
          )}
          {queueStats.unresolvedTopicJobs > 0 && (
            <div className="mx-5 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {queueStats.unresolvedTopicJobs} queue jobs have missing or orphan topic anchors, so they cannot be assigned safely to a grade row.
            </div>
          )}
          {loading ? <Spinner /> : gradeData.length === 0 ? (
            <div className="p-5 text-sm text-ink-muted">No grade rows were returned from Supabase.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-low text-xs text-ink-muted uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Grade</th>
                    <th className="px-4 py-2 text-left">Topics</th>
                    <th className="px-4 py-2 text-left">Lessons</th>
                    <th className="px-4 py-2 text-left">Topic Coverage</th>
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
                            <tr className="bg-surface-mid">
                              <td colSpan={8} className="px-4 py-2 font-bold text-xs text-ink-secondary">
                                🎓 {row.cycle}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t border-white/10 hover:bg-surface-low/40">
                            <td className="px-4 py-2">{row.grade}</td>
                            <td className="px-4 py-2">{row.total_topics}</td>
                            <td className="px-4 py-2">
                              <div className="font-medium">{row.lesson_rows ?? row.lessons_covered}</div>
                              {row.coverage_source === "lesson_grade" && (
                                <div className="text-[11px] text-amber-600">matched by lesson.grade</div>
                              )}
                              {(row.unlinked_lessons ?? 0) > 0 && row.coverage_source !== "lesson_grade" && (
                                <div className="text-[11px] text-amber-600">{row.unlinked_lessons} unlinked</div>
                              )}
                            </td>
                            <td className="px-4 py-2"><ProgressBar val={row.topic_coverage ?? row.lessons_covered} total={row.total_topics} /></td>
                            <td className="px-4 py-2"><Pill status="done" label={row.q_done} /></td>
                            <td className="px-4 py-2"><Pill status="pending" label={row.q_pending} /></td>
                            <td className="px-4 py-2">
                              {row.q_failed > 0
                                ? <Pill status="failed" label={row.q_failed} />
                                : <span className="text-ink-muted text-xs">0</span>}
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

          <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-muted" />
              <h2 className="font-bold text-sm">Generation Queue — by Grade</h2>
            </div>
            {loading ? <Spinner /> : gradeData.length === 0 ? (
              <div className="p-5 text-sm text-ink-muted">No queue-to-grade mappings were returned from Supabase.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-low text-xs text-ink-muted uppercase tracking-wide">
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
                              <tr className="bg-surface-mid">
                                <td colSpan={5} className="px-4 py-2 font-bold text-xs text-ink-secondary">
                                  {row.cycle}
                                </td>
                              </tr>
                            )}
                            <tr className="border-t border-white/10 hover:bg-surface-low/40">
                              <td className="px-4 py-2">{row.grade}</td>
                              <td className="px-4 py-2"><Pill status="done" label={row.q_done} /></td>
                              <td className="px-4 py-2"><Pill status="pending" label={row.q_pending} /></td>
                              <td className="px-4 py-2">
                                {row.q_failed > 0
                                  ? <Pill status="failed" label={row.q_failed} />
                                  : <span className="text-ink-muted text-xs">0</span>}
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

          <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h2 className="font-bold text-sm">Recent Failed Jobs</h2>
              <span className="ml-auto text-xs text-ink-muted">latest 10 rows from `lesson_gen_queue`</span>
            </div>
            {loading ? <Spinner /> : failedJobs.length === 0 ? (
              <div className="flex items-center gap-2 p-5 text-emerald-600 text-sm">
                <CheckCircle className="w-4 h-4" /> No failed jobs!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-low text-xs text-ink-muted uppercase tracking-wide">
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
                      <tr key={j.id} className="border-t border-white/10 hover:bg-surface-low/40">
                        <td className="px-4 py-2">{(j.topics as any)?.title ?? j.topic_id}</td>
                        <td className="px-4 py-2 font-mono text-xs text-ink-muted">{j.track_id ?? "—"}</td>
                        <td className="px-4 py-2">{j.attempts}</td>
                        <td className="px-4 py-2 text-red-500 text-xs max-w-xs truncate">{(j.last_error ?? "").substring(0, 100)}</td>
                        <td className="px-4 py-2 text-xs text-ink-muted">{new Date(j.created_at).toLocaleDateString()}</td>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <KPI label="Total Chunks" value={(ragStats.total ?? 0).toLocaleString()} sub="in rag_chunks" />
            <KPI label="Embedding Done" value={(ragStats.embedded ?? 0).toLocaleString()} sub="rag_chunks.embedding_status = done" variant="success" />
            <KPI label="Linked to Topic" value={(ragStats.linkedToTopic ?? 0).toLocaleString()} sub="topic_id is not null" />
            <KPI label="Usable" value={(ragStats.usable ?? 0).toLocaleString()} sub="content + topic + grade + embedding" variant="success" />
            <KPI label="Pending" value={(ragStats.pending ?? 0).toLocaleString()} sub="embedding_status = pending" variant="warn" />
            <KPI label="Unlinked" value={(ragStats.unlinkedToTopic ?? 0).toLocaleString()} sub="topic_id is null" variant="warn" />
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-paper p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Fix RAG Topic Links</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Safely links chunks by lesson_id, valid metadata topic_id, exact title matches, or one unambiguous grade/subject topic. Ambiguous chunks stay unmatched.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="ls-badge">with grade {(ragStats.withGrade ?? 0).toLocaleString()}</span>
                  <span className="ls-badge">with embedding {(ragStats.withEmbedding ?? 0).toLocaleString()}</span>
                  <span className="ls-badge">missing embedding {(ragStats.missingEmbedding ?? 0).toLocaleString()}</span>
                  <span className="ls-badge">short content {(ragStats.shortContent ?? 0).toLocaleString()}</span>
                  <span className="ls-badge">unmatched {(ragStats.unmatched ?? 0).toLocaleString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRepairRagTopicLinks}
                disabled={ragRepairLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {ragRepairLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                Fix RAG Topic Links
              </button>
            </div>
            {ragRepairError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{ragRepairError}</p>
            )}
            {ragRepairResult && (
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-950">Before / after</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>Usable: {ragRepairResult.before.usable_chunks.toLocaleString()} {"->"} {ragRepairResult.after.usable_chunks.toLocaleString()}</div>
                    <div>Linked: {ragRepairResult.before.with_topic_id.toLocaleString()} {"->"} {ragRepairResult.after.with_topic_id.toLocaleString()}</div>
                    <div>Unlinked: {ragRepairResult.before.without_topic_id.toLocaleString()} {"->"} {ragRepairResult.after.without_topic_id.toLocaleString()}</div>
                    <div>Unmatched: {ragRepairResult.after.unmatched.toLocaleString()}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="ls-badge">lesson_id {ragRepairResult.methods.lesson_id}</span>
                    <span className="ls-badge">metadata_topic_id {ragRepairResult.methods.metadata_topic_id}</span>
                    <span className="ls-badge">title_match {ragRepairResult.methods.title_match}</span>
                    <span className="ls-badge">unmatched {ragRepairResult.methods.unmatched}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Sample unmatched chunks</p>
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                    {ragRepairResult.unmatchedSamples.length === 0 ? (
                      <p className="text-sm text-slate-500">No unmatched chunks returned.</p>
                    ) : ragRepairResult.unmatchedSamples.map((chunk) => (
                      <div key={chunk.id} className="rounded-xl border border-slate-200 bg-paper p-3 text-xs text-slate-600">
                        <div className="mb-1 flex flex-wrap gap-2">
                          <span className="font-mono text-slate-500">{chunk.id.slice(0, 8)}</span>
                          <span>{chunk.embedding_status}</span>
                          <span>{chunk.reason}</span>
                        </div>
                        <p className="line-clamp-2">{chunk.metadata_title || chunk.content_preview}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <Layers className="w-4 h-4 text-ink-muted" />
              <h2 className="font-bold text-sm">RAG Chunks — by Grade</h2>
              <span className="ml-auto text-xs text-ink-muted">Click a row to inspect the latest 100 chunks for that grade</span>
            </div>
            {loading ? <Spinner /> : ragByGrade.length === 0 ? (
              <div className="p-5 text-sm text-ink-muted">No RAG chunks were returned from Supabase for any grade.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-low text-xs text-ink-muted uppercase tracking-wide">
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
                        <tr className="border-t border-white/10 hover:bg-surface-low/40">
                          <td className="px-4 py-2">{row.grade}</td>
                          <td className="px-4 py-2">{row.total.toLocaleString()}</td>
                          <td className="px-4 py-2"><Pill status="done" label={row.done.toLocaleString()} /></td>
                          <td className="px-4 py-2"><Pill status="pending" label={row.pending.toLocaleString()} /></td>
                          <td className="px-4 py-2"><Pill status={row.other > 0 ? "failed" : "done"} label={row.other.toLocaleString()} /></td>
                          <td className="px-4 py-2"><ProgressBar val={row.done} total={row.total || 1} /></td>
                          <td className="px-4 py-2">
                            <button onClick={() => loadRagChunks(row.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-surface-mid text-ink-secondary hover:bg-surface-mid transition-colors">
                              <ChevronDown className={`w-3 h-3 transition-transform ${ragChunkGradeId === row.id ? "rotate-180" : ""}`} />
                              {ragChunkGradeId === row.id ? "Hide" : "Browse"}
                            </button>
                          </td>
                        </tr>
                        {ragChunkGradeId === row.id && (
                          <tr>
                            <td colSpan={7} className="bg-surface-low px-4 py-3">
                              {ragChunkLoading ? <Spinner /> : ragChunkError ? (
                                <p className="text-xs text-red-500">{ragChunkError}</p>
                              ) : ragChunks.length === 0 ? (
                                <p className="text-xs text-ink-muted">No chunks found.</p>
                              ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                  {ragChunks.map((c: any) => (
                                    <div key={c.id} className="bg-paper rounded-lg border border-surface-mid p-3 flex items-start gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Pill
                                            status={c.embedding_status === "done" ? "done" : c.embedding_status === "pending" ? "pending" : "failed"}
                                            label={c.embedding_status}
                                          />
                                          {c.source_url && <span className="text-xs text-ink-muted truncate max-w-[200px]">{c.source_url}</span>}
                                        </div>
                                        <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">{c.content}</p>
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
        <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <Table2 className="w-4 h-4 text-ink-muted" />
            <h2 className="font-bold text-sm">Table Browser</h2>
            <span className="ml-auto text-xs text-ink-muted">
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
                  className="text-xs font-medium text-ink-secondary hover:text-ink px-2.5 py-1 rounded border border-surface-mid hover:border-gray-300 transition-colors"
                />
                <CopyButton
                  getText={() => JSON.stringify(browseRows, null, 2)}
                  label="Copy JSON"
                  iconClass="w-3.5 h-3.5"
                  className="text-xs font-medium text-ink-secondary hover:text-ink px-2.5 py-1 rounded border border-surface-mid hover:border-gray-300 transition-colors"
                />
              </>
            )}
          </div>
          <div className="p-5">
            <div className="mb-4 rounded-xl border border-surface-mid bg-surface-low px-4 py-3 text-xs text-ink-secondary">
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
                      ? "bg-ink text-paper border-gray-900"
                      : "bg-paper text-ink-secondary border-surface-mid hover:border-red-400 hover:text-red-500"
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
                className="w-16 border border-surface-mid rounded-lg px-2 py-1.5 text-sm"
                min={1} max={200}
              />
              <span className="text-xs text-ink-muted">rows</span>
              <input
                value={browseFilter}
                onChange={(e) => setBrowseFilter(e.target.value)}
                placeholder="Filter: column=value (e.g. status=failed)"
                className="flex-1 border border-surface-mid rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => browseTable()}
                disabled={!selectedTable}
                className="bg-ink text-paper px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-40"
              >
                Query
              </button>
            </div>

            {/* Results */}
            {browseLoading && <Spinner />}
            {browseError && <p className="text-red-500 text-sm">{browseError}</p>}
            {!browseLoading && !browseError && browseRows.length === 0 && !selectedTable && (
              <p className="text-ink-muted text-sm">Select a table above to start browsing.</p>
            )}
            {!browseLoading && !browseError && browseRows.length === 0 && selectedTable && (
              <p className="text-ink-muted text-sm">No rows returned.</p>
            )}
            {!browseLoading && browseRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-low text-ink-muted uppercase tracking-wide">
                    <tr>
                      {browseCols.map((c) => (
                        <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {browseRows.map((row, i) => (
                      <tr key={i} className="border-t border-white/10 hover:bg-surface-low/60">
                        {browseCols.map((c) => {
                          let v = row[c];
                          if (v === null || v === undefined) return <td key={c} className="px-3 py-2 text-ink-muted">null</td>;
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
                <p className="text-xs text-ink-muted mt-2">{browseRows.length} row(s) from <strong>{selectedTable}</strong></p>
              </div>
            )}

            {/* ── Edit row modal ── */}
            {editRow && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-paper rounded-2xl shadow-sm w-full max-w-lg max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-surface-mid">
                    <h3 className="font-bold text-sm">Edit Row — {selectedTable}</h3>
                    <button onClick={() => setEditRow(null)} className="text-ink-muted hover:text-ink-secondary">✕</button>
                  </div>
                  <div className="overflow-y-auto p-5 space-y-3 flex-1">
                    {Object.entries(editRow.row).filter(([k]) => k !== "id" && k !== "created_at" && k !== "updated_at").map(([k, v]) => (
                      <div key={k}>
                        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{k}</label>
                        <input
                          value={typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                          onChange={(e) => setEditRow(prev => prev ? { ...prev, row: { ...prev.row, [k]: e.target.value } } : null)}
                          className="w-full mt-1 border border-surface-mid rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end px-5 py-4 border-t border-surface-mid">
                    <button onClick={() => setEditRow(null)} className="px-4 py-2 rounded-lg text-sm text-ink-secondary hover:bg-surface-mid">Cancel</button>
                    <button onClick={saveRowEdit} disabled={editSaving}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-paper hover:bg-red-500 disabled:opacity-50">
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
          <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <Database className="w-4 h-4 text-ink-muted" />
              <h2 className="font-bold text-sm">AI Observability</h2>
              <span className="ml-auto text-xs text-ink-muted">
                latest {aiObservability.logs.length}/50 logs · {aiObservability.snapshots.length}/20 snapshots
              </span>
            </div>
            {loading ? <Spinner /> : (
              <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-gray-100">
                <div className="min-w-0">
                  <div className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Task Logs</div>
                  {aiObservability.logs.length === 0 ? (
                    <div className="px-5 pb-5 text-sm text-ink-muted">No rows in `ai_task_logs` yet.</div>
                  ) : (
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface-low text-ink-muted uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-2 text-left">Time</th>
                            <th className="px-4 py-2 text-left">Event</th>
                            <th className="px-4 py-2 text-left">Job</th>
                            <th className="px-4 py-2 text-left">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiObservability.logs.map((log: AiTaskLogDebugRow) => (
                            <tr key={log.id} className="border-t border-white/10 align-top">
                              <td className="px-4 py-2 whitespace-nowrap text-ink-muted">{formatDebugTime(log.created_at)}</td>
                              <td className="px-4 py-2 font-semibold text-ink">{log.log_type}</td>
                              <td className="px-4 py-2 font-mono text-[11px] text-ink-muted">{getDebugMetadataValue(log.metadata, "job_id")}</td>
                              <td className="px-4 py-2 text-ink-secondary">
                                <div>{log.message}</div>
                                <div className="mt-1 font-mono text-[11px] text-ink-muted">
                                  topic {getDebugMetadataValue(log.metadata, "topic_id")} · {getDebugMetadataValue(log.metadata, "duration_ms")} ms
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Execution Snapshots</div>
                  {aiObservability.snapshots.length === 0 ? (
                    <div className="px-5 pb-5 text-sm text-ink-muted">No rows in `ai_execution_snapshots` yet.</div>
                  ) : (
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface-low text-ink-muted uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-2 text-left">Time</th>
                            <th className="px-4 py-2 text-left">Type</th>
                            <th className="px-4 py-2 text-left">Table</th>
                            <th className="px-4 py-2 text-left">Snapshot</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiObservability.snapshots.map((snapshot: AiExecutionSnapshotDebugRow) => (
                            <tr key={snapshot.id} className="border-t border-white/10 align-top">
                              <td className="px-4 py-2 whitespace-nowrap text-ink-muted">{formatDebugTime(snapshot.created_at)}</td>
                              <td className="px-4 py-2 font-semibold text-ink">{snapshot.snapshot_type}</td>
                              <td className="px-4 py-2 text-ink-muted">{snapshot.target_table ?? "—"}</td>
                              <td className="px-4 py-2">
                                <div className="max-w-md truncate font-mono text-[11px] text-ink-muted" title={formatDebugJson(snapshot.snapshot_data)}>
                                  {formatDebugJson(snapshot.snapshot_data)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Header card */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 mb-5 text-paper flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-base">AI Analyst Agent</h2>
                <p className="text-ink-muted text-sm mt-0.5">
                  Powered by <span className="text-paper font-medium">qwen/qwen3-coder-480b-a35b-instruct</span> via NVIDIA NIM.
                  Reads your live database metrics and returns insights, tasks, and strategy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAiKeysOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-paper hover:bg-white/20 cursor-pointer self-start md:self-auto shrink-0 transition-all duration-300"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Manage Admin Keys
              </button>
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
                    ? "bg-ink text-paper border-gray-900"
                    : "bg-paper text-ink-secondary border-surface-mid hover:border-gray-900 hover:text-ink"
                }`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {aiLoading && (
            <div className="bg-paper rounded-xl border border-surface-mid p-8 flex flex-col items-center gap-3 text-ink-muted">
              <div className="w-8 h-8 border-2 border-surface-mid border-t-red-500 rounded-full animate-spin" />
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
              <div className="bg-paper rounded-xl border border-surface-mid p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-sm">Executive Summary</h3>
                </div>
                <p className="text-ink-secondary text-sm leading-relaxed">{aiInsights.summary}</p>
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
                        <span className="font-semibold text-sm text-ink">{h.title}</span>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed">{h.detail}</p>
                    </div>
                  );
                })}
              </div>

              {aiInsights.bottlenecks?.length > 0 && (
                <div className="bg-paper rounded-xl border border-surface-mid p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Top Bottlenecks
                  </h3>
                  <div className="space-y-3">
                    {aiInsights.bottlenecks.map((b, i) => {
                      const sev = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-surface-mid text-ink-secondary" };
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${sev[b.severity]}`}>
                            {b.severity}
                          </span>
                          <div>
                            <div className="font-semibold text-sm text-ink">{b.area}</div>
                            <div className="text-xs text-ink-muted mt-0.5">{b.description}</div>
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
            <div className="bg-paper rounded-xl border border-surface-mid overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-ink-muted" />
                <h3 className="font-bold text-sm">Prioritized Action Items</h3>
                <span className="ml-auto text-xs bg-surface-low border border-surface-mid px-2 py-0.5 rounded-full text-ink-muted">
                  {aiTaskList.tasks?.length ?? 0} tasks
                </span>
                <CopyButton
                  getText={() => formatTaskListForCopy(aiTaskList.tasks ?? [])}
                  label="Copy all"
                  iconClass="w-3.5 h-3.5"
                  className="text-xs font-medium text-ink-secondary hover:text-ink px-2.5 py-1 rounded border border-surface-mid hover:border-gray-300 transition-colors"
                />
              </div>
              <div className="divide-y divide-gray-50">
                {aiTaskList.tasks?.map((t) => {
                  const pColors = {
                    critical: "bg-red-500 text-paper",
                    high:     "bg-orange-400 text-paper",
                    medium:   "bg-amber-400 text-paper",
                    low:      "bg-surface-mid text-ink-secondary",
                  };
                  const aColors = {
                    fix:      "bg-red-50 text-red-700",
                    generate: "bg-blue-50 text-blue-700",
                    review:   "bg-purple-50 text-purple-700",
                    optimize: "bg-teal-50 text-teal-700",
                  };
                  return (
                    <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-surface-low/50">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${pColors[t.priority]}`}>
                        {t.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-ink">{t.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${aColors[t.action_type]}`}>
                            {t.action_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pColors[t.priority]}`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-xs text-ink-secondary mb-1.5">{t.description}</p>
                        <div className="flex gap-4 text-xs text-ink-muted flex-wrap">
                          <span><strong className="text-ink-muted">Based on:</strong> {t.metric_basis}</span>
                          <span><strong className="text-ink-muted">Impact:</strong> {t.estimated_impact}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-surface-mid text-ink-muted">
                          Planning only
                        </span>
                        <CopyButton
                          getText={() => formatTaskForCopy(t)}
                          className="text-ink-muted hover:text-ink-secondary p-1.5 rounded hover:bg-surface-mid"
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
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 text-paper">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Strategic Goal</span>
                </div>
                <p className="text-base font-semibold">{aiStrategy.goal}</p>
              </div>

              <div className="space-y-3">
                {aiStrategy.phases?.map((ph) => (
                  <div key={ph.phase} className="bg-paper rounded-xl border border-surface-mid overflow-hidden">
                    <div className="px-5 py-3 bg-surface-low border-b border-surface-mid flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-ink text-paper text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {ph.phase}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-ink">{ph.name}</div>
                        <div className="text-xs text-ink-muted">{ph.duration} · Key metric: {ph.key_metric}</div>
                      </div>
                    </div>
                    <div className="p-4 grid sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Objectives</div>
                        <ul className="space-y-1">
                          {ph.objectives?.map((o, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-ink-secondary">
                              <ChevronRight className="w-3 h-3 mt-0.5 text-ink-muted flex-shrink-0" />{o}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Actions</div>
                        <ul className="space-y-1">
                          {ph.actions?.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-ink-secondary">
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
            <div className="bg-paper rounded-xl border border-solid border-surface-mid p-10 flex flex-col items-center gap-3 text-center">
              <Sparkles className="w-8 h-8 text-ink-muted" />
              <p className="text-ink-muted text-sm">Click an action above to run the AI Analyst against your live metrics.</p>
              <p className="text-ink-muted text-xs">The agent reads all grade coverage, queue status, and RAG data before responding.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Curriculum Debug Tab ── */}
      {tab === "curriculum" && (
        <div className="animate-in fade-in duration-300 space-y-6">
          <AdminCurriculumDebug />
        </div>
      )}

      {/* ── MCP Lessons Tab ── */}
      {tab === "mcp" && (
        <div className="animate-in fade-in duration-300 space-y-6">
          <AdminMcpLessons />
        </div>
      )}

      {/* ── Execute Task Modal ── */}
      {execModal?.open && execModal.task && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-paper rounded-xl shadow-sm max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-mid flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-lg">Queue in Command Center</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Task Summary */}
              <div className="bg-surface-low rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink">{execModal.task.title}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {execModal.task.action_type}
                  </span>
                </div>
                <p className="text-xs text-ink-secondary">{execModal.task.description}</p>
                <div className="text-xs text-ink-muted space-y-1">
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
              <div className="flex gap-3 pt-4 border-t border-surface-mid">
                <button
                  onClick={() => setExecModal(null)}
                  disabled={execLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-surface-mid text-ink-secondary font-semibold hover:bg-surface-low disabled:opacity-40 transition-colors"
                >
                  {execResult?.created ? "Close" : "Cancel"}
                </button>
                {execResult?.created ? (
                  <button
                    onClick={() => navigate("/admin/ai-command-center")}
                    className="flex-1 px-4 py-2 rounded-lg bg-ink text-paper font-semibold hover:bg-black transition-colors"
                  >
                    Open Command Center
                  </button>
                ) : (
                  <button
                    onClick={() => sendTaskToCommandCenter(execModal.task)}
                    disabled={execLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-paper font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
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
      </div>
      <AiKeysModal
        isOpen={isAiKeysOpen}
        onClose={() => setIsAiKeysOpen(false)}
        mode="admin"
      />
    </Layout>
  );
};
