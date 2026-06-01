import React, { useEffect, useState } from "react";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";

import { CurriculumDebugReport, CurriculumDebugRow, loadCurriculumDebugReport } from "../services/curriculumDebugService";

const EMPTY_REPORT: CurriculumDebugReport = {
  duplicateSubjectNames: [],
  duplicateSubjectAliases: [],
  topicsWithoutDomain: [],
  domainsStoredAsSubjects: [],
};

const severityClass = {
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  danger: "bg-red-50 text-red-900 border-red-200",
} as const;

const DebugSection: React.FC<{ title: string; description: string; rows: CurriculumDebugRow[] }> = ({ title, description, rows }) => (
  <section className="rounded-xl border border-ink/5 bg-paper p-5">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-bold text-muted">{rows.length}</span>
    </div>

    {rows.length === 0 ? (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
        No issues detected.
      </div>
    ) : (
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className={`rounded-2xl border p-4 ${severityClass[row.severity]}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">{row.label}</p>
              {row.count !== undefined && <span className="text-xs font-bold">x{row.count}</span>}
            </div>
            <p className="mt-1 text-sm opacity-80">{row.detail}</p>
          </div>
        ))}
      </div>
    )}
  </section>
);

export const AdminCurriculumDebug: React.FC = () => {
  const [report, setReport] = useState<CurriculumDebugReport>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await loadCurriculumDebugReport());
    } catch (err: any) {
      setError(err?.message || "Unable to load curriculum debug report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-xl bg-ink p-6 text-paper md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-paper/10 p-3">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-paper/50">Admin Diagnostics</p>
              <h1 className="mt-1 text-3xl font-black">Curriculum Subject Mapping</h1>
              <p className="mt-2 max-w-3xl text-sm text-paper/65">
                Checks duplicate subjects, canonical aliases, missing topic domains, and French domains accidentally stored as subjects.
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-paper px-4 py-3 text-xs font-bold uppercase tracking-normal text-ink disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-ink/5 bg-paper p-10 text-center text-sm font-semibold text-muted">
            Loading curriculum diagnostics...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DebugSection
              title="Duplicate Subject Names"
              description="Exact normalized duplicate rows in public.subjects."
              rows={report.duplicateSubjectNames}
            />
            <DebugSection
              title="Duplicate Subject Aliases"
              description="Aliases that should resolve to one canonical dashboard subject, such as Langue Française -> Français."
              rows={report.duplicateSubjectAliases}
            />
            <DebugSection
              title="Topics Without Domain"
              description="Topics that are still directly under a subject without a subject domain."
              rows={report.topicsWithoutDomain}
            />
            <DebugSection
              title="Domains Stored As Subjects"
              description="French strands that must be subject_domains rows, not dashboard subject cards."
              rows={report.domainsStoredAsSubjects}
            />
          </div>
        )}
      </div>
  );
};
