import { Activity, CheckCircle2, Clock3, XCircle } from "lucide-react";

const STATUS_META = {
  running: { icon: Clock3, className: "text-amber-600 bg-amber-50" },
  completed: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  failed: { icon: XCircle, className: "text-red-600 bg-red-50" },
};

export const MonitoringRunPanel = ({ runs }) => {
  return (
    <section className="ls-card-pad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="ls-micro-label">Monitoring Runs</p>
          <h3 className="mt-2 ls-card-title">Recent system scans</h3>
        </div>
        <span className="ls-badge">
          {runs.length} run{runs.length === 1 ? "" : "s"}
        </span>
      </div>

      {runs.length === 0 ? (
        <div className="ls-empty-state p-5">
          No monitoring runs recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const meta = STATUS_META[run.status] || { icon: Activity, className: "text-ink-secondary bg-surface-mid" };
            const Icon = meta.icon;
            return (
              <article key={run.id} className="rounded-2xl border border-surface-mid bg-surface-low p-4">
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
                  <span className="ls-badge">
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
