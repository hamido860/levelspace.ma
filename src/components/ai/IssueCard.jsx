import { AlertTriangle, FileClock, Play, ScrollText } from "lucide-react";
import { AgentBadge } from "./AgentBadge";
import { RiskBadge } from "./RiskBadge";

const ISSUE_TYPE_STYLES = {
  fix: "bg-red-50 text-red-700",
  audit: "bg-sky-50 text-sky-700",
  generation: "bg-indigo-50 text-indigo-700",
  validation: "bg-emerald-50 text-emerald-700",
  migration: "bg-amber-50 text-amber-700",
};

const STATUS_STYLES = {
  open: "bg-red-50 text-red-700",
  fixed: "bg-emerald-50 text-emerald-700",
  monitoring: "bg-blue-50 text-blue-700",
  blocked: "bg-amber-50 text-amber-700",
};

export const IssueCard = ({ issue, latestTask, onExecute, onViewLogs }) => {
  const evidence =
    issue?.evidence && Object.keys(issue.evidence).length > 0
      ? JSON.stringify(issue.evidence, null, 2)
      : "{}";

  return (
    <article className="ls-interactive-card-pad">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={issue.severity} />
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${ISSUE_TYPE_STYLES[issue.issue_type] || "bg-surface-mid text-ink-secondary"}`}>
              {issue.issue_type}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[issue.status] || "bg-surface-mid text-ink-secondary"}`}>
              {issue.status}
            </span>
          </div>
          <h3 className="max-w-xl text-lg font-bold text-ink">{issue.title}</h3>
          <p className="text-sm text-ink-secondary">{issue.impact}</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-3 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3 rounded-2xl bg-surface-low p-4">
          <div>
            <p className="ls-micro-label">Evidence</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-paper p-3 font-mono text-xs text-ink-secondary">
              {evidence}
            </pre>
          </div>
          <div>
            <p className="ls-micro-label">Suggested Action</p>
            <p className="mt-2 text-sm text-ink-secondary">{issue.suggested_action}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-surface-mid p-4">
            <p className="ls-micro-label">Affected Area</p>
            <p className="mt-2 text-sm font-semibold text-ink">{issue.affected_area}</p>
          </div>

          <div className="rounded-2xl border border-surface-mid p-4">
            <p className="ls-micro-label">Latest Task</p>
            {latestTask ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{latestTask.task_name}</p>
                    <p className="text-xs text-ink-muted">{latestTask.status} • {latestTask.progress}%</p>
                  </div>
                  <AgentBadge agent={latestTask.assigned_agent} compact />
                </div>
                <p className="text-xs text-ink-secondary">{latestTask.instructions || "Task created from AI issue analyzer."}</p>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                <FileClock className="h-4 w-4" />
                No execution task yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-muted">
          Database truth first. No write occurs without logs and approval.
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onViewLogs(issue)}
            className="ls-button-secondary"
          >
            <ScrollText className="h-4 w-4" />
            View Logs
          </button>
          <button
            onClick={() => onExecute(issue)}
            className="ls-button-primary"
          >
            <Play className="h-4 w-4" />
            Execute
          </button>
        </div>
      </div>
    </article>
  );
};
