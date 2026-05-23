import { Clock3, PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";
import { AgentBadge } from "./AgentBadge";
import { RiskBadge } from "./RiskBadge";

const STATUS_META = {
  pending: { label: "Pending", icon: Clock3 },
  planning: { label: "Planning", icon: Clock3 },
  auditing: { label: "Auditing", icon: ShieldAlert },
  waiting_for_chunks: { label: "Waiting for Chunks", icon: PauseCircle },
  waiting_approval: { label: "Waiting Approval", icon: PauseCircle },
  running: { label: "Running", icon: PlayCircle },
  validating: { label: "Validating", icon: ShieldAlert },
  completed: { label: "Completed", icon: PlayCircle },
  failed: { label: "Failed", icon: ShieldAlert },
  blocked: { label: "Blocked", icon: ShieldAlert },
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
            className="ls-card-pad"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="ls-icon-tile">
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
                <div className="ls-empty-state p-4 text-xs">
                  No tasks in this lane.
                </div>
              ) : (
                items.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      selectedTaskId === task.id
                        ? "border-ink/15 bg-surface-low"
                        : "border-surface-mid bg-paper hover:border-ink/15"
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
                      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink-muted">
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
                          className="rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
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
