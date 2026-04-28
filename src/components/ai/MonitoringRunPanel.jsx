import { Activity, CheckCircle2, Clock3, XCircle } from "lucide-react";

const STATUS_META = {
  running: { icon: Clock3, className: "text-amber-600 bg-amber-50" },
  completed: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  failed: { icon: XCircle, className: "text-red-600 bg-red-50" },
};

export const MonitoringRunPanel = ({ runs }) => {
  return (
    <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Monitoring Runs</p>
          <h3 className="mt-2 text-lg font-bold text-ink">Recent system scans</h3>
        </div>
        <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-ink-secondary">
          {runs.length} run{runs.length === 1 ? "" : "s"}
        </span>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-mid p-5 text-sm text-ink-muted">
          No monitoring runs recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const meta = STATUS_META[run.status] || { icon: Activity, className: "text-slate-600 bg-slate-100" };
            const Icon = meta.icon;
            return (
              <article key={run.id} className="rounded-[24px] border border-surface-mid bg-surface-low/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl p-2 ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{run.run_type}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {run.issues_detected} issue(s) detected • {run.grouped_issues} grouped
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {run.status}
                  </span>
                </div>
                <div className="mt-3 text-[11px] text-ink-muted">
                  Started {new Date(run.started_at).toLocaleString()}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
