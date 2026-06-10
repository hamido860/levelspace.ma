import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileWarning,
  Filter,
  Layers,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { supabase } from "../db/supabase";
import { db } from "../db/db";
import { useLiveQuery } from "dexie-react-hooks";

const EMPTY_ARRAY: any[] = [];

type ReviewRow = {
  id: string;
  lesson_title: string | null;
  country: string | null;
  grade: string | null;
  subject: string | null;
  topic_id: string | null;
  generation_pipeline: string | null;
  validation_status: string | null;
  source_name?: string | null;
  source_confidence: number | null;
  quality_score: number | null;
  topics?: {
    id: string;
    title: string | null;
    grades?: { id: string; name: string | null } | null;
    subjects?: { id: string; name: string | null } | null;
  } | null;
};

type DetailData = {
  checks: any[];
  evidence: any[];
  materials: any[];
  requirements: any[];
};

type TrackRow = { id: string; name: string | null };
type QueueTrackRow = { topic_id: string | null; track_id: string | null; bac_tracks?: TrackRow | null };
type FilterState = {
  allGrades: boolean;
  academicLevel: string;
  track: string;
  subject: string;
  topic: string;
  status: string;
  sourceType: string;
  qualityScore: string;
  issuesOnly: boolean;
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

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isBacLevel = (value: unknown) => {
  const normalized = normalizeText(value);
  return /\bterminale\b|\b2eme\b|\b2e\b|\bbac\b/.test(normalized);
};

const isLegacySource = (row: ReviewRow) =>
  !row.generation_pipeline || row.generation_pipeline === "legacy" || row.source_name === "legacy";

const getAcademicLevel = (row: ReviewRow) =>
  row.topics?.grades?.name || row.grade || "Unknown level";

const getSubjectName = (row: ReviewRow) =>
  row.topics?.subjects?.name || row.subject || "Unknown subject";

const getTrackName = (row: ReviewRow, trackByTopic: Map<string, TrackRow>) => {
  const topicTrack = row.topic_id ? trackByTopic.get(row.topic_id)?.name : "";
  if (topicTrack) return topicTrack;
  return isBacLevel(getAcademicLevel(row)) ? "Track missing" : "";
};

const getCurriculumPath = (row: ReviewRow, trackByTopic: Map<string, TrackRow>) => {
  const level = isBacLevel(getAcademicLevel(row)) && normalizeText(getAcademicLevel(row)) === "terminale"
    ? "Terminale"
    : getAcademicLevel(row);
  const track = getTrackName(row, trackByTopic);
  const subject = getSubjectName(row);
  if (track === "Track missing") {
    return [`${level} - Track missing`, subject].filter(Boolean).join(" > ");
  }
  return [level, track, subject].filter(Boolean).join(" > ");
};

export const AdminMcpLessons: React.FC = () => {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map((setting) => [setting.key, setting.value])), [dbSettings]);
  const activeGrade = String(settingsMap.selected_grade || localStorage.getItem("selected_grade") || "");
  const activeTrackId = String(settingsMap.selected_bac_track || localStorage.getItem("selected_bac_track") || "");

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [detail, setDetail] = useState<Record<string, DetailData>>({});
  const [trackByTopic, setTrackByTopic] = useState<Map<string, TrackRow>>(new Map());
  const [allTracks, setAllTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    allGrades: false,
    academicLevel: "",
    track: "",
    subject: "",
    topic: "",
    status: "",
    sourceType: "",
    qualityScore: "",
    issuesOnly: false,
  });

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      academicLevel: current.allGrades ? current.academicLevel : activeGrade,
      track: current.allGrades ? current.track : activeTrackId,
    }));
  }, [activeGrade, activeTrackId]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, lesson_title, country, grade, subject, topic_id, generation_pipeline, validation_status, source_name, source_confidence, quality_score, topics:topic_id(id, title, grades:grade_id(id, name), subjects:subject_id(id, name))")
        .order("updated_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      const nextRows = Array.isArray(data) ? data as ReviewRow[] : [];
      setRows(nextRows);

      const lessonIds = nextRows.map((row) => row.id);
      const topicIds = Array.from(new Set(nextRows.map((row) => row.topic_id).filter(Boolean))) as string[];

      const [checksResult, evidenceResult, materialsResult, requirementsResult, queueTrackResult, tracksResult] = await Promise.all([
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
        topicIds.length
          ? supabase.from("lesson_gen_queue").select("topic_id, track_id, bac_tracks:track_id(id, name)").in("topic_id", topicIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("bac_tracks").select("id, name").order("name", { ascending: true }),
      ]);

      const nextTrackByTopic = new Map<string, TrackRow>();
      ((queueTrackResult.data || []) as QueueTrackRow[]).forEach((item) => {
        if (item.topic_id && item.bac_tracks?.name && !nextTrackByTopic.has(item.topic_id)) {
          nextTrackByTopic.set(item.topic_id, item.bac_tracks);
        }
      });
      setTrackByTopic(nextTrackByTopic);
      setAllTracks(((tracksResult.data || []) as TrackRow[]).filter((track) => track.id && track.name));

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

  const filterOptions = useMemo(() => {
    const levels = new Set<string>();
    const subjects = new Set<string>();
    const topics = new Set<string>();
    const statuses = new Set<string>();
    rows.forEach((row) => {
      levels.add(getAcademicLevel(row));
      subjects.add(getSubjectName(row));
      if (row.topics?.title) topics.add(row.topics.title);
      statuses.add(row.validation_status || "needs_review");
    });
    return {
      levels: Array.from(levels).filter(Boolean).sort(),
      tracks: allTracks,
      subjects: Array.from(subjects).filter(Boolean).sort(),
      topics: Array.from(topics).filter(Boolean).sort(),
      statuses: Array.from(statuses).filter(Boolean).sort(),
    };
  }, [allTracks, rows]);

  const tableRows = useMemo(() => {
    const activeLevelFilter = filters.allGrades ? filters.academicLevel : activeGrade;
    const activeTrackFilter = filters.allGrades ? filters.track : activeTrackId;
    const minQuality = filters.qualityScore ? Number(filters.qualityScore) : null;

    return rows.filter((row) => {
      const rowLevel = getAcademicLevel(row);
      const rowSubject = getSubjectName(row);
      const rowTopic = row.topics?.title || "";
      const rowTrack = row.topic_id ? trackByTopic.get(row.topic_id)?.id || "" : "";
      const rowTrackName = getTrackName(row, trackByTopic);
      const matchesActiveTrack = !activeTrackFilter
        || rowTrack === activeTrackFilter
        || normalizeText(rowTrackName) === normalizeText(activeTrackFilter);
      const rowDetail = detail[row.id] || { checks: [], evidence: [], materials: [], requirements: [] };
      const hasIssues = rowDetail.checks.some((check) => ["warning", "fail"].includes(check.status))
        || rowDetail.materials.some((item) => item.material_type === "material_request" && item.approved !== true)
        || rowTrackName === "Track missing";

      if (!filters.allGrades && activeLevelFilter && normalizeText(rowLevel) !== normalizeText(activeLevelFilter)) return false;
      if (!filters.allGrades && activeTrackFilter && isBacLevel(rowLevel) && !matchesActiveTrack) return false;
      if (filters.allGrades && filters.academicLevel && normalizeText(rowLevel) !== normalizeText(filters.academicLevel)) return false;
      if (filters.allGrades && filters.track && rowTrack !== filters.track) return false;
      if (filters.subject && normalizeText(rowSubject) !== normalizeText(filters.subject)) return false;
      if (filters.topic && normalizeText(rowTopic) !== normalizeText(filters.topic)) return false;
      if (filters.status && normalizeText(row.validation_status || "needs_review") !== normalizeText(filters.status)) return false;
      if (filters.sourceType !== "legacy" && isLegacySource(row)) return false;
      if (filters.sourceType === "legacy" && !isLegacySource(row)) return false;
      if (filters.sourceType === "mcp" && isLegacySource(row)) return false;
      if (minQuality !== null && Number.isFinite(minQuality) && Number(row.quality_score || 0) < minQuality) return false;
      if (filters.issuesOnly && !hasIssues) return false;
      return true;
    });
  }, [activeGrade, activeTrackId, detail, filters, rows, trackByTopic]);

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const switchToAllGrades = () => setFilters((current) => ({
    ...current,
    allGrades: true,
    academicLevel: "",
    track: "",
  }));

  return (
      <section className="space-y-6">
        <div className="rounded-xl border border-ink/10 bg-paper p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">Review workspace</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Curriculum Review Queue</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Inspect admin-heavy lesson runs, source grounding, material gaps, and MCP quality checks before publishing.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">
                  Active session: {activeGrade || "No active grade"}
                </span>
                {activeTrackId && (
                  <span className="rounded-full bg-ink/5 px-3 py-1 font-bold text-ink">
                    Track: {allTracks.find((track) => track.id === activeTrackId)?.name || activeTrackId}
                  </span>
                )}
                {filters.allGrades && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">
                    Viewing all grades
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={loadRows}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-xs font-bold uppercase tracking-normal text-paper hover:bg-accent disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-paper p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-muted">
            <Filter className="h-4 w-4" />
            Review filters
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-xs font-bold uppercase tracking-normal text-muted">
              <span>Academic Level</span>
              <select
                value={filters.allGrades ? filters.academicLevel : activeGrade}
                disabled={!filters.allGrades}
                onChange={(event) => setFilter("academicLevel", event.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-surface-low px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink outline-none"
              >
                <option value="">All levels</option>
                {filterOptions.levels.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold uppercase tracking-normal text-muted">
              <span>Track / Stream</span>
              <select
                value={filters.allGrades ? filters.track : activeTrackId}
                disabled={!filters.allGrades}
                onChange={(event) => setFilter("track", event.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-surface-low px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink outline-none"
              >
                <option value="">All tracks</option>
                {filterOptions.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
              </select>
            </label>
            <FilterSelect label="Subject" value={filters.subject} options={filterOptions.subjects} onChange={(value) => setFilter("subject", value)} />
            <FilterSelect label="Topic" value={filters.topic} options={filterOptions.topics} onChange={(value) => setFilter("topic", value)} />
            <FilterSelect label="Status" value={filters.status} options={filterOptions.statuses} onChange={(value) => setFilter("status", value)} />
            <label className="space-y-1 text-xs font-bold uppercase tracking-normal text-muted">
              <span>Source Type</span>
              <select value={filters.sourceType} onChange={(event) => setFilter("sourceType", event.target.value)} className="w-full rounded-xl border border-ink/10 bg-surface-low px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink outline-none">
                <option value="">All source types</option>
                <option value="mcp">MCP / reviewed</option>
                <option value="legacy">Legacy only</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold uppercase tracking-normal text-muted">
              <span>Quality Score</span>
              <select value={filters.qualityScore} onChange={(event) => setFilter("qualityScore", event.target.value)} className="w-full rounded-xl border border-ink/10 bg-surface-low px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink outline-none">
                <option value="">Any quality</option>
                <option value="0.8">0.80+</option>
                <option value="0.65">0.65+</option>
                <option value="0.5">0.50+</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                onClick={() => setFilter("issuesOnly", !filters.issuesOnly)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-normal transition-colors ${filters.issuesOnly ? "border-amber-300 bg-amber-100 text-amber-800" : "border-ink/10 bg-surface-low text-muted"}`}
              >
                Issues Only
              </button>
              <button
                onClick={() => setFilter("allGrades", !filters.allGrades)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-normal transition-colors ${filters.allGrades ? "border-accent bg-accent text-paper" : "border-ink/10 bg-surface-low text-ink"}`}
              >
                {filters.allGrades ? "All Grades On" : "Active Session"}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-sm">
          <div className="grid grid-cols-[1.8fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 border-b border-ink/10 bg-surface-low px-4 py-3 ls-micro-label">
            <span>Curriculum Path</span>
            <span>Topic / Lesson</span>
            <span>Status</span>
            <span>Source</span>
            <span>Quality</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 ls-body-text">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading MCP lessons...
            </div>
          ) : tableRows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-base font-bold text-ink">No lesson reviews for this active session.</div>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
                The queue is scoped to {activeGrade || "the current academic level"}. Terminale or legacy lessons stay hidden until you choose All Grades or a matching filter.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button onClick={switchToAllGrades} className="rounded-xl bg-ink px-4 py-2 text-xs font-bold uppercase tracking-normal text-paper">View all grades</button>
                <a href="/admin/curriculum-review" className="rounded-xl bg-surface-low px-4 py-2 text-xs font-bold uppercase tracking-normal text-ink">Import lessons</a>
                <button onClick={loadRows} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold uppercase tracking-normal text-paper">Generate review queue</button>
              </div>
            </div>
          ) : (
            tableRows.map((row) => {
              const rowDetail = detail[row.id] || { checks: [], evidence: [], materials: [], requirements: [] };
              const missingMaterials = rowDetail.materials.filter((item) => item.material_type === "material_request" && item.approved !== true).length;
              const failingChecks = rowDetail.checks.filter((check) => ["warning", "fail"].includes(check.status)).length;
              const rowTrackName = getTrackName(row, trackByTopic);
              const missingTrack = rowTrackName === "Track missing";
              const legacy = isLegacySource(row);
              const isExpanded = expandedId === row.id;
              const busyKey = (name: string) => busy === `${name}:${row.id}`;

              return (
                <div key={row.id} className="border-b border-ink/5 last:border-b-0">
                  <div className="grid grid-cols-[1.8fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-4 text-sm">
                    <div>
                      <div className="font-semibold text-ink">{getCurriculumPath(row, trackByTopic)}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {missingTrack && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Missing track</span>}
                        {legacy && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">Legacy</span>}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-ink">{row.topics?.title || "Untitled topic"}</div>
                      <div className="mt-1 ls-micro-label">{row.lesson_title || "No lesson title"}</div>
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

                  <div className="grid grid-cols-4 gap-3 px-4 pb-4 ls-micro-label">
                    <span className="inline-flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Required materials: {rowDetail.requirements.length}</span>
                    <span className="inline-flex items-center gap-2"><FileWarning className="h-3.5 w-3.5" /> Missing materials: {missingMaterials}</span>
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> MCP checks: {rowDetail.checks.length}</span>
                    <span className="inline-flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Issues: {failingChecks + (missingTrack ? 1 : 0)}</span>
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
  );
};

const DetailPanel: React.FC<{ title: string; rows: any[]; empty: string }> = ({ title, rows, empty }) => (
  <div className="rounded-2xl border border-ink/10 bg-paper p-4">
    <h3 className="text-xs font-bold uppercase tracking-normal text-ink">{title}</h3>
    {rows.length === 0 ? (
      <p className="mt-3 ls-micro-label">{empty}</p>
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

const FilterSelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="space-y-1 text-xs font-bold uppercase tracking-normal text-muted">
    <span>{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-ink/10 bg-surface-low px-3 py-2 text-sm font-medium normal-case tracking-normal text-ink outline-none"
    >
      <option value="">All {label.toLowerCase()}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);
