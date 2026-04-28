import { DatabaseZap, ShieldAlert, ShieldCheck } from "lucide-react";

const STATUS_META = {
  completed: { icon: ShieldCheck, className: "text-emerald-600 bg-emerald-50" },
  blocked: { icon: ShieldAlert, className: "text-red-600 bg-red-50" },
  pending: { icon: DatabaseZap, className: "text-amber-600 bg-amber-50" },
};

export const RagHealthReportPanel = ({ reports }) => {
  return (
    <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">RAG Health</p>
          <h3 className="mt-2 text-lg font-bold text-ink">Latest chunk reports</h3>
        </div>
        <DatabaseZap className="h-5 w-5 text-ink-muted" />
      </div>

      {reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-mid p-5 text-sm text-ink-muted">
          No RAG health reports recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const meta = STATUS_META[report.status] || { icon: DatabaseZap, className: "text-slate-600 bg-slate-100" };
            const Icon = meta.icon;
            return (
              <article key={report.id} className="rounded-[24px] border border-surface-mid bg-surface-low/70 p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-2xl p-2 ${meta.className}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-ink">
                        {report.ai_issues?.title || "Unlinked RAG report"}
                      </p>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        {report.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {report.chunk_count} chunk(s) • relevance {report.relevance_score}
                    </p>
                    <p className="mt-2 text-xs text-ink-secondary">
                      {report.blocking_reason || "RAG health passed without a blocking reason."}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
