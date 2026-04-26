import { Code2, FileJson, Info, ShieldAlert, ShieldCheck, TerminalSquare } from "lucide-react";

const LOG_META = {
  info: { icon: Info, className: "bg-blue-50 text-blue-700 border-blue-100" },
  warning: { icon: ShieldAlert, className: "bg-amber-50 text-amber-700 border-amber-100" },
  error: { icon: ShieldAlert, className: "bg-red-50 text-red-700 border-red-100" },
  sql: { icon: TerminalSquare, className: "bg-violet-50 text-violet-700 border-violet-100" },
  validation: { icon: ShieldCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  approval: { icon: Code2, className: "bg-slate-100 text-slate-700 border-slate-200" },
};

export const TaskLogViewer = ({ task, logs }) => {
  return (
    <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Task Logs</p>
          <h3 className="mt-2 text-lg font-bold text-ink">{task?.task_name || "Select a task"}</h3>
        </div>
        <span className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-ink-secondary">
          {logs.length} log{logs.length === 1 ? "" : "s"}
        </span>
      </div>

      {!task ? (
        <div className="rounded-3xl border border-dashed border-surface-mid p-6 text-sm text-ink-muted">
          Choose a task from the status board to inspect its planner, auditor, SQL, worker, validator, and reporter logs.
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-mid p-6 text-sm text-ink-muted">
          No logs yet. Run an audit or execute the task to start the trail.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const meta = LOG_META[log.log_type] || LOG_META.info;
            const Icon = meta.icon;
            const metadata = log.metadata && Object.keys(log.metadata).length > 0
              ? JSON.stringify(log.metadata, null, 2)
              : null;

            return (
              <article key={log.id} className="rounded-[24px] border border-surface-mid bg-surface-low/65 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl border p-2 ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{log.agent_name}</p>
                        <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                          {log.log_type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-ink-secondary">{log.message}</p>
                    </div>
                  </div>
                  <time className="text-[11px] text-ink-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </div>

                {metadata && (
                  <details className="mt-3 rounded-2xl bg-paper p-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      <FileJson className="h-4 w-4" />
                      Metadata
                    </summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-ink-secondary">
                      {metadata}
                    </pre>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
