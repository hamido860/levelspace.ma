import { DatabaseZap, ShieldAlert, ShieldCheck } from "lucide-react";

const STATUS_META = {
  completed: { icon: ShieldCheck, className: "text-emerald-600 bg-emerald-50" },
  blocked: { icon: ShieldAlert, className: "text-red-600 bg-red-50" },
  pending: { icon: DatabaseZap, className: "text-amber-600 bg-amber-50" },
};

export const RagHealthReportPanel = ({ reports }) => {
  return (
    <section className="ls-card-pad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="ls-micro-label">RAG Health</p>
          <h3 className="mt-2 ls-card-title">Latest chunk reports</h3>
        </div>
        <DatabaseZap className="h-5 w-5 text-slate-500" />
      </div>

      {reports.length === 0 ? (
        <div className="ls-empty-state p-5">
          No RAG health reports recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const meta = STATUS_META[report.status] || { icon: DatabaseZap, className: "text-slate-600 bg-slate-100" };
            const Icon = meta.icon;
            return (
              <article key={report.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-2xl p-2 ${meta.className}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {report.ai_issues?.title || "Unlinked RAG report"}
                      </p>
                      <span className="ls-badge">
                        {report.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {report.chunk_count} chunk(s) • relevance {report.relevance_score}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
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
