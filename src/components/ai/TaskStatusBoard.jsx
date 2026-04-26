import { Clock3, PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";
import { AgentBadge } from "./AgentBadge";
import { RiskBadge } from "./RiskBadge";

const STATUS_META = {
  pending: { label: "Pending", icon: Clock3, accent: "from-slate-100 to-white" },
  planning: { label: "Planning", icon: Clock3, accent: "from-violet-100 to-white" },
  auditing: { label: "Auditing", icon: ShieldAlert, accent: "from-sky-100 to-white" },
  waiting_for_chunks: { label: "Waiting for Chunks", icon: PauseCircle, accent: "from-cyan-100 to-white" },
  waiting_approval: { label: "Waiting Approval", icon: PauseCircle, accent: "from-amber-100 to-white" },
  running: { label: "Running", icon: PlayCircle, accent: "from-emerald-100 to-white" },
  validating: { label: "Validating", icon: ShieldAlert, accent: "from-green-100 to-white" },
  completed: { label: "Completed", icon: PlayCircle, accent: "from-emerald-100 to-white" },
  failed: { label: "Failed", icon: ShieldAlert, accent: "from-rose-100 to-white" },
  blocked: { label: "Blocked", icon: ShieldAlert, accent: "from-red-100 to-white" },
};

const statusOrder = [
  "pending",
  "planning",
  "auditing",
  "waiting_for_chunks",
  "waiting_approval",
  "running",
  "validating",
  "completed",
  "failed",
  "blocked",
];

export const TaskStatusBoard = ({ tasks, onSelectTask, selectedTaskId, onRunTask }) => {
  const groups = statusOrder.map((status) => ({
    status,
    items: tasks.filter((task) => task.status === status),
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {groups.map(({ status, items }) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;

        return (
          <section
            key={status}
            className={`rounded-[28px] border border-surface-mid bg-gradient-to-b ${meta.accent} p-4`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-paper p-2 text-ink shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{meta.label}</h3>
                  <p className="text-xs text-ink-muted">{items.length} task{items.length === 1 ? "" : "s"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-surface-mid bg-paper/60 p-4 text-xs text-ink-muted">
                  No tasks in this lane.
                </div>
              ) : (
                items.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`w-full rounded-[24px] border p-4 text-left transition-colors ${
                      selectedTaskId === task.id
                        ? "border-accent bg-accent-soft/80"
                        : "border-surface-mid bg-paper hover:border-accent/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-ink">{task.task_name}</p>
                        <p className="text-xs text-ink-muted">{task.ai_issues?.title || "Linked issue unavailable"}</p>
                      </div>
                      <RiskBadge level={task.priority} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        <span>{task.status.replace(/_/g, " ")}</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-mid">
                        <div
                          className="h-2 rounded-full bg-accent transition-all"
                          style={{ width: `${Math.max(6, task.progress || 0)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <AgentBadge agent={task.assigned_agent} compact />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="line-clamp-2 text-xs text-ink-secondary">
                        {task.latestLogMessage || task.instructions || "Waiting for the next execution step."}
                      </p>
                      {["pending", "waiting_approval", "running", "validating"].includes(task.status) && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onRunTask(task);
                          }}
                          className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-paper transition-colors hover:bg-ink-secondary"
                        >
                          {task.status === "waiting_approval" ? "Resume" : "Run"}
                        </button>
                      )}
                    </div>

                    <div className="mt-3 text-[11px] text-ink-muted">
                      Updated {new Date(task.updated_at).toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};
